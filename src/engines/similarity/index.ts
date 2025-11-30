/**
 * Similarity Engine - エクスポートモジュール
 * 自己学習型類似度計算エンジンの統合エクスポート
 */

export { SelfLearningEngine } from './SelfLearningEngine.js';
export type {
  LearningConfig,
  LearningState,
  PerformanceMetrics,
  SimilarityResult,
} from './SelfLearningEngine.js';

export { FeedbackCollector } from './FeedbackCollector.js';
export type {
  CrossUserPattern,
  FeedbackAggregation,
} from './FeedbackCollector.js';

export { BayesianOptimizer } from './BayesianOptimizer.js';
export type {
  LossResult,
  OptimizationHistory,
} from './BayesianOptimizer.js';

export { VectorSpaceAdjuster } from './VectorSpaceAdjuster.js';
export type {
  TransformationMatrix,
  AdjustmentHistory,
  DistanceMetrics,
} from './VectorSpaceAdjuster.js';
