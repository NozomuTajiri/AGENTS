/**
 * 不確実性定量化モジュール
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import { SimilarityMetrics } from '../../types/index.js';

/**
 * 不確実性定量化結果
 */
export interface UncertaintyResult {
  /** 不確実性スコア（0-1、高いほど不確実） */
  uncertainty: number;

  /** 信頼度スコア（0-1、高いほど信頼できる） */
  confidence: number;

  /** 統計情報 */
  statistics: {
    mean: number;
    variance: number;
    stdDev: number;
    range: number;
  };

  /** 個別指標の寄与度 */
  contributions: {
    cosine: number;
    semanticTree: number;
    latentSemantic: number;
    contextualCoherence: number;
  };
}

/**
 * 不確実性定量化器
 *
 * 複数の類似度指標のばらつきから不確実性を定量化
 * 計算式: uncertainty = variance([sim_cos, sim_tree, sim_lsa, sim_context])
 */
export class UncertaintyQuantifier {
  /**
   * 平均値を計算
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * 分散を計算
   */
  private variance(values: number[]): number {
    const avg = this.mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    return this.mean(squaredDiffs);
  }

  /**
   * 標準偏差を計算
   */
  private stdDev(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  /**
   * 範囲（最大値 - 最小値）を計算
   */
  private range(values: number[]): number {
    return Math.max(...values) - Math.min(...values);
  }

  /**
   * エントロピーベースの不確実性を計算
   */
  private calculateEntropy(values: number[]): number {
    // 値を正規化してヒストグラムを作成
    const bins = 10;
    const histogram = new Array(bins).fill(0);

    values.forEach(val => {
      const bin = Math.min(bins - 1, Math.floor(val * bins));
      histogram[bin]++;
    });

    // 確率分布に変換
    const probabilities = histogram.map(count => count / values.length);

    // エントロピーを計算
    let entropy = 0;
    probabilities.forEach(p => {
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    });

    // 0-1の範囲に正規化
    return entropy / Math.log2(bins);
  }

  /**
   * 各指標の寄与度を計算
   */
  private calculateContributions(metrics: SimilarityMetrics): {
    cosine: number;
    semanticTree: number;
    latentSemantic: number;
    contextualCoherence: number;
  } {
    const values = [
      metrics.cosine,
      metrics.semanticTree,
      metrics.latentSemantic,
      metrics.contextualCoherence,
    ];

    const avg = this.mean(values);

    // 各指標の平均からの偏差を寄与度とする
    const totalDeviation = values.reduce((sum, val) => sum + Math.abs(val - avg), 0);

    return {
      cosine: Math.abs(metrics.cosine - avg) / totalDeviation,
      semanticTree: Math.abs(metrics.semanticTree - avg) / totalDeviation,
      latentSemantic: Math.abs(metrics.latentSemantic - avg) / totalDeviation,
      contextualCoherence: Math.abs(metrics.contextualCoherence - avg) / totalDeviation,
    };
  }

  /**
   * 不確実性を定量化
   */
  quantify(metrics: SimilarityMetrics): UncertaintyResult {
    const values = [
      metrics.cosine,
      metrics.semanticTree,
      metrics.latentSemantic,
      metrics.contextualCoherence,
    ];

    const meanValue = this.mean(values);
    const varianceValue = this.variance(values);
    const stdDevValue = this.stdDev(values);
    const rangeValue = this.range(values);

    // 複数の要素を組み合わせて不確実性を計算
    // - 分散が大きい → 不確実性が高い
    // - 範囲が広い → 不確実性が高い
    // - エントロピーが高い → 不確実性が高い
    const varianceComponent = Math.min(1, varianceValue * 4); // 0-1に正規化
    const rangeComponent = rangeValue; // すでに0-1の範囲
    const entropyComponent = this.calculateEntropy(values);

    const uncertainty = (varianceComponent + rangeComponent + entropyComponent) / 3;

    // 信頼度は不確実性の逆数
    const confidence = 1 - uncertainty;

    return {
      uncertainty,
      confidence,
      statistics: {
        mean: meanValue,
        variance: varianceValue,
        stdDev: stdDevValue,
        range: rangeValue,
      },
      contributions: this.calculateContributions(metrics),
    };
  }

  /**
   * 不確実性が高いかどうかを判定
   */
  isHighUncertainty(uncertainty: number, threshold: number = 0.5): boolean {
    return uncertainty > threshold;
  }

  /**
   * 信頼度が低いかどうかを判定
   */
  isLowConfidence(confidence: number, threshold: number = 0.5): boolean {
    return confidence < threshold;
  }
}
