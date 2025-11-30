/**
 * 部分画像管理システム - モジュールエクスポート
 *
 * セマンティックセグメンテーション、パーツベースインデックシング、
 * コンポジション戦略、差分生成を提供
 */

// メインマネージャー
export { PartialImageManager } from './PartialImageManager.js';
export type {
  PartialImageManagerConfig,
  ImageProcessingResult,
  GenerationStrategy,
  GenerationRequest,
  GenerationResult,
  ExportData,
} from './PartialImageManager.js';

// セグメンター
export { Segmenter } from './Segmenter.js';
export type {
  SegmentationConfig,
  SegmentationResult,
} from './Segmenter.js';

// インデクサー
export { PartIndexer } from './PartIndexer.js';
export type {
  PartIndex,
  IndexQuery,
  IndexSearchResult,
  IndexStats,
} from './PartIndexer.js';

// コンポーザー
export { Composer } from './Composer.js';
export type {
  CompositionConfig,
  CompatibilityScore,
  CompositionCandidate,
} from './Composer.js';

// 差分生成器
export { DiffGenerator } from './DiffGenerator.js';
export type {
  DiffGenerationConfig,
  DiffGenerationResult,
} from './DiffGenerator.js';
