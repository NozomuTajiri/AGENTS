/**
 * チェーンプロンプトオーケストレータ
 *
 * Recall.ai の transcript を入力に、
 *   A: 事実構造化 → B: 付加価値仮説 → C: ネクストアクション
 * を直列に実行する。
 *
 * 設計意図:
 *   - 1 プロンプトに詰め込まず、責務を分離（n8n の LLM ノード連結と同じ思想）
 *   - 各ステップの中間出力を保持して再現性とデバッグ容易性を担保
 */

import type { LlmClient } from '../clients/llm.js';
import {
  renderPromptA,
  PROMPT_A_SYSTEM,
} from '../prompts/promptA.js';
import {
  renderPromptB,
  PROMPT_B_SYSTEM,
} from '../prompts/promptB.js';
import {
  renderPromptC,
  PROMPT_C_SYSTEM,
} from '../prompts/promptC.js';
import type {
  ChainResult,
  RecallTranscript,
  TranscriptUtterance,
} from '../types.js';

export interface RunChainOptions {
  customerName?: string;
  meetingPurpose?: string;
}

export function transcriptToText(utterances: TranscriptUtterance[]): string {
  return utterances
    .map((u) => `${u.speaker}: ${u.text.trim()}`)
    .filter((line) => line.length > 0)
    .join('\n');
}

function uniqueSpeakers(utterances: TranscriptUtterance[]): string[] {
  return Array.from(new Set(utterances.map((u) => u.speaker))).filter(Boolean);
}

function totalDurationSec(utterances: TranscriptUtterance[]): number {
  if (utterances.length === 0) return 0;
  const last = utterances[utterances.length - 1];
  return Math.max(0, Math.floor(last.end - utterances[0].start));
}

export async function runChainPrompts(
  llm: LlmClient,
  transcript: RecallTranscript,
  opts: RunChainOptions = {},
): Promise<ChainResult> {
  const text = transcriptToText(transcript.utterances);
  const speakers = uniqueSpeakers(transcript.utterances);

  // --- Step A: 事実構造化 ---
  const promptA = renderPromptA({
    customerName: opts.customerName,
    meetingPurpose: opts.meetingPurpose,
    transcript: text,
  });
  const outA = await llm.complete({
    system: PROMPT_A_SYSTEM,
    messages: [{ role: 'user', content: promptA }],
    maxTokens: 2048,
    temperature: 0.1,
  });

  // --- Step B: 付加価値仮説 ---
  const promptB = renderPromptB({
    customerName: opts.customerName,
    meetingPurpose: opts.meetingPurpose,
    promptAOutput: outA,
  });
  const outB = await llm.complete({
    system: PROMPT_B_SYSTEM,
    messages: [{ role: 'user', content: promptB }],
    maxTokens: 2048,
    temperature: 0.4,
  });

  // --- Step C: ネクストアクション ---
  const promptC = renderPromptC({
    customerName: opts.customerName,
    meetingPurpose: opts.meetingPurpose,
    promptBOutput: outB,
    attendees: speakers,
  });
  const outC = await llm.complete({
    system: PROMPT_C_SYSTEM,
    messages: [{ role: 'user', content: promptC }],
    maxTokens: 2048,
    temperature: 0.3,
  });

  return {
    promptA: outA,
    promptB: outB,
    promptC: outC,
    meta: {
      botId: transcript.bot_id,
      customerName: opts.customerName,
      meetingPurpose: opts.meetingPurpose,
      occurredAt: new Date().toISOString(),
      durationSec: totalDurationSec(transcript.utterances),
      speakers,
    },
  };
}
