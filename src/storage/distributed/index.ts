/**
 * 分散ストレージシステム - エクスポートモジュール
 *
 * 階層型ストレージ、予測プリフェッチ、シャーディングを統合した
 * 高性能な分散ストレージシステムを提供します。
 *
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * @example
 * ```typescript
 * import { DistributedStorage } from './storage/distributed';
 *
 * const storage = new DistributedStorage({
 *   numShards: 8,
 *   enablePrefetch: true,
 *   enableAutoPromotion: true,
 * });
 *
 * // アイテムを追加
 * await storage.add(cacheItem);
 *
 * // アイテムを取得
 * const item = await storage.get(itemId, context);
 *
 * // 類似検索
 * const results = await storage.search({
 *   vector: queryVector,
 *   maxResults: 10,
 * });
 * ```
 */

// メインクラス
export {
  DistributedStorage,
  type DistributedStorageConfig,
  type CacheOperationResult,
  type SearchQuery,
  type SystemStatistics,
} from './DistributedStorage.js';

// ストレージレイヤー
export {
  StorageLayerImpl,
  HierarchicalStorageManager,
  type LayerConfig,
} from './StorageLayer.js';

// プリフェッチシステム
export {
  PrefetchSystem,
  type PrefetchPrediction,
  type PrefetchConfig,
} from './PrefetchSystem.js';

// シャードマネージャー
export {
  ShardManager,
  type Shard,
  type ShardConfig,
  type SearchOptions,
  type SearchResult,
} from './ShardManager.js';

// キャッシュ置換ポリシー
export {
  CacheReplacementPolicy,
  type CacheScore,
  type ReplacementPolicyConfig,
} from './CacheReplacementPolicy.js';
