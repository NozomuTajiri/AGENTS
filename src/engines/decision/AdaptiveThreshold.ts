/**
 * 適応的閾値管理モジュール
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import { FeedbackData } from '../../types/index.js';

/**
 * 閾値設定
 */
export interface ThresholdConfig {
  /** キャッシュヒット閾値（類似度 ≥ threshold1: キャッシュから取得） */
  cacheHit: number;

  /** 差分生成閾値（threshold2 ≤ 類似度 < threshold1: 差分生成） */
  diffGeneration: number;

  /** 新規生成閾値（類似度 < threshold2: 新規生成） */
  newGeneration: number;
}

/**
 * 閾値統計情報
 */
export interface ThresholdStatistics {
  /** 各アクションの実行回数 */
  actionCounts: {
    cacheHit: number;
    diffGeneration: number;
    newGeneration: number;
  };

  /** 各アクションの成功率 */
  successRates: {
    cacheHit: number;
    diffGeneration: number;
    newGeneration: number;
  };

  /** 平均レイテンシ（ミリ秒） */
  averageLatency: {
    cacheHit: number;
    diffGeneration: number;
    newGeneration: number;
  };

  /** 最終更新時刻 */
  lastUpdate: Date;
}

/**
 * 適応的閾値管理器
 *
 * フィードバックに基づいて閾値を動的に調整
 */
export class AdaptiveThreshold {
  private thresholds: ThresholdConfig;
  private statistics: ThresholdStatistics;
  private feedbackHistory: FeedbackData[] = [];

  constructor(initialThresholds?: Partial<ThresholdConfig>) {
    // デフォルト閾値
    this.thresholds = {
      cacheHit: 0.85,
      diffGeneration: 0.65,
      newGeneration: 0.0,
      ...initialThresholds,
    };

    this.statistics = {
      actionCounts: { cacheHit: 0, diffGeneration: 0, newGeneration: 0 },
      successRates: { cacheHit: 0, diffGeneration: 0, newGeneration: 0 },
      averageLatency: { cacheHit: 0, diffGeneration: 0, newGeneration: 0 },
      lastUpdate: new Date(),
    };
  }

  /**
   * 類似度に基づいてアクションを決定
   */
  decideAction(similarity: number): 'cache_hit' | 'diff_generation' | 'new_generation' {
    if (similarity >= this.thresholds.cacheHit) {
      return 'cache_hit';
    } else if (similarity >= this.thresholds.diffGeneration) {
      return 'diff_generation';
    } else {
      return 'new_generation';
    }
  }

  /**
   * フィードバックを追加
   */
  addFeedback(feedback: FeedbackData): void {
    this.feedbackHistory.push(feedback);

    // 一定数を超えたら古いものを削除
    const maxHistory = 1000;
    if (this.feedbackHistory.length > maxHistory) {
      this.feedbackHistory = this.feedbackHistory.slice(-maxHistory);
    }
  }

  /**
   * 統計情報を更新
   */
  private updateStatistics(): void {
    const counts = { cacheHit: 0, diffGeneration: 0, newGeneration: 0 };
    const successCounts = { cacheHit: 0, diffGeneration: 0, newGeneration: 0 };
    const latencySum = { cacheHit: 0, diffGeneration: 0, newGeneration: 0 };

    this.feedbackHistory.forEach(feedback => {
      // フィードバックからアクション種別を推定
      // 実際の実装では、DecisionResultに含まれる情報を使用
      const action = this.estimateAction(feedback);

      counts[action]++;

      if (feedback.explicit === 'accepted') {
        successCounts[action]++;
      }

      // レイテンシは implicit.dwellTime から推定
      latencySum[action] += feedback.implicit.dwellTime;
    });

    // 成功率を計算
    const successRates = {
      cacheHit: counts.cacheHit > 0 ? successCounts.cacheHit / counts.cacheHit : 0,
      diffGeneration: counts.diffGeneration > 0 ? successCounts.diffGeneration / counts.diffGeneration : 0,
      newGeneration: counts.newGeneration > 0 ? successCounts.newGeneration / counts.newGeneration : 0,
    };

    // 平均レイテンシを計算
    const averageLatency = {
      cacheHit: counts.cacheHit > 0 ? latencySum.cacheHit / counts.cacheHit : 0,
      diffGeneration: counts.diffGeneration > 0 ? latencySum.diffGeneration / counts.diffGeneration : 0,
      newGeneration: counts.newGeneration > 0 ? latencySum.newGeneration / counts.newGeneration : 0,
    };

    this.statistics = {
      actionCounts: counts,
      successRates,
      averageLatency,
      lastUpdate: new Date(),
    };
  }

  /**
   * フィードバックからアクション種別を推定
   * （実際の実装では DecisionResult から取得）
   */
  private estimateAction(feedback: FeedbackData): 'cacheHit' | 'diffGeneration' | 'newGeneration' {
    // regenerationCount が 0 ならキャッシュヒット、1なら差分生成、2以上なら新規生成と推定
    if (feedback.implicit.regenerationCount === 0) {
      return 'cacheHit';
    } else if (feedback.implicit.regenerationCount === 1) {
      return 'diffGeneration';
    } else {
      return 'newGeneration';
    }
  }

  /**
   * 閾値を最適化
   *
   * 目標:
   * - キャッシュヒット率を最大化
   * - ユーザー満足度（成功率）を最大化
   * - レイテンシを最小化
   */
  optimize(): void {
    if (this.feedbackHistory.length < 50) {
      return; // データが不足している場合はスキップ
    }

    this.updateStatistics();

    const { successRates, actionCounts } = this.statistics;

    // キャッシュヒットの成功率が低い場合、閾値を上げる（より保守的に）
    if (actionCounts.cacheHit > 10 && successRates.cacheHit < 0.7) {
      this.thresholds.cacheHit = Math.min(0.95, this.thresholds.cacheHit + 0.02);
    }

    // キャッシュヒットの成功率が高い場合、閾値を下げる（より積極的に）
    if (actionCounts.cacheHit > 10 && successRates.cacheHit > 0.9) {
      this.thresholds.cacheHit = Math.max(0.75, this.thresholds.cacheHit - 0.01);
    }

    // 差分生成の成功率が低い場合、閾値を上げる
    if (actionCounts.diffGeneration > 10 && successRates.diffGeneration < 0.6) {
      this.thresholds.diffGeneration = Math.min(
        this.thresholds.cacheHit - 0.05,
        this.thresholds.diffGeneration + 0.02
      );
    }

    // 差分生成の成功率が高い場合、閾値を下げる
    if (actionCounts.diffGeneration > 10 && successRates.diffGeneration > 0.85) {
      this.thresholds.diffGeneration = Math.max(0.5, this.thresholds.diffGeneration - 0.01);
    }

    // 閾値の整合性を保証（cacheHit > diffGeneration > newGeneration）
    this.ensureThresholdConsistency();
  }

  /**
   * 閾値の整合性を保証
   */
  private ensureThresholdConsistency(): void {
    if (this.thresholds.diffGeneration >= this.thresholds.cacheHit) {
      this.thresholds.diffGeneration = this.thresholds.cacheHit - 0.05;
    }

    if (this.thresholds.newGeneration >= this.thresholds.diffGeneration) {
      this.thresholds.newGeneration = this.thresholds.diffGeneration - 0.05;
    }

    // 下限チェック
    this.thresholds.cacheHit = Math.max(0.7, this.thresholds.cacheHit);
    this.thresholds.diffGeneration = Math.max(0.4, this.thresholds.diffGeneration);
    this.thresholds.newGeneration = Math.max(0.0, this.thresholds.newGeneration);
  }

  /**
   * 現在の閾値を取得
   */
  getThresholds(): ThresholdConfig {
    return { ...this.thresholds };
  }

  /**
   * 閾値を設定
   */
  setThresholds(thresholds: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.ensureThresholdConsistency();
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): ThresholdStatistics {
    this.updateStatistics();
    return { ...this.statistics };
  }

  /**
   * フィードバック履歴をクリア
   */
  clearFeedback(): void {
    this.feedbackHistory = [];
  }

  /**
   * 閾値をリセット
   */
  reset(): void {
    this.thresholds = {
      cacheHit: 0.85,
      diffGeneration: 0.65,
      newGeneration: 0.0,
    };

    this.statistics = {
      actionCounts: { cacheHit: 0, diffGeneration: 0, newGeneration: 0 },
      successRates: { cacheHit: 0, diffGeneration: 0, newGeneration: 0 },
      averageLatency: { cacheHit: 0, diffGeneration: 0, newGeneration: 0 },
      lastUpdate: new Date(),
    };

    this.clearFeedback();
  }
}
