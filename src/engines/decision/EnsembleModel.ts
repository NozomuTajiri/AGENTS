/**
 * アンサンブル決定モデル
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import { SimilarityMetrics } from '../../types/index.js';

/**
 * アンサンブルモデルのパラメータ
 */
export interface EnsembleParameters {
  /** 各指標の重み */
  weights: {
    cosine: number;
    semanticTree: number;
    latentSemantic: number;
    contextualCoherence: number;
  };

  /** バイアス項 */
  bias: number;

  /** 正則化係数（過学習防止） */
  regularization: number;
}

/**
 * フィードバックサンプル
 */
export interface FeedbackSample {
  metrics: SimilarityMetrics;
  groundTruth: number; // 実際の類似度（0-1）
  timestamp: Date;
}

/**
 * アンサンブル決定モデル
 *
 * 複数の類似度スコアを統合し、最終的な類似度を計算
 * 計算式: final_similarity = f(sim_cos, sim_tree, sim_lsa, sim_context; θ)
 */
export class EnsembleModel {
  private parameters: EnsembleParameters;
  private feedbackHistory: FeedbackSample[] = [];

  constructor(initialParameters?: Partial<EnsembleParameters>) {
    // デフォルトパラメータ
    this.parameters = {
      weights: {
        cosine: 0.35,
        semanticTree: 0.25,
        latentSemantic: 0.20,
        contextualCoherence: 0.20,
      },
      bias: 0,
      regularization: 0.01,
      ...initialParameters,
    };

    // 重みの合計を1に正規化
    this.normalizeWeights();
  }

  /**
   * 重みを正規化
   */
  private normalizeWeights(): void {
    const sum =
      this.parameters.weights.cosine +
      this.parameters.weights.semanticTree +
      this.parameters.weights.latentSemantic +
      this.parameters.weights.contextualCoherence;

    if (sum > 0) {
      this.parameters.weights.cosine /= sum;
      this.parameters.weights.semanticTree /= sum;
      this.parameters.weights.latentSemantic /= sum;
      this.parameters.weights.contextualCoherence /= sum;
    }
  }

  /**
   * 重み付き線形結合による類似度計算
   */
  private linearCombination(metrics: SimilarityMetrics): number {
    return (
      metrics.cosine * this.parameters.weights.cosine +
      metrics.semanticTree * this.parameters.weights.semanticTree +
      metrics.latentSemantic * this.parameters.weights.latentSemantic +
      metrics.contextualCoherence * this.parameters.weights.contextualCoherence +
      this.parameters.bias
    );
  }

  /**
   * シグモイド関数（0-1の範囲に制限）
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * 最終的な類似度を計算
   */
  predict(metrics: SimilarityMetrics): number {
    const rawScore = this.linearCombination(metrics);

    // シグモイド関数で0-1の範囲に正規化
    return this.sigmoid(rawScore);
  }

  /**
   * フィードバックを追加
   */
  addFeedback(metrics: SimilarityMetrics, groundTruth: number): void {
    this.feedbackHistory.push({
      metrics,
      groundTruth,
      timestamp: new Date(),
    });

    // 一定数を超えたら古いものを削除
    const maxHistory = 1000;
    if (this.feedbackHistory.length > maxHistory) {
      this.feedbackHistory = this.feedbackHistory.slice(-maxHistory);
    }
  }

  /**
   * 平均二乗誤差（MSE）を計算
   */
  private calculateMSE(samples: FeedbackSample[]): number {
    if (samples.length === 0) return 0;

    let sumSquaredError = 0;
    samples.forEach(sample => {
      const predicted = this.predict(sample.metrics);
      const error = predicted - sample.groundTruth;
      sumSquaredError += error * error;
    });

    return sumSquaredError / samples.length;
  }

  /**
   * 勾配を計算（確率的勾配降下法）
   */
  private calculateGradient(sample: FeedbackSample): Partial<EnsembleParameters> {
    const predicted = this.predict(sample.metrics);
    const error = predicted - sample.groundTruth;

    // シグモイドの微分: σ'(x) = σ(x) * (1 - σ(x))
    const sigmoidDerivative = predicted * (1 - predicted);

    const gradient: Partial<EnsembleParameters> = {
      weights: {
        cosine: error * sigmoidDerivative * sample.metrics.cosine,
        semanticTree: error * sigmoidDerivative * sample.metrics.semanticTree,
        latentSemantic: error * sigmoidDerivative * sample.metrics.latentSemantic,
        contextualCoherence: error * sigmoidDerivative * sample.metrics.contextualCoherence,
      },
      bias: error * sigmoidDerivative,
    };

    return gradient;
  }

  /**
   * パラメータを最適化（オンライン学習）
   */
  optimize(learningRate: number = 0.01, batchSize: number = 32): void {
    if (this.feedbackHistory.length < batchSize) {
      return; // データが不足している場合はスキップ
    }

    // ミニバッチをランダムサンプリング
    const batch: FeedbackSample[] = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * this.feedbackHistory.length);
      batch.push(this.feedbackHistory[idx]);
    }

    // 勾配の平均を計算
    const avgGradient: EnsembleParameters = {
      weights: { cosine: 0, semanticTree: 0, latentSemantic: 0, contextualCoherence: 0 },
      bias: 0,
      regularization: this.parameters.regularization,
    };

    batch.forEach(sample => {
      const grad = this.calculateGradient(sample);
      if (grad.weights) {
        avgGradient.weights.cosine += grad.weights.cosine;
        avgGradient.weights.semanticTree += grad.weights.semanticTree;
        avgGradient.weights.latentSemantic += grad.weights.latentSemantic;
        avgGradient.weights.contextualCoherence += grad.weights.contextualCoherence;
      }
      if (grad.bias !== undefined) {
        avgGradient.bias += grad.bias;
      }
    });

    avgGradient.weights.cosine /= batchSize;
    avgGradient.weights.semanticTree /= batchSize;
    avgGradient.weights.latentSemantic /= batchSize;
    avgGradient.weights.contextualCoherence /= batchSize;
    avgGradient.bias /= batchSize;

    // L2正則化項を追加（過学習防止）
    const reg = this.parameters.regularization;
    avgGradient.weights.cosine += reg * this.parameters.weights.cosine;
    avgGradient.weights.semanticTree += reg * this.parameters.weights.semanticTree;
    avgGradient.weights.latentSemantic += reg * this.parameters.weights.latentSemantic;
    avgGradient.weights.contextualCoherence += reg * this.parameters.weights.contextualCoherence;

    // パラメータを更新
    this.parameters.weights.cosine -= learningRate * avgGradient.weights.cosine;
    this.parameters.weights.semanticTree -= learningRate * avgGradient.weights.semanticTree;
    this.parameters.weights.latentSemantic -= learningRate * avgGradient.weights.latentSemantic;
    this.parameters.weights.contextualCoherence -= learningRate * avgGradient.weights.contextualCoherence;
    this.parameters.bias -= learningRate * avgGradient.bias;

    // 重みを正規化
    this.normalizeWeights();
  }

  /**
   * モデルの性能を評価
   */
  evaluate(): { mse: number; accuracy: number } {
    if (this.feedbackHistory.length === 0) {
      return { mse: 0, accuracy: 0 };
    }

    const mse = this.calculateMSE(this.feedbackHistory);

    // 精度を計算（予測と真値の差が0.1以内なら正解とする）
    let correctCount = 0;
    this.feedbackHistory.forEach(sample => {
      const predicted = this.predict(sample.metrics);
      if (Math.abs(predicted - sample.groundTruth) < 0.1) {
        correctCount++;
      }
    });

    const accuracy = correctCount / this.feedbackHistory.length;

    return { mse, accuracy };
  }

  /**
   * 現在のパラメータを取得
   */
  getParameters(): EnsembleParameters {
    return { ...this.parameters };
  }

  /**
   * パラメータを設定
   */
  setParameters(parameters: Partial<EnsembleParameters>): void {
    this.parameters = { ...this.parameters, ...parameters };
    this.normalizeWeights();
  }

  /**
   * フィードバック履歴をクリア
   */
  clearFeedback(): void {
    this.feedbackHistory = [];
  }
}
