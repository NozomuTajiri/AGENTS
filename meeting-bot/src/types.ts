/**
 * Recall.ai / 解析パイプラインの共有型定義
 */

export type MeetingPlatform = 'zoom' | 'google_meet' | 'microsoft_teams' | 'unknown';

export interface ScheduleBotInput {
  meetingUrl: string;
  joinAt?: string; // ISO8601
  botName?: string;
  webhookUrl?: string;
  customerName?: string;
  meetingPurpose?: string;
}

export interface RecallBot {
  id: string;
  status: string;
  meeting_url: string;
  bot_name: string;
  join_at?: string;
  metadata?: Record<string, unknown>;
}

export interface TranscriptWord {
  text: string;
  start_timestamp: { relative: number };
  end_timestamp: { relative: number };
}

export interface TranscriptUtterance {
  speaker: string;
  speaker_id?: string | number;
  words: TranscriptWord[];
  start: number;
  end: number;
  text: string;
}

export interface RecallTranscript {
  bot_id: string;
  meeting_url?: string;
  utterances: TranscriptUtterance[];
  metadata?: Record<string, unknown>;
}

export interface RecallWebhookPayload {
  event: string;
  data: {
    bot?: { id: string };
    transcript?: { id: string; download_url?: string };
    [k: string]: unknown;
  };
}

export interface ChainResult {
  promptA: string;
  promptB: string;
  promptC: string;
  meta: {
    botId: string;
    customerName?: string;
    meetingPurpose?: string;
    occurredAt: string;
    durationSec: number;
    speakers: string[];
  };
}
