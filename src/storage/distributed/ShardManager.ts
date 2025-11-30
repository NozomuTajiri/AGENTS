/**
 * シャーディングと分散検索マネージャー
 *
 * シャーディング戦略:
 * shard_id = hash(v_primary_layer) % num_shards
 *
 * 意味的クラスターベースのシャーディングにより、
 * 関連性の高いアイテムを同じシャードに配置します。
 */

import type { CacheItem, MultiLayerVector } from '../../types/index.js';

/**
 * シャード情報
 */
export interface Shard {
  id: number;
  items: Map<string, CacheItem>;
  vectorCentroid: MultiLayerVector | null; // シャードの中心ベクトル
  itemCount: number;
}

/**
 * シャーディング設定
 */
export interface ShardConfig {
  /**
   * シャード数
   */
  numShards: number;

  /**
   * プライマリレイヤー（シャーディングキーとして使用）
   */
  primaryLayer: 'subject' | 'attribute' | 'style' | 'composition' | 'emotion';

  /**
   * リバランスの閾値（シャード間のアイテム数の差）
   */
  rebalanceThreshold: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: ShardConfig = {
  numShards: 8,
  primaryLayer: 'subject',
  rebalanceThreshold: 100,
};

/**
 * 検索オプション
 */
export interface SearchOptions {
  /**
   * 検索するシャード数の上限
   */
  maxShards?: number;

  /**
   * 類似度の閾値
   */
  similarityThreshold?: number;

  /**
   * 最大結果数
   */
  maxResults?: number;
}

/**
 * 検索結果
 */
export interface SearchResult {
  item: CacheItem;
  similarity: number;
  shardId: number;
}

/**
 * シャードマネージャー
 */
export class ShardManager {
  private config: ShardConfig;
  private shards: Map<number, Shard>;

  constructor(config?: Partial<ShardConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.shards = new Map();

    // シャードを初期化
    for (let i = 0; i < this.config.numShards; i++) {
      this.shards.set(i, {
        id: i,
        items: new Map(),
        vectorCentroid: null,
        itemCount: 0,
      });
    }
  }

  /**
   * アイテムをシャードに追加
   *
   * @param item - 追加するアイテム
   * @returns シャードID
   */
  public addItem(item: CacheItem): number {
    const shardId = this.calculateShardId(item.vector);
    const shard = this.shards.get(shardId);

    if (!shard) {
      throw new Error(`Shard ${shardId} not found`);
    }

    shard.items.set(item.id, item);
    shard.itemCount++;

    // セントロイドを更新
    this.updateCentroid(shardId);

    // リバランスが必要かチェック
    if (this.needsRebalancing()) {
      this.rebalance();
    }

    return shardId;
  }

  /**
   * アイテムを削除
   *
   * @param itemId - アイテムID
   * @returns 削除された場合true
   */
  public removeItem(itemId: string): boolean {
    for (const shard of this.shards.values()) {
      if (shard.items.has(itemId)) {
        shard.items.delete(itemId);
        shard.itemCount--;
        this.updateCentroid(shard.id);
        return true;
      }
    }

    return false;
  }

  /**
   * アイテムを取得
   *
   * @param itemId - アイテムID
   * @returns アイテム（存在しない場合はundefined）
   */
  public getItem(itemId: string): CacheItem | undefined {
    for (const shard of this.shards.values()) {
      const item = shard.items.get(itemId);
      if (item) {
        return item;
      }
    }

    return undefined;
  }

  /**
   * 類似アイテムを検索
   *
   * @param queryVector - クエリベクトル
   * @param options - 検索オプション
   * @returns 検索結果の配列
   */
  public searchSimilar(queryVector: MultiLayerVector, options?: SearchOptions): SearchResult[] {
    const maxShards = options?.maxShards || this.config.numShards;
    const similarityThreshold = options?.similarityThreshold || 0.5;
    const maxResults = options?.maxResults || 10;

    // クエリベクトルに最も近いシャードを特定
    const shardSimilarities = this.calculateShardSimilarities(queryVector);

    // 類似度の高い順にソート
    shardSimilarities.sort((a, b) => b.similarity - a.similarity);

    // 検索対象シャードを選択
    const targetShards = shardSimilarities.slice(0, maxShards);

    // 各シャード内で類似アイテムを検索
    const results: SearchResult[] = [];

    for (const { shardId } of targetShards) {
      const shard = this.shards.get(shardId);

      if (!shard) {
        continue;
      }

      for (const item of shard.items.values()) {
        const similarity = this.calculateVectorSimilarity(queryVector, item.vector);

        if (similarity >= similarityThreshold) {
          results.push({
            item,
            similarity,
            shardId,
          });
        }
      }
    }

    // 類似度の降順でソート
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, maxResults);
  }

  /**
   * シャードIDを計算
   *
   * shard_id = hash(v_primary_layer) % num_shards
   *
   * @param vector - マルチレイヤーベクトル
   * @returns シャードID
   */
  private calculateShardId(vector: MultiLayerVector): number {
    const primaryVector = vector[this.config.primaryLayer];

    // ベクトルのハッシュ値を計算
    const hash = this.hashVector(primaryVector);

    return hash % this.config.numShards;
  }

  /**
   * ベクトルのハッシュ値を計算
   *
   * @param vector - Float32Array
   * @returns ハッシュ値
   */
  private hashVector(vector: Float32Array): number {
    let hash = 0;

    for (let i = 0; i < vector.length; i++) {
      // 簡易的なハッシュ関数
      hash = (hash * 31 + Math.floor(vector[i] * 1000)) >>> 0;
    }

    return hash;
  }

  /**
   * シャードのセントロイド（中心ベクトル）を更新
   *
   * @param shardId - シャードID
   */
  private updateCentroid(shardId: number): void {
    const shard = this.shards.get(shardId);

    if (!shard || shard.itemCount === 0) {
      return;
    }

    const items = Array.from(shard.items.values());

    if (items.length === 0) {
      shard.vectorCentroid = null;
      return;
    }

    // 各レイヤーのセントロイドを計算
    const firstVector = items[0].vector;

    const centroid: MultiLayerVector = {
      subject: new Float32Array(firstVector.subject.length),
      attribute: new Float32Array(firstVector.attribute.length),
      style: new Float32Array(firstVector.style.length),
      composition: new Float32Array(firstVector.composition.length),
      emotion: new Float32Array(firstVector.emotion.length),
      relationMatrix: [],
      timestamp: new Date(),
    };

    // 各レイヤーの平均を計算
    for (const item of items) {
      this.addVector(centroid.subject, item.vector.subject);
      this.addVector(centroid.attribute, item.vector.attribute);
      this.addVector(centroid.style, item.vector.style);
      this.addVector(centroid.composition, item.vector.composition);
      this.addVector(centroid.emotion, item.vector.emotion);
    }

    // 平均化
    this.divideVector(centroid.subject, items.length);
    this.divideVector(centroid.attribute, items.length);
    this.divideVector(centroid.style, items.length);
    this.divideVector(centroid.composition, items.length);
    this.divideVector(centroid.emotion, items.length);

    shard.vectorCentroid = centroid;
  }

  /**
   * ベクトル加算
   *
   * @param target - 加算先ベクトル
   * @param source - 加算元ベクトル
   */
  private addVector(target: Float32Array, source: Float32Array): void {
    for (let i = 0; i < target.length; i++) {
      target[i] += source[i];
    }
  }

  /**
   * ベクトル除算（スカラー）
   *
   * @param vector - ベクトル
   * @param divisor - 除数
   */
  private divideVector(vector: Float32Array, divisor: number): void {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= divisor;
    }
  }

  /**
   * クエリベクトルと各シャードの類似度を計算
   *
   * @param queryVector - クエリベクトル
   * @returns シャード類似度の配列
   */
  private calculateShardSimilarities(
    queryVector: MultiLayerVector
  ): Array<{ shardId: number; similarity: number }> {
    const similarities: Array<{ shardId: number; similarity: number }> = [];

    for (const shard of this.shards.values()) {
      if (!shard.vectorCentroid || shard.itemCount === 0) {
        continue;
      }

      const similarity = this.calculateVectorSimilarity(queryVector, shard.vectorCentroid);

      similarities.push({
        shardId: shard.id,
        similarity,
      });
    }

    return similarities;
  }

  /**
   * 2つのマルチレイヤーベクトルの類似度を計算
   *
   * コサイン類似度の加重平均
   *
   * @param vec1 - ベクトル1
   * @param vec2 - ベクトル2
   * @returns 類似度 (0-1)
   */
  private calculateVectorSimilarity(vec1: MultiLayerVector, vec2: MultiLayerVector): number {
    const weights = {
      subject: 0.3,
      attribute: 0.25,
      style: 0.2,
      composition: 0.15,
      emotion: 0.1,
    };

    let totalSimilarity = 0;

    totalSimilarity += weights.subject * this.cosineSimilarity(vec1.subject, vec2.subject);
    totalSimilarity +=
      weights.attribute * this.cosineSimilarity(vec1.attribute, vec2.attribute);
    totalSimilarity += weights.style * this.cosineSimilarity(vec1.style, vec2.style);
    totalSimilarity +=
      weights.composition * this.cosineSimilarity(vec1.composition, vec2.composition);
    totalSimilarity += weights.emotion * this.cosineSimilarity(vec1.emotion, vec2.emotion);

    return totalSimilarity;
  }

  /**
   * コサイン類似度を計算
   *
   * @param vec1 - ベクトル1
   * @param vec2 - ベクトル2
   * @returns コサイン類似度 (-1 to 1)
   */
  private cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }

  /**
   * リバランスが必要かチェック
   *
   * @returns リバランスが必要な場合true
   */
  private needsRebalancing(): boolean {
    const counts = Array.from(this.shards.values()).map((s) => s.itemCount);
    const max = Math.max(...counts);
    const min = Math.min(...counts);

    return max - min > this.config.rebalanceThreshold;
  }

  /**
   * シャードをリバランス
   */
  private rebalance(): void {
    // 全アイテムを収集
    const allItems: CacheItem[] = [];

    for (const shard of this.shards.values()) {
      allItems.push(...Array.from(shard.items.values()));
      shard.items.clear();
      shard.itemCount = 0;
      shard.vectorCentroid = null;
    }

    // 再配置
    for (const item of allItems) {
      const shardId = this.calculateShardId(item.vector);
      const shard = this.shards.get(shardId);

      if (shard) {
        shard.items.set(item.id, item);
        shard.itemCount++;
      }
    }

    // すべてのセントロイドを更新
    for (let i = 0; i < this.config.numShards; i++) {
      this.updateCentroid(i);
    }
  }

  /**
   * 統計情報を取得
   *
   * @returns 統計情報
   */
  public getStatistics() {
    const shardStats = Array.from(this.shards.values()).map((shard) => ({
      id: shard.id,
      itemCount: shard.itemCount,
      hasCentroid: shard.vectorCentroid !== null,
    }));

    const totalItems = shardStats.reduce((sum, s) => sum + s.itemCount, 0);
    const avgItemsPerShard = totalItems / this.config.numShards;
    const maxItems = Math.max(...shardStats.map((s) => s.itemCount));
    const minItems = Math.min(...shardStats.map((s) => s.itemCount));

    return {
      numShards: this.config.numShards,
      totalItems,
      avgItemsPerShard,
      maxItems,
      minItems,
      imbalance: maxItems - minItems,
      shards: shardStats,
    };
  }

  /**
   * シャードをクリア
   */
  public clear(): void {
    for (const shard of this.shards.values()) {
      shard.items.clear();
      shard.itemCount = 0;
      shard.vectorCentroid = null;
    }
  }
}
