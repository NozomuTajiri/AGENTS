/**
 * 予測プリフェッチシステム
 *
 * 使用パターンに基づいて次にアクセスされる可能性の高いアイテムを予測し、
 * 事前にL1キャッシュに読み込みます。
 *
 * 予測モデル:
 * P(item_i | context_c, history_h) = f(item_i, context_c, history_h; θprefetch)
 */

import type { CacheItem, QueryContext, UsageHistory } from '../../types/index.js';

/**
 * プリフェッチ予測結果
 */
export interface PrefetchPrediction {
  itemId: string;
  probability: number;
  confidence: number;
  reason: string;
}

/**
 * プリフェッチシステム設定
 */
export interface PrefetchConfig {
  /**
   * プリフェッチする最大アイテム数
   */
  maxPrefetchItems: number;

  /**
   * プリフェッチ確率の閾値
   */
  probabilityThreshold: number;

  /**
   * 履歴の最大保持数
   */
  maxHistorySize: number;

  /**
   * コンテキスト類似度の重み
   */
  contextWeight: number;

  /**
   * 使用履歴の重み
   */
  historyWeight: number;

  /**
   * 時系列パターンの重み
   */
  temporalWeight: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: PrefetchConfig = {
  maxPrefetchItems: 5,
  probabilityThreshold: 0.6,
  maxHistorySize: 1000,
  contextWeight: 0.4,
  historyWeight: 0.4,
  temporalWeight: 0.2,
};

/**
 * アクセスパターン
 */
interface AccessPattern {
  itemId: string;
  context: QueryContext;
  timestamp: Date;
  followingItems: string[]; // 次にアクセスされたアイテム
}

/**
 * 予測プリフェッチシステム
 */
export class PrefetchSystem {
  private config: PrefetchConfig;
  private accessHistory: AccessPattern[];
  private itemUsageMap: Map<string, number>;
  private sequencePatterns: Map<string, Map<string, number>>; // item1 -> item2 -> count

  constructor(config?: Partial<PrefetchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.accessHistory = [];
    this.itemUsageMap = new Map();
    this.sequencePatterns = new Map();
  }

  /**
   * アクセスパターンを記録
   *
   * @param itemId - アクセスされたアイテムID
   * @param context - クエリコンテキスト
   */
  public recordAccess(itemId: string, context: QueryContext): void {
    const now = new Date();

    // 使用回数を更新
    this.itemUsageMap.set(itemId, (this.itemUsageMap.get(itemId) || 0) + 1);

    // 履歴に追加
    const pattern: AccessPattern = {
      itemId,
      context,
      timestamp: now,
      followingItems: [],
    };

    // 前回のアクセスの次のアイテムとして記録
    if (this.accessHistory.length > 0) {
      const lastPattern = this.accessHistory[this.accessHistory.length - 1];

      // 同じセッション内かチェック（5分以内）
      const timeDiff = now.getTime() - lastPattern.timestamp.getTime();
      if (timeDiff < 5 * 60 * 1000) {
        lastPattern.followingItems.push(itemId);

        // シーケンスパターンを更新
        this.updateSequencePattern(lastPattern.itemId, itemId);
      }
    }

    this.accessHistory.push(pattern);

    // 履歴サイズの制限
    if (this.accessHistory.length > this.config.maxHistorySize) {
      this.accessHistory.shift();
    }
  }

  /**
   * 次にアクセスされる可能性の高いアイテムを予測
   *
   * @param currentItemId - 現在アクセスしているアイテムID
   * @param context - クエリコンテキスト
   * @param availableItems - 利用可能なアイテム
   * @returns プリフェッチ予測の配列
   */
  public predict(
    currentItemId: string,
    context: QueryContext,
    availableItems: CacheItem[]
  ): PrefetchPrediction[] {
    const predictions: PrefetchPrediction[] = [];

    for (const item of availableItems) {
      if (item.id === currentItemId) {
        continue; // 現在のアイテムはスキップ
      }

      const probability = this.calculateProbability(currentItemId, item.id, context);

      if (probability >= this.config.probabilityThreshold) {
        predictions.push({
          itemId: item.id,
          probability,
          confidence: this.calculateConfidence(item.id),
          reason: this.generateReason(currentItemId, item.id, context),
        });
      }
    }

    // 確率の降順でソート
    predictions.sort((a, b) => b.probability - a.probability);

    // 最大数まで返す
    return predictions.slice(0, this.config.maxPrefetchItems);
  }

  /**
   * アイテムがアクセスされる確率を計算
   *
   * P(item | current, context, history) =
   *   α * P_sequence(item | current) +
   *   β * P_context(item | context) +
   *   γ * P_history(item)
   *
   * @param currentItemId - 現在のアイテムID
   * @param targetItemId - 予測対象のアイテムID
   * @param context - クエリコンテキスト
   * @returns 確率 (0-1)
   */
  private calculateProbability(
    currentItemId: string,
    targetItemId: string,
    context: QueryContext
  ): number {
    const sequenceProb = this.calculateSequenceProbability(currentItemId, targetItemId);
    const contextProb = this.calculateContextProbability(targetItemId, context);
    const historyProb = this.calculateHistoryProbability(targetItemId);

    const probability =
      this.config.historyWeight * sequenceProb +
      this.config.contextWeight * contextProb +
      this.config.temporalWeight * historyProb;

    return Math.max(0, Math.min(1, probability));
  }

  /**
   * シーケンスパターンに基づく確率
   *
   * @param currentItemId - 現在のアイテムID
   * @param targetItemId - 予測対象のアイテムID
   * @returns 確率 (0-1)
   */
  private calculateSequenceProbability(currentItemId: string, targetItemId: string): number {
    const sequences = this.sequencePatterns.get(currentItemId);

    if (!sequences) {
      return 0;
    }

    const targetCount = sequences.get(targetItemId) || 0;
    const totalCount = Array.from(sequences.values()).reduce((sum, count) => sum + count, 0);

    return totalCount > 0 ? targetCount / totalCount : 0;
  }

  /**
   * コンテキスト類似度に基づく確率
   *
   * @param targetItemId - 予測対象のアイテムID
   * @param context - クエリコンテキスト
   * @returns 確率 (0-1)
   */
  private calculateContextProbability(targetItemId: string, context: QueryContext): number {
    // コンテキストが類似している過去のアクセスを検索
    let similarAccessCount = 0;
    let totalSimilarAccess = 0;

    for (const pattern of this.accessHistory) {
      const similarity = this.calculateContextSimilarity(pattern.context, context);

      if (similarity > 0.5) {
        totalSimilarAccess++;

        if (pattern.followingItems.includes(targetItemId)) {
          similarAccessCount++;
        }
      }
    }

    return totalSimilarAccess > 0 ? similarAccessCount / totalSimilarAccess : 0;
  }

  /**
   * 使用履歴に基づく確率
   *
   * @param targetItemId - 予測対象のアイテムID
   * @returns 確率 (0-1)
   */
  private calculateHistoryProbability(targetItemId: string): number {
    const usageCount = this.itemUsageMap.get(targetItemId) || 0;
    const maxUsage = Math.max(...Array.from(this.itemUsageMap.values()));

    return maxUsage > 0 ? usageCount / maxUsage : 0;
  }

  /**
   * コンテキストの類似度を計算
   *
   * @param context1 - コンテキスト1
   * @param context2 - コンテキスト2
   * @returns 類似度 (0-1)
   */
  private calculateContextSimilarity(context1: QueryContext, context2: QueryContext): number {
    let similarity = 0;
    let factors = 0;

    // ユーザーID
    if (context1.userId && context2.userId) {
      similarity += context1.userId === context2.userId ? 1 : 0;
      factors++;
    }

    // セッションID
    if (context1.sessionId && context2.sessionId) {
      similarity += context1.sessionId === context2.sessionId ? 1 : 0;
      factors++;
    }

    // 時間帯（1時間以内を類似とみなす）
    if (context1.timeOfDay !== undefined && context2.timeOfDay !== undefined) {
      const timeDiff = Math.abs(context1.timeOfDay - context2.timeOfDay);
      similarity += timeDiff <= 1 ? 1 : 0;
      factors++;
    }

    // プロンプト履歴の重複
    const promptOverlap = this.calculateArrayOverlap(
      context1.previousPrompts,
      context2.previousPrompts
    );
    similarity += promptOverlap;
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * 配列の重複度を計算
   *
   * @param arr1 - 配列1
   * @param arr2 - 配列2
   * @returns 重複度 (0-1)
   */
  private calculateArrayOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 && arr2.length === 0) {
      return 1;
    }

    const set1 = new Set(arr1);
    const set2 = new Set(arr2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 予測の信頼度を計算
   *
   * @param itemId - アイテムID
   * @returns 信頼度 (0-1)
   */
  private calculateConfidence(itemId: string): number {
    // データ量に基づいて信頼度を計算
    const usageCount = this.itemUsageMap.get(itemId) || 0;
    const historySize = this.accessHistory.length;

    // データが多いほど信頼度が高い
    const dataSufficiency = Math.min(1, historySize / 100);
    const itemFrequency = Math.min(1, usageCount / 10);

    return (dataSufficiency + itemFrequency) / 2;
  }

  /**
   * 予測理由を生成
   *
   * @param currentItemId - 現在のアイテムID
   * @param targetItemId - 予測対象のアイテムID
   * @param context - クエリコンテキスト
   * @returns 理由の説明
   */
  private generateReason(
    currentItemId: string,
    targetItemId: string,
    context: QueryContext
  ): string {
    const sequenceProb = this.calculateSequenceProbability(currentItemId, targetItemId);
    const usageCount = this.itemUsageMap.get(targetItemId) || 0;

    if (sequenceProb > 0.5) {
      return `Frequently accessed after ${currentItemId} (${(sequenceProb * 100).toFixed(1)}%)`;
    } else if (usageCount > 50) {
      return `Highly popular item (accessed ${usageCount} times)`;
    } else if (context.userId) {
      return `Based on user ${context.userId}'s access pattern`;
    } else {
      return 'General usage pattern match';
    }
  }

  /**
   * シーケンスパターンを更新
   *
   * @param fromItemId - 元のアイテムID
   * @param toItemId - 次のアイテムID
   */
  private updateSequencePattern(fromItemId: string, toItemId: string): void {
    if (!this.sequencePatterns.has(fromItemId)) {
      this.sequencePatterns.set(fromItemId, new Map());
    }

    const sequences = this.sequencePatterns.get(fromItemId)!;
    sequences.set(toItemId, (sequences.get(toItemId) || 0) + 1);
  }

  /**
   * 統計情報を取得
   *
   * @returns 統計情報
   */
  public getStatistics() {
    return {
      totalAccessPatterns: this.accessHistory.length,
      uniqueItems: this.itemUsageMap.size,
      sequencePatterns: this.sequencePatterns.size,
      averageSequenceLength:
        this.accessHistory.reduce((sum, p) => sum + p.followingItems.length, 0) /
        Math.max(1, this.accessHistory.length),
    };
  }

  /**
   * 設定を更新
   *
   * @param config - 新しい設定
   */
  public updateConfig(config: Partial<PrefetchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 履歴をクリア
   */
  public clearHistory(): void {
    this.accessHistory = [];
    this.itemUsageMap.clear();
    this.sequencePatterns.clear();
  }
}
