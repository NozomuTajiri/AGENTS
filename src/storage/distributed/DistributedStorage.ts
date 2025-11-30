/**
 * 分散ストレージシステム - メインクラス
 *
 * 階層型ストレージ、予測プリフェッチ、シャーディングを統合した
 * 高性能な分散ストレージシステムを提供します。
 *
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import type { CacheItem, QueryContext, MultiLayerVector, StorageLevel } from '../../types/index.js';
import { HierarchicalStorageManager } from './StorageLayer.js';
import { PrefetchSystem, type PrefetchPrediction } from './PrefetchSystem.js';
import { ShardManager, type SearchResult } from './ShardManager.js';
import { CacheReplacementPolicy } from './CacheReplacementPolicy.js';

/**
 * 分散ストレージ設定
 */
export interface DistributedStorageConfig {
  /**
   * シャード数
   */
  numShards?: number;

  /**
   * プリフェッチを有効化
   */
  enablePrefetch?: boolean;

  /**
   * 自動昇格を有効化（頻繁にアクセスされるアイテムを上位レイヤーへ移動）
   */
  enableAutoPromotion?: boolean;

  /**
   * 自動昇格の閾値（アクセス回数）
   */
  promotionThreshold?: number;

  /**
   * メモリ使用率の上限 (0-1)
   */
  memoryUsageLimit?: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: Required<DistributedStorageConfig> = {
  numShards: 8,
  enablePrefetch: true,
  enableAutoPromotion: true,
  promotionThreshold: 10,
  memoryUsageLimit: 0.92,
};

/**
 * キャッシュ操作結果
 */
export interface CacheOperationResult {
  success: boolean;
  itemId?: string;
  storageLevel?: StorageLevel;
  shardId?: number;
  prefetched?: boolean;
  error?: string;
}

/**
 * 検索クエリ
 */
export interface SearchQuery {
  vector: MultiLayerVector;
  context?: QueryContext;
  maxResults?: number;
  similarityThreshold?: number;
}

/**
 * システム統計
 */
export interface SystemStatistics {
  storage: ReturnType<HierarchicalStorageManager['getStatistics']>;
  prefetch: ReturnType<PrefetchSystem['getStatistics']>;
  sharding: ReturnType<ShardManager['getStatistics']>;
  totalItems: number;
  cacheHitRate: number;
  avgAccessLatency: number;
}

/**
 * 分散ストレージシステム
 *
 * 階層型キャッシュ、予測プリフェッチ、意味的シャーディングを統合した
 * エンタープライズグレードの分散ストレージソリューション。
 */
export class DistributedStorage {
  private config: Required<DistributedStorageConfig>;
  private storageManager: HierarchicalStorageManager;
  private prefetchSystem: PrefetchSystem;
  private shardManager: ShardManager;
  private replacementPolicy: CacheReplacementPolicy;

  // メトリクス
  private totalRequests: number = 0;
  private cacheHits: number = 0;
  private totalLatency: number = 0;

  constructor(config?: DistributedStorageConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 各コンポーネントを初期化
    this.storageManager = new HierarchicalStorageManager();
    this.prefetchSystem = new PrefetchSystem();
    this.shardManager = new ShardManager({ numShards: this.config.numShards });
    this.replacementPolicy = new CacheReplacementPolicy();
  }

  /**
   * アイテムを追加
   *
   * @param item - キャッシュアイテム
   * @param level - ストレージレベル（指定しない場合は自動判定）
   * @returns 操作結果
   */
  public async add(item: CacheItem, level?: StorageLevel): Promise<CacheOperationResult> {
    try {
      // シャードに追加
      const shardId = this.shardManager.addItem(item);

      // ストレージレイヤーに追加
      const success = this.storageManager.placeItem(item, level);

      if (!success) {
        return {
          success: false,
          error: 'Failed to place item in storage layer',
        };
      }

      return {
        success: true,
        itemId: item.id,
        storageLevel: item.storageLevel,
        shardId,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * アイテムを取得
   *
   * @param itemId - アイテムID
   * @param context - クエリコンテキスト（プリフェッチに使用）
   * @returns アイテム（存在しない場合はundefined）
   */
  public async get(itemId: string, context?: QueryContext): Promise<CacheItem | undefined> {
    const startTime = Date.now();
    this.totalRequests++;

    // 階層型ストレージから検索
    const found = this.storageManager.findItem(itemId);

    if (!found) {
      this.totalLatency += Date.now() - startTime;
      return undefined;
    }

    this.cacheHits++;

    const { item } = found;

    // アクセス履歴を記録（プリフェッチ用）
    if (this.config.enablePrefetch && context) {
      this.prefetchSystem.recordAccess(itemId, context);

      // プリフェッチを実行
      await this.executePrefetch(itemId, context);
    }

    // 自動昇格
    if (this.config.enableAutoPromotion && item.accessCount >= this.config.promotionThreshold) {
      await this.promoteItem(itemId);
    }

    this.totalLatency += Date.now() - startTime;

    return item;
  }

  /**
   * アイテムを削除
   *
   * @param itemId - アイテムID
   * @returns 操作結果
   */
  public async remove(itemId: string): Promise<CacheOperationResult> {
    try {
      // ストレージレイヤーから削除
      const found = this.storageManager.findItem(itemId);

      if (found) {
        found.layer.remove(itemId);
      }

      // シャードから削除
      this.shardManager.removeItem(itemId);

      return {
        success: true,
        itemId,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 類似アイテムを検索
   *
   * @param query - 検索クエリ
   * @returns 検索結果
   */
  public async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.totalRequests++;

    // シャードマネージャーで検索
    const results = this.shardManager.searchSimilar(query.vector, {
      maxResults: query.maxResults,
      similarityThreshold: query.similarityThreshold,
    });

    // 検索結果をアクセス履歴に記録
    if (this.config.enablePrefetch && query.context && results.length > 0) {
      const topResult = results[0];
      this.prefetchSystem.recordAccess(topResult.item.id, query.context);
    }

    this.totalLatency += Date.now() - startTime;

    return results;
  }

  /**
   * アイテムを上位レイヤーに昇格
   *
   * @param itemId - アイテムID
   * @returns 成功した場合true
   */
  public async promoteItem(itemId: string): Promise<boolean> {
    return this.storageManager.promoteItem(itemId);
  }

  /**
   * プリフェッチを実行
   *
   * @param currentItemId - 現在アクセス中のアイテムID
   * @param context - クエリコンテキスト
   */
  private async executePrefetch(currentItemId: string, context: QueryContext): Promise<void> {
    // 全アイテムを取得
    const allItems = this.getAllItems();

    // 予測
    const predictions = this.prefetchSystem.predict(currentItemId, context, allItems);

    // 予測されたアイテムをL1にプリフェッチ
    for (const prediction of predictions) {
      const found = this.storageManager.findItem(prediction.itemId);

      if (found && found.layer.level !== 'L1') {
        // L1に昇格
        await this.promoteItem(prediction.itemId);
      }
    }
  }

  /**
   * すべてのアイテムを取得
   *
   * @returns アイテムの配列
   */
  private getAllItems(): CacheItem[] {
    const items: CacheItem[] = [];

    for (const layer of this.storageManager.getAllLayers()) {
      items.push(...layer.getAll());
    }

    return items;
  }

  /**
   * システム統計を取得
   *
   * @returns 統計情報
   */
  public getStatistics(): SystemStatistics {
    const storageStats = this.storageManager.getStatistics();
    const prefetchStats = this.prefetchSystem.getStatistics();
    const shardingStats = this.shardManager.getStatistics();

    return {
      storage: storageStats,
      prefetch: prefetchStats,
      sharding: shardingStats,
      totalItems: storageStats.totalItems,
      cacheHitRate: this.totalRequests > 0 ? this.cacheHits / this.totalRequests : 0,
      avgAccessLatency: this.totalRequests > 0 ? this.totalLatency / this.totalRequests : 0,
    };
  }

  /**
   * プリフェッチ予測を取得（テスト・デバッグ用）
   *
   * @param currentItemId - 現在のアイテムID
   * @param context - クエリコンテキスト
   * @returns プリフェッチ予測
   */
  public getPrefetchPredictions(
    currentItemId: string,
    context: QueryContext
  ): PrefetchPrediction[] {
    const allItems = this.getAllItems();
    return this.prefetchSystem.predict(currentItemId, context, allItems);
  }

  /**
   * メモリ使用率を取得
   *
   * @returns 使用率 (0-1)
   */
  public getMemoryUsage(): number {
    const stats = this.storageManager.getStatistics();
    return stats.totalUsage / stats.totalCapacity;
  }

  /**
   * メモリ使用率が制限を超えているかチェック
   *
   * @returns 超えている場合true
   */
  public isMemoryLimitExceeded(): boolean {
    return this.getMemoryUsage() > this.config.memoryUsageLimit;
  }

  /**
   * メモリ最適化を実行
   *
   * @returns 解放されたバイト数
   */
  public async optimizeMemory(): Promise<number> {
    let freedBytes = 0;

    // L1から使用頻度の低いアイテムを降格
    const l1Layer = this.storageManager.getLayer('L1');

    if (!l1Layer) {
      return 0;
    }

    const l1Items = l1Layer.getAll();

    // スコアが低い順にソート
    const itemScores = l1Items.map((item) => ({
      item,
      score: this.replacementPolicy.calculateScore(item),
    }));

    itemScores.sort((a, b) => a.score.score - b.score.score);

    // 下位20%を降格
    const demotionCount = Math.floor(itemScores.length * 0.2);

    for (let i = 0; i < demotionCount; i++) {
      const { item } = itemScores[i];
      const itemSize = item.image.length;

      // L2に移動
      l1Layer.remove(item.id);
      const l2Layer = this.storageManager.getLayer('L2');

      if (l2Layer) {
        item.storageLevel = 'L2';
        l2Layer.add(item);
        freedBytes += itemSize;
      }
    }

    return freedBytes;
  }

  /**
   * システムをクリア
   */
  public clear(): void {
    for (const layer of this.storageManager.getAllLayers()) {
      layer.clear();
    }

    this.shardManager.clear();
    this.prefetchSystem.clearHistory();

    this.totalRequests = 0;
    this.cacheHits = 0;
    this.totalLatency = 0;
  }

  /**
   * 設定を更新
   *
   * @param config - 新しい設定
   */
  public updateConfig(config: Partial<DistributedStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * ヘルスチェック
   *
   * @returns システムが正常な場合true
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: {
      memoryUsage: number;
      cacheHitRate: number;
      avgLatency: number;
    };
  }> {
    const issues: string[] = [];
    const memoryUsage = this.getMemoryUsage();
    const stats = this.getStatistics();

    // メモリ使用率チェック
    if (memoryUsage > 0.95) {
      issues.push('Memory usage critically high (>95%)');
    } else if (memoryUsage > 0.9) {
      issues.push('Memory usage high (>90%)');
    }

    // キャッシュヒット率チェック
    if (stats.cacheHitRate < 0.5 && this.totalRequests > 100) {
      issues.push('Cache hit rate low (<50%)');
    }

    // レイテンシチェック
    if (stats.avgAccessLatency > 100) {
      issues.push('Average access latency high (>100ms)');
    }

    return {
      healthy: issues.length === 0,
      issues,
      metrics: {
        memoryUsage,
        cacheHitRate: stats.cacheHitRate,
        avgLatency: stats.avgAccessLatency,
      },
    };
  }
}
