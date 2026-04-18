/**
 * Deepgram プロバイダ設定生成
 *
 * Recall.ai の `recording_config.transcript.provider` に渡す JSON を構築する。
 * - 日本語 + 英語の混在（コードスイッチング）対応のため `language: "multi"` を推奨
 * - `nova-3` モデルが現時点で最新かつ多言語対応
 */

import type { AppConfig } from '../config.js';

export interface DeepgramProviderConfig {
  deepgram_streaming?: {
    model: string;
    language: string;
    punctuate: boolean;
    smart_format: boolean;
  };
}

export function buildDeepgramConfig(cfg: AppConfig): DeepgramProviderConfig {
  return {
    deepgram_streaming: {
      model: cfg.deepgram.model,
      language: cfg.deepgram.language,
      punctuate: true,
      smart_format: true,
    },
  };
}
