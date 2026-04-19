/**
 * Recall.ai Webhook 受信エンドポイント
 *
 * - `transcript.done` イベントで transcript を取得しチェーンプロンプトを実行
 * - `bot.status_change` などはログに記録（必要に応じて拡張）
 */

import type { Request, Response, Router } from 'express';
import express from 'express';
import { createLlmClient } from '../clients/llm.js';
import { RecallClient } from '../clients/recall.js';
import type { AppConfig } from '../config.js';
import { runChainPrompts } from '../orchestrator/chainPrompts.js';
import { createCrmAdapter } from '../storage/crm.js';
import type {
  RecallTranscript,
  RecallWebhookPayload,
  TranscriptUtterance,
} from '../types.js';

/**
 * Recall.ai が返す transcript レスポンスは複数フォーマットがあるため
 * よくあるパターンを utterances[] に正規化する。
 */
export function normalizeTranscript(
  raw: unknown,
  botId: string,
): RecallTranscript {
  const obj = (raw ?? {}) as Record<string, unknown>;

  if (Array.isArray(obj.utterances)) {
    return {
      bot_id: botId,
      utterances: (obj.utterances as TranscriptUtterance[]).map(
        normalizeUtterance,
      ),
      metadata: obj.metadata as Record<string, unknown> | undefined,
    };
  }

  // monologues 形式（旧 transcript API）
  if (Array.isArray(obj.monologues)) {
    const utterances: TranscriptUtterance[] = (
      obj.monologues as Array<{
        speaker: { name?: string; id?: string | number };
        elements: Array<{ value: string; ts?: number; end_ts?: number; type: string }>;
      }>
    ).map((m) => {
      const words = m.elements
        .filter((e) => e.type === 'text')
        .map((e) => e.value)
        .join('');
      const start = m.elements[0]?.ts ?? 0;
      const end = m.elements[m.elements.length - 1]?.end_ts ?? start;
      return {
        speaker: m.speaker.name ?? `speaker_${m.speaker.id ?? 'unknown'}`,
        speaker_id: m.speaker.id,
        text: words,
        words: [],
        start,
        end,
      };
    });
    return { bot_id: botId, utterances };
  }

  return { bot_id: botId, utterances: [] };
}

function normalizeUtterance(u: TranscriptUtterance): TranscriptUtterance {
  if (u.text && u.text.length > 0) return u;
  const text = (u.words ?? []).map((w) => w.text).join(' ');
  return { ...u, text };
}

export interface WebhookDeps {
  cfg: AppConfig;
  recall?: RecallClient;
}

export function createWebhookRouter(deps: WebhookDeps): Router {
  const { cfg } = deps;
  const recall = deps.recall ?? new RecallClient(cfg);
  const llm = createLlmClient(cfg);
  const crm = createCrmAdapter(cfg);

  const router = express.Router();

  router.post('/recall', async (req: Request, res: Response) => {
    // Recall.ai は HMAC 署名ヘッダ "x-recall-signature" を提供。本 PoC では
    // 単純な共有シークレット比較とする（本番では HMAC-SHA256 検証推奨）。
    const provided = req.header('x-webhook-secret');
    if (cfg.webhookSecret && provided && provided !== cfg.webhookSecret) {
      return res.status(401).json({ error: 'invalid webhook secret' });
    }

    const payload = req.body as RecallWebhookPayload;
    const event = payload?.event ?? 'unknown';
    const botId = payload?.data?.bot?.id;

    // 受信応答は早めに返す（Recall.ai は再送ロジックを持つ）
    res.status(202).json({ ok: true, event });

    if (!botId) {
      console.warn(`[webhook] received event without bot id: ${event}`);
      return;
    }

    try {
      if (event === 'transcript.done' || event === 'recording.done') {
        const bot = await recall.getBot(botId);
        const meta = (bot.metadata ?? {}) as {
          customer_name?: string;
          meeting_purpose?: string;
        };
        const raw = await recall.fetchTranscript(botId);
        const transcript = normalizeTranscript(raw, botId);

        if (transcript.utterances.length === 0) {
          console.warn(`[webhook] transcript empty for bot=${botId}`);
          return;
        }

        const result = await runChainPrompts(llm, transcript, {
          customerName: meta.customer_name,
          meetingPurpose: meta.meeting_purpose,
        });
        const saved = await crm.save(result);
        console.log(`[webhook] chain-prompts done bot=${botId} saved=${saved.location}`);
      } else {
        console.log(`[webhook] event=${event} bot=${botId} ignored`);
      }
    } catch (err) {
      console.error(`[webhook] processing failed bot=${botId}:`, err);
    }
  });

  return router;
}
