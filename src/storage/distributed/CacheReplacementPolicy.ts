/**
 * インテリジェント・キャッシュ置換ポリシー
 *
 * 評価基準:
 * - アクセス頻度 (Access Frequency)
 * - 生成難易度 (Generation Difficulty)
 * - 最終アクセス時刻 (Last Access Time)
 *
 * スコア = α * frequency + β * difficulty - γ * age
 */

import type { CacheItem } from '../../types/index.js';

/**
 * キャッシュアイテムの評価スコア
 */
export interface CacheScore {
  itemId: string;
  score: number;
  frequency: number;
  difficulty: number;
  age: number;
}

/**
 * キャッシュ置換ポリシーの設定
 */
export interface ReplacementPolicyConfig {
  /**
   * アクセス頻度の重み (α)
   */
  frequencyWeight: number;

  /**
   * 生成難易度の重み (β)
   */
  difficultyWeight: number;

  /**
   * 経過時間の重み (γ)
   */
  ageWeight: number;

  /**
   * 最大年齢（ミリ秒）
   */
  maxAgeMs: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: ReplacementPolicyConfig = {
  frequencyWeight: 0.4,
  difficultyWeight: 0.4,
  ageWeight: 0.2,
  maxAgeMs: 24 * 60 * 60 * 1000, // 24時間
};

/**
 * インテリジェント・キャッシュ置換ポリシー
 *
 * アクセス頻度、生成難易度、経過時間を統合的に評価して
 * 最適なキャッシュアイテムを選択します。
 */
export class CacheReplacementPolicy {
  private config: ReplacementPolicyConfig;

  constructor(config?: Partial<ReplacementPolicyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * キャッシュアイテムの評価スコアを計算
   *
   * @param item - 評価するキャッシュアイテム
   * @returns 評価スコア（高いほど重要）
   */
  public calculateScore(item: CacheItem): CacheScore {
    const now = Date.now();
    const lastAccessTime = item.lastAccess.getTime();
    const ageMs = now - lastAccessTime;

    // 正規化
    const normalizedFrequency = this.normalizeFrequency(item.accessCount);
    const normalizedDifficulty = this.normalizeDifficulty(item.generationDifficulty);
    const normalizedAge = this.normalizeAge(ageMs);

    // スコア計算: score = α * freq + β * diff - γ * age
    const score =
      this.config.frequencyWeight * normalizedFrequency +
      this.config.difficultyWeight * normalizedDifficulty -
      this.config.ageWeight * normalizedAge;

    return {
      itemId: item.id,
      score,
      frequency: normalizedFrequency,
      difficulty: normalizedDifficulty,
      age: normalizedAge,
    };
  }

  /**
   * 最も削除すべきアイテムを選択
   *
   * @param items - 候補アイテム群
   * @returns 削除すべきアイテムのID（スコアが最も低い）
   */
  public selectEvictionCandidate(items: CacheItem[]): string | null {
    if (items.length === 0) {
      return null;
    }

    let minScore = Infinity;
    let victimId: string | null = null;

    for (const item of items) {
      const { score, itemId } = this.calculateScore(item);
      if (score < minScore) {
        minScore = score;
        victimId = itemId;
      }
    }

    return victimId;
  }

  /**
   * 複数アイテムを削除対象として選択
   *
   * @param items - 候補アイテム群
   * @param count - 削除する数
   * @returns 削除すべきアイテムのID配列（スコアが低い順）
   */
  public selectEvictionCandidates(items: CacheItem[], count: number): string[] {
    if (items.length === 0 || count <= 0) {
      return [];
    }

    const scores = items.map((item) => this.calculateScore(item));

    // スコアの昇順でソート
    scores.sort((a, b) => a.score - b.score);

    return scores.slice(0, count).map((s) => s.itemId);
  }

  /**
   * アクセス頻度の正規化
   *
   * 対数スケールで正規化 (log-scale normalization)
   *
   * @param accessCount - アクセス回数
   * @returns 正規化されたアクセス頻度 [0, 1]
   */
  private normalizeFrequency(accessCount: number): number {
    // log(1 + x) を使用して、低頻度アクセスでも差がつくようにする
    return Math.log(1 + accessCount) / Math.log(1 + 1000);
  }

  /**
   * 生成難易度の正規化
   *
   * @param difficulty - 生成難易度 (0-1の範囲を想定)
   * @returns 正規化された難易度 [0, 1]
   */
  private normalizeDifficulty(difficulty: number): number {
    // すでに0-1の範囲と仮定
    return Math.max(0, Math.min(1, difficulty));
  }

  /**
   * 経過時間の正規化
   *
   * @param ageMs - 経過時間（ミリ秒）
   * @returns 正規化された経過時間 [0, 1]
   */
  private normalizeAge(ageMs: number): number {
    return Math.min(1, ageMs / this.config.maxAgeMs);
  }

  /**
   * 設定を更新
   *
   * @param config - 新しい設定
   */
  public updateConfig(config: Partial<ReplacementPolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   *
   * @returns 現在の設定
   */
  public getConfig(): ReplacementPolicyConfig {
    return { ...this.config };
  }
}
