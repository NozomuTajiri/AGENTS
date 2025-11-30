/**
 * 階層型ストレージレイヤー
 *
 * 4層キャッシュ構造:
 * - L1: メモリキャッシュ（最頻使用）
 * - L2: Map（定期的使用）
 * - L3: Map（散発的使用）
 * - Cold: Map（稀にアクセス）
 */

import type { StorageLayer, StorageLevel, CacheItem } from '../../types/index.js';
import { CacheReplacementPolicy } from './CacheReplacementPolicy.js';

/**
 * レイヤー設定
 */
export interface LayerConfig {
  level: StorageLevel;
  capacity: number; // バイト単位
  latency: number; // ミリ秒単位
}

/**
 * デフォルトのレイヤー設定
 */
const DEFAULT_LAYER_CONFIGS: Record<StorageLevel, LayerConfig> = {
  L1: {
    level: 'L1',
    capacity: 100 * 1024 * 1024, // 100MB
    latency: 1,
  },
  L2: {
    level: 'L2',
    capacity: 500 * 1024 * 1024, // 500MB
    latency: 5,
  },
  L3: {
    level: 'L3',
    capacity: 2 * 1024 * 1024 * 1024, // 2GB
    latency: 10,
  },
  cold: {
    level: 'cold',
    capacity: 10 * 1024 * 1024 * 1024, // 10GB
    latency: 50,
  },
};

/**
 * メモリ制約
 */
const MEMORY_USAGE_LIMIT = 0.92; // 92%

/**
 * ストレージレイヤー実装
 */
export class StorageLayerImpl implements StorageLayer {
  public level: StorageLevel;
  public capacity: number;
  public currentUsage: number;
  public latency: number;
  public items: Map<string, CacheItem>;

  private replacementPolicy: CacheReplacementPolicy;

  constructor(config: LayerConfig, replacementPolicy?: CacheReplacementPolicy) {
    this.level = config.level;
    this.capacity = config.capacity;
    this.currentUsage = 0;
    this.latency = config.latency;
    this.items = new Map();
    this.replacementPolicy = replacementPolicy || new CacheReplacementPolicy();
  }

  /**
   * アイテムを追加
   *
   * @param item - 追加するアイテム
   * @returns 成功した場合true
   */
  public add(item: CacheItem): boolean {
    const itemSize = this.calculateItemSize(item);

    // 容量チェック
    if (this.currentUsage + itemSize > this.capacity * MEMORY_USAGE_LIMIT) {
      // 容量不足の場合、削除候補を選択
      if (!this.evict(itemSize)) {
        return false;
      }
    }

    // アイテムを追加
    this.items.set(item.id, item);
    this.currentUsage += itemSize;

    return true;
  }

  /**
   * アイテムを取得
   *
   * @param id - アイテムID
   * @returns アイテム（存在しない場合はundefined）
   */
  public get(id: string): CacheItem | undefined {
    const item = this.items.get(id);

    if (item) {
      // アクセス統計を更新
      item.accessCount++;
      item.lastAccess = new Date();
    }

    return item;
  }

  /**
   * アイテムを削除
   *
   * @param id - アイテムID
   * @returns 削除された場合true
   */
  public remove(id: string): boolean {
    const item = this.items.get(id);

    if (!item) {
      return false;
    }

    const itemSize = this.calculateItemSize(item);
    this.items.delete(id);
    this.currentUsage -= itemSize;

    return true;
  }

  /**
   * すべてのアイテムを取得
   *
   * @returns アイテムの配列
   */
  public getAll(): CacheItem[] {
    return Array.from(this.items.values());
  }

  /**
   * レイヤーをクリア
   */
  public clear(): void {
    this.items.clear();
    this.currentUsage = 0;
  }

  /**
   * 使用率を取得
   *
   * @returns 使用率 (0-1)
   */
  public getUsageRatio(): number {
    return this.currentUsage / this.capacity;
  }

  /**
   * 空き容量を取得
   *
   * @returns 空き容量（バイト）
   */
  public getAvailableCapacity(): number {
    return this.capacity - this.currentUsage;
  }

  /**
   * アイテムが存在するかチェック
   *
   * @param id - アイテムID
   * @returns 存在する場合true
   */
  public has(id: string): boolean {
    return this.items.has(id);
  }

  /**
   * アイテム数を取得
   *
   * @returns アイテム数
   */
  public size(): number {
    return this.items.size;
  }

  /**
   * 容量を確保するためにアイテムを削除
   *
   * @param requiredSize - 必要なサイズ（バイト）
   * @returns 成功した場合true
   */
  private evict(requiredSize: number): boolean {
    const itemsArray = Array.from(this.items.values());

    if (itemsArray.length === 0) {
      return false;
    }

    // 削除対象を選択
    let freedSize = 0;
    const evictionCandidates: string[] = [];

    // 必要なサイズが確保できるまで削除候補を追加
    while (freedSize < requiredSize && evictionCandidates.length < itemsArray.length) {
      const victimId = this.replacementPolicy.selectEvictionCandidate(
        itemsArray.filter((item) => !evictionCandidates.includes(item.id))
      );

      if (!victimId) {
        break;
      }

      const victim = this.items.get(victimId);
      if (victim) {
        freedSize += this.calculateItemSize(victim);
        evictionCandidates.push(victimId);
      }
    }

    // 削除実行
    for (const id of evictionCandidates) {
      this.remove(id);
    }

    return freedSize >= requiredSize;
  }

  /**
   * アイテムのサイズを計算
   *
   * @param item - アイテム
   * @returns サイズ（バイト）
   */
  private calculateItemSize(item: CacheItem): number {
    // 画像サイズ + メタデータのおおよそのサイズ
    const imageSize = item.image.length;
    const metadataSize = JSON.stringify(item.metadata).length;
    const vectorSize = this.calculateVectorSize(item.vector);

    return imageSize + metadataSize + vectorSize;
  }

  /**
   * ベクトルのサイズを計算
   *
   * @param vector - マルチレイヤーベクトル
   * @returns サイズ（バイト）
   */
  private calculateVectorSize(vector: any): number {
    // Float32Array のサイズ = 要素数 * 4バイト
    let size = 0;

    if (vector.subject) size += vector.subject.length * 4;
    if (vector.attribute) size += vector.attribute.length * 4;
    if (vector.style) size += vector.style.length * 4;
    if (vector.composition) size += vector.composition.length * 4;
    if (vector.emotion) size += vector.emotion.length * 4;

    // relationMatrix のサイズ
    if (vector.relationMatrix) {
      size += vector.relationMatrix.length * vector.relationMatrix[0].length * 8;
    }

    return size;
  }
}

/**
 * 階層型ストレージマネージャー
 */
export class HierarchicalStorageManager {
  private layers: Map<StorageLevel, StorageLayerImpl>;

  constructor(configs?: Partial<Record<StorageLevel, LayerConfig>>) {
    this.layers = new Map();

    const finalConfigs = { ...DEFAULT_LAYER_CONFIGS, ...configs };

    // 各レイヤーを初期化
    for (const [level, config] of Object.entries(finalConfigs)) {
      this.layers.set(level as StorageLevel, new StorageLayerImpl(config));
    }
  }

  /**
   * レイヤーを取得
   *
   * @param level - ストレージレベル
   * @returns ストレージレイヤー
   */
  public getLayer(level: StorageLevel): StorageLayerImpl | undefined {
    return this.layers.get(level);
  }

  /**
   * すべてのレイヤーを取得
   *
   * @returns レイヤーの配列
   */
  public getAllLayers(): StorageLayerImpl[] {
    return Array.from(this.layers.values());
  }

  /**
   * アイテムを適切なレイヤーに配置
   *
   * @param item - アイテム
   * @param level - 配置先レベル（指定しない場合は自動判定）
   * @returns 成功した場合true
   */
  public placeItem(item: CacheItem, level?: StorageLevel): boolean {
    const targetLevel = level || this.determineOptimalLevel(item);
    const layer = this.layers.get(targetLevel);

    if (!layer) {
      return false;
    }

    // アイテムのストレージレベルを更新
    item.storageLevel = targetLevel;

    return layer.add(item);
  }

  /**
   * アイテムを検索（全レイヤーから）
   *
   * @param id - アイテムID
   * @returns アイテムとレイヤー
   */
  public findItem(id: string): { item: CacheItem; layer: StorageLayerImpl } | null {
    // L1 -> L2 -> L3 -> cold の順に検索
    const levels: StorageLevel[] = ['L1', 'L2', 'L3', 'cold'];

    for (const level of levels) {
      const layer = this.layers.get(level);
      if (layer) {
        const item = layer.get(id);
        if (item) {
          return { item, layer };
        }
      }
    }

    return null;
  }

  /**
   * アイテムを昇格（より高速なレイヤーへ移動）
   *
   * @param id - アイテムID
   * @returns 成功した場合true
   */
  public promoteItem(id: string): boolean {
    const found = this.findItem(id);

    if (!found) {
      return false;
    }

    const { item, layer } = found;
    const currentLevel = layer.level;

    // 昇格先を決定
    const targetLevel = this.getPromotionTarget(currentLevel);

    if (!targetLevel || targetLevel === currentLevel) {
      return false;
    }

    const targetLayer = this.layers.get(targetLevel);

    if (!targetLayer) {
      return false;
    }

    // 移動
    layer.remove(id);
    item.storageLevel = targetLevel;

    return targetLayer.add(item);
  }

  /**
   * 最適なストレージレベルを判定
   *
   * @param item - アイテム
   * @returns 最適なストレージレベル
   */
  private determineOptimalLevel(item: CacheItem): StorageLevel {
    // アクセス頻度に基づいて判定
    if (item.accessCount > 100) {
      return 'L1';
    } else if (item.accessCount > 10) {
      return 'L2';
    } else if (item.accessCount > 1) {
      return 'L3';
    } else {
      return 'cold';
    }
  }

  /**
   * 昇格先レベルを取得
   *
   * @param currentLevel - 現在のレベル
   * @returns 昇格先レベル（昇格不可の場合はundefined）
   */
  private getPromotionTarget(currentLevel: StorageLevel): StorageLevel | undefined {
    const promotionMap: Record<StorageLevel, StorageLevel | undefined> = {
      cold: 'L3',
      L3: 'L2',
      L2: 'L1',
      L1: undefined,
    };

    return promotionMap[currentLevel];
  }

  /**
   * 全レイヤーの統計情報を取得
   *
   * @returns 統計情報
   */
  public getStatistics() {
    const stats = {
      layers: {} as Record<
        StorageLevel,
        {
          itemCount: number;
          usageRatio: number;
          currentUsage: number;
          capacity: number;
        }
      >,
      totalItems: 0,
      totalUsage: 0,
      totalCapacity: 0,
    };

    for (const [level, layer] of this.layers) {
      stats.layers[level] = {
        itemCount: layer.size(),
        usageRatio: layer.getUsageRatio(),
        currentUsage: layer.currentUsage,
        capacity: layer.capacity,
      };

      stats.totalItems += layer.size();
      stats.totalUsage += layer.currentUsage;
      stats.totalCapacity += layer.capacity;
    }

    return stats;
  }
}
