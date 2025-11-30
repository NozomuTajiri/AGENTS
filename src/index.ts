/**
 * Semantic Cache System - Main Entry Point
 *
 * 自己学習型マルチレイヤーセマンティック解析システム
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * @module index
 */

// ==================== Core System ====================
export { SemanticCacheSystem } from './core/index.js';
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
} from './core/index.js';
export { DEFAULT_SYSTEM_CONFIG } from './core/index.js';

// ==================== Type Definitions ====================
export type {
  // 基本型
  LayerType,
  LayerDimensions,
  StorageLevel,
  UseCaseType,
  ImagePartType,
  VariationType,

  // 入力処理
  ProcessedPrompt,
  PromptMetadata,
  ProcessedImage,
  ProcessedSketch,
  SketchLine,
  Point,
  BoundingBox,
  MultiModalInput,
  ValidationResult,
  ValidationError,

  // ベクトル化
  MultiLayerVector,
  LayerVectors,
  RelationMatrix,

  // フィードバック・学習
  FeedbackData,
  ImplicitFeedback,
  UsageHistory,
  SessionData,
  UserPreferences,
  SystemParams,
  Thresholds,
  LayerWeights,
  Gradient,

  // 類似度計算
  SimilarityMetrics,
  DecisionResult,

  // 画像管理
  ImagePart,
  PartMetadata,
  GenerationParams,
  PromptDelta,
  CompositionResult,

  // ストレージ
  StorageLayer,
  CacheItem,
  ImageMetadata,
  QueryContext,

  // リクエスト・レスポンス
  GenerationRequest,
  GenerationConstraints,
  GenerationResult,
  OptimizedRequest,
  Optimization,
  ProcessedResult,
  PostProcessingInfo,

  // Eコマース
  Product,
  ProductAttribute,
  ProductCatalog,
  StyleGuide,
  TypographySettings,
  ImageGuidelines,

  // 広告
  Campaign,
  Demographic,
  Template,
  Placeholder,
  PlaceholderConstraints,
  CampaignCache,

  // ゲーム
  GameCharacter,
  CharacterAppearance,
  CharacterVariation,
  CharacterRegistry,
  GameStyleGuide,
  LightingPreset,
  Asset,
  AssetMetadata,

  // ベンチマーク
  BenchmarkResult,
  LatencyMetrics,
  ResourceUsage,
  TestResult,
  AssertionResult,
  BenchmarkReport,
  BenchmarkSummary,
} from './types/index.js';

export { LAYER_DIMENSIONS } from './types/index.js';

// ==================== Engines ====================

// 入力処理
export { InputProcessor } from './engines/input/index.js';
export type {
  InputProcessingResult,
  InputProcessorConfig,
  InputType,
} from './engines/input/InputProcessor.js';
export { TextProcessor } from './engines/input/index.js';
export { ImageProcessor } from './engines/input/index.js';
export { SketchProcessor } from './engines/input/index.js';
export { Validator } from './engines/input/index.js';

// ベクトル化
export { VectorizationEngine } from './engines/vectorization/index.js';
export type {
  VectorizationOptions,
  VectorizationMetrics,
} from './engines/vectorization/VectorizationEngine.js';
export {
  LayerEncoder,
  MultiLayerEncoderFactory,
} from './engines/vectorization/index.js';
export { RelationMatrixCalculator } from './engines/vectorization/index.js';
export {
  getLayerEmbeddings,
  getWordEmbedding,
  preloadEmbeddings,
  clearEmbeddingCache,
  getVocabularySize,
  getAllVocabulary,
} from './engines/vectorization/index.js';

// 類似度計算
export { SelfLearningEngine } from './engines/similarity/index.js';
export type {
  LearningConfig,
  LearningState,
  PerformanceMetrics,
  SimilarityResult,
} from './engines/similarity/index.js';
export { FeedbackCollector } from './engines/similarity/index.js';
export type {
  CrossUserPattern,
  FeedbackAggregation,
} from './engines/similarity/index.js';
export { BayesianOptimizer } from './engines/similarity/index.js';
export type {
  LossResult,
  OptimizationHistory,
} from './engines/similarity/index.js';
export { VectorSpaceAdjuster } from './engines/similarity/index.js';
export type {
  TransformationMatrix,
  AdjustmentHistory,
  DistanceMetrics,
} from './engines/similarity/index.js';

// 決定エンジン
export { MultiLevelDecisionEngine } from './engines/decision/index.js';
export type { DecisionEngineConfig } from './engines/decision/index.js';
export {
  SimilarityCalculator,
  CosineSimilarityCalculator,
  SemanticTreeDistanceCalculator,
  LatentSemanticAnalysisCalculator,
  ContextualCoherenceCalculator,
} from './engines/decision/index.js';
export { UncertaintyQuantifier } from './engines/decision/index.js';
export type { UncertaintyResult } from './engines/decision/index.js';
export { EnsembleModel } from './engines/decision/index.js';
export type {
  EnsembleParameters,
  FeedbackSample,
} from './engines/decision/index.js';
export { AdaptiveThreshold } from './engines/decision/index.js';
export type {
  ThresholdConfig,
  ThresholdStatistics,
} from './engines/decision/index.js';

// 画像処理
export { PartialImageManager } from './engines/image/index.js';
export type {
  PartialImageManagerConfig,
  ImageProcessingResult,
  GenerationStrategy,
} from './engines/image/PartialImageManager.js';
export { Segmenter } from './engines/image/index.js';
export type {
  SegmentationConfig,
  SegmentationResult,
} from './engines/image/index.js';
export { PartIndexer } from './engines/image/index.js';
export type {
  PartIndex,
  IndexQuery,
  IndexSearchResult,
  IndexStats,
} from './engines/image/index.js';
export { Composer } from './engines/image/index.js';
export type {
  CompositionConfig,
  CompatibilityScore,
  CompositionCandidate,
} from './engines/image/index.js';
export { DiffGenerator } from './engines/image/index.js';
export type {
  DiffGenerationConfig,
  DiffGenerationResult,
} from './engines/image/index.js';

// ==================== Storage ====================
export {
  DistributedStorage,
  type DistributedStorageConfig,
  type CacheOperationResult,
  type SearchQuery,
  type SystemStatistics,
} from './storage/distributed/index.js';
export {
  StorageLayerImpl,
  HierarchicalStorageManager,
  type LayerConfig,
} from './storage/distributed/index.js';
export {
  PrefetchSystem,
  type PrefetchPrediction,
  type PrefetchConfig,
} from './storage/distributed/index.js';
export {
  ShardManager,
  type Shard,
  type ShardConfig,
  type SearchOptions,
  type SearchResult,
} from './storage/distributed/index.js';
export {
  CacheReplacementPolicy,
  type CacheScore,
  type ReplacementPolicyConfig,
} from './storage/distributed/index.js';

// ==================== Optimizers ====================
export {
  UseCaseOptimizer,
  type UseCaseOptimizerConfig,
  type OptimizationStrategy,
  type OptimizationContext,
  type OptimizationResult,
} from './optimizers/index.js';
export {
  EcommerceOptimizer,
  type EcommerceOptimizerConfig,
  type EcommerceContext,
} from './optimizers/index.js';
export {
  AdvertisingOptimizer,
  type AdvertisingOptimizerConfig,
  type AdvertisingContext,
} from './optimizers/index.js';
export {
  GamingOptimizer,
  type GamingOptimizerConfig,
  type GamingContext,
  type VariationPipeline,
  type PipelineStep,
} from './optimizers/index.js';
export { createOptimizer } from './optimizers/index.js';

// ==================== Main Function ====================

/**
 * メイン実行関数
 *
 * システムのデモンストレーションを実行します。
 */
export async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Semantic Cache System - Patent Implementation');
  console.log('生成AI画像のキャッシュシステム及び方法');
  console.log('='.repeat(60));
  console.log('');

  // システム初期化（簡略版）
  console.log('[1/4] System initialization...');
  console.log('  ✓ Input processing engine');
  console.log('  ✓ Vectorization engine');
  console.log('  ✓ Self-learning similarity engine');
  console.log('  ✓ Multi-level decision engine');
  console.log('  ✓ Partial image manager');
  console.log('  ✓ Distributed storage system');
  console.log('');

  console.log('[2/4] Available components:');
  console.log('  - Input: Text, Image, Sketch processing');
  console.log('  - Vectorization: Multi-layer semantic vectors');
  console.log('  - Similarity: Self-learning calculation');
  console.log('  - Decision: Cache/Diff/New generation');
  console.log('  - Image: Segmentation & composition');
  console.log('  - Storage: 4-level hierarchical cache');
  console.log('');

  console.log('[3/4] Optimization layers:');
  console.log('  - E-commerce: Product catalog optimization');
  console.log('  - Advertising: Campaign-aware caching');
  console.log('  - Gaming: Character variation pipeline');
  console.log('');

  console.log('[4/4] System ready!');
  console.log('');
  console.log('Usage:');
  console.log('  import { SemanticCacheSystem } from "AGENTS";');
  console.log('');
  console.log('  const system = new SemanticCacheSystem({');
  console.log('    memoryLimit: 0.92,');
  console.log('    decision: { cacheHitThreshold: 0.85 },');
  console.log('  });');
  console.log('');
  console.log('  await system.initialize();');
  console.log('  const result = await system.generate({');
  console.log('    prompt: "beautiful sunset over mountains",');
  console.log('  });');
  console.log('');
  console.log('Documentation: See src/core/SemanticCacheSystem.ts');
  console.log('='.repeat(60));
}

// エントリポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
