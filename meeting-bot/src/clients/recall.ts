/**
 * Recall.ai API クライアント（最小実装）
 *
 * 参照:
 * - https://docs.recall.ai/reference/bot_create
 * - https://docs.recall.ai/docs/perfect-diarization
 * - https://docs.recall.ai/docs/multilingual-transcription
 */

import type { AppConfig } from '../config.js';
import type { RecallBot, ScheduleBotInput } from '../types.js';
import { buildDeepgramConfig } from './deepgram.js';

export class RecallClient {
  constructor(private readonly cfg: AppConfig) {}

  private headers(): Record<string, string> {
    return {
      'Authorization': `Token ${this.cfg.recall.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Bot を会議に投入する。joinAt を渡すと予約、未指定なら即時参加。
   * Perfect Diarization を有効化するため `use_separate_streams_when_available: true` を付与。
   */
  async scheduleBot(input: ScheduleBotInput): Promise<RecallBot> {
    const url = `${this.cfg.recall.baseUrl}/api/v1/bot/`;
    const body = {
      meeting_url: input.meetingUrl,
      bot_name: input.botName ?? this.cfg.recall.botName,
      join_at: input.joinAt,
      // Perfect Diarization
      recording_config: {
        transcript: {
          provider: buildDeepgramConfig(this.cfg),
        },
        // 録音は participant ごとに分離（話者分離 100% 化のキー）
        // https://docs.recall.ai/docs/perfect-diarization
        audio_mixed_mp3: {},
        participant_events: {},
      },
      automatic_audio_output: {},
      use_separate_streams_when_available: true,
      // 終了/transcript 完了時に通知してもらう
      webhooks: input.webhookUrl
        ? [
            {
              url: input.webhookUrl,
              events: [
                'bot.status_change',
                'transcript.done',
                'transcript.processing',
                'recording.done',
              ],
            },
          ]
        : undefined,
      metadata: {
        customer_name: input.customerName,
        meeting_purpose: input.meetingPurpose,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Recall.ai scheduleBot failed: ${res.status} ${text}`);
    }
    return (await res.json()) as RecallBot;
  }

  async getBot(botId: string): Promise<RecallBot> {
    const url = `${this.cfg.recall.baseUrl}/api/v1/bot/${botId}/`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Recall.ai getBot failed: ${res.status}`);
    return (await res.json()) as RecallBot;
  }

  /**
   * Bot 単位で transcript（話者ラベル付き）を取得。
   * Recall.ai は transcript 完了後に download_url を発行する。
   */
  async fetchTranscript(botId: string): Promise<unknown> {
    const url = `${this.cfg.recall.baseUrl}/api/v1/bot/${botId}/transcript/`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Recall.ai fetchTranscript failed: ${res.status}`);
    return await res.json();
  }

  async leaveBot(botId: string): Promise<void> {
    const url = `${this.cfg.recall.baseUrl}/api/v1/bot/${botId}/leave_call/`;
    const res = await fetch(url, { method: 'POST', headers: this.headers() });
    if (!res.ok) throw new Error(`Recall.ai leaveBot failed: ${res.status}`);
  }
}
