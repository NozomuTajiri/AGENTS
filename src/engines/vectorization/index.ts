/**
 * Vectorization Engine - Public API
 *
 * 多層ベクトル化エンジンの公開インターフェース
 */

export { VectorizationEngine } from './VectorizationEngine.js';
export type { VectorizationOptions, VectorizationMetrics } from './VectorizationEngine.js';

export { LayerEncoder, MultiLayerEncoderFactory } from './LayerEncoder.js';
export { RelationMatrixCalculator } from './RelationMatrixCalculator.js';

export {
  getLayerEmbeddings,
  getWordEmbedding,
  preloadEmbeddings,
  clearEmbeddingCache,
  getVocabularySize,
  getAllVocabulary,
} from './embeddings.js';
