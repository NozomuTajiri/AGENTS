/**
 * Core Module - Semantic Cache System
 *
 * セマンティックキャッシュシステムのコアモジュール
 *
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * @example
 * ```typescript
 * import { SemanticCacheSystem } from './core';
 *
 * const system = new SemanticCacheSystem({
 *   memoryLimit: 0.92,
 *   decision: {
 *     cacheHitThreshold: 0.85,
 *   },
 * });
 *
 * await system.initialize();
 *
 * const result = await system.generate({
 *   prompt: "beautiful landscape",
 * });
 * ```
 *
 * @module core
 */

// メインシステムクラス
export { SemanticCacheSystem } from './SemanticCacheSystem.js';

// 設定と型定義
export type {
  SystemConfig,
  InputConfig,
  VectorizationConfig,
  SimilarityConfig,
  DecisionConfig,
  ImageConfig,
  StorageConfig,
  OptimizationConfig,
  SystemStats,
  HealthCheckResult,
  ComponentHealth,
  HealthIssue,
} from './SystemConfig.js';

export { DEFAULT_SYSTEM_CONFIG } from './SystemConfig.js';
