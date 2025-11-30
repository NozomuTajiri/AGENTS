/**
 * ベイジアン最適化フレームワーク
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * 最適化式: θt+1 = θt + η · ∇L(θt, Dt)
 */

import type {
  SystemParams,
  LayerType,
  Gradient,
  FeedbackData,
  Thresholds,
} from '../../types/index.js';

/**
 * 損失関数の結果
 */
export interface LossResult {
  loss: number;
  gradient: Gradient;
  metrics: {
    falsePositives: number;
    falseNegatives: number;
    accuracy: number;
  };
}

/**
 * 最適化履歴エントリ
 */
export interface OptimizationHistory {
  epoch: number;
  params: SystemParams;
  loss: number;
  learningRate: number;
  timestamp: Date;
}

/**
 * ベイジアン最適化エンジン
 * パラメータθを勾配降下法で最適化
 */
export class BayesianOptimizer {
  private optimizationHistory: OptimizationHistory[] = [];
  private minLearningRate: number = 0.0001;
  private maxLearningRate: number = 0.1;
  private decayFactor: number = 0.95;
  private patience: number = 5;
  private bestLoss: number = Infinity;
  private patienceCounter: number = 0;

  constructor(
    private initialParams: SystemParams = {
      layerWeights: {
        subject: 0.3,
        attribute: 0.25,
        style: 0.2,
        composition: 0.15,
        emotion: 0.1,
      },
      thresholds: {
        cacheHit: 0.95,
        diffGeneration: 0.85,
      },
      learningRate: 0.01,
    }
  ) {}

  /**
   * パラメータ最適化を実行
   * θt+1 = θt + η · ∇L(θt, Dt)
   */
  optimize(
    feedbackData: FeedbackData[],
    currentParams: SystemParams
  ): SystemParams {
    // 損失関数と勾配を計算
    const lossResult = this.computeLoss(feedbackData, currentParams);

    // 学習率を調整
    const adjustedLearningRate = this.adjustLearningRate(
      lossResult.loss,
      currentParams.learningRate
    );

    // パラメータを更新
    const updatedParams = this.updateParameters(
      currentParams,
      lossResult.gradient,
      adjustedLearningRate
    );

    // 最適化履歴を記録
    this.recordHistory(updatedParams, lossResult.loss, adjustedLearningRate);

    return updatedParams;
  }

  /**
   * 損失関数を計算
   * L(θ, D) = Σ loss(predicted, actual)
   */
  private computeLoss(
    feedbackData: FeedbackData[],
    params: SystemParams
  ): LossResult {
    let totalLoss = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let correct = 0;

    const gradientAcc: Gradient = {
      layerWeights: {
        subject: 0,
        attribute: 0,
        style: 0,
        composition: 0,
        emotion: 0,
      },
      thresholds: {
        cacheHit: 0,
        diffGeneration: 0,
      },
    };

    feedbackData.forEach((feedback) => {
      const { loss, gradient, isCorrect, isFP, isFN } = this.computeSingleLoss(
        feedback,
        params
      );

      totalLoss += loss;
      if (isCorrect) correct++;
      if (isFP) falsePositives++;
      if (isFN) falseNegatives++;

      // 勾配を累積
      Object.keys(gradient.layerWeights).forEach((layer) => {
        const layerType = layer as LayerType;
        gradientAcc.layerWeights[layerType] += gradient.layerWeights[layerType];
      });

      if (gradient.thresholds.cacheHit !== undefined) {
        gradientAcc.thresholds.cacheHit =
          (gradientAcc.thresholds.cacheHit || 0) + gradient.thresholds.cacheHit;
      }
      if (gradient.thresholds.diffGeneration !== undefined) {
        gradientAcc.thresholds.diffGeneration =
          (gradientAcc.thresholds.diffGeneration || 0) + gradient.thresholds.diffGeneration;
      }
    });

    // 平均化
    const n = feedbackData.length || 1;
    const avgLoss = totalLoss / n;

    Object.keys(gradientAcc.layerWeights).forEach((layer) => {
      const layerType = layer as LayerType;
      gradientAcc.layerWeights[layerType] /= n;
    });

    if (gradientAcc.thresholds.cacheHit !== undefined) {
      gradientAcc.thresholds.cacheHit /= n;
    }
    if (gradientAcc.thresholds.diffGeneration !== undefined) {
      gradientAcc.thresholds.diffGeneration /= n;
    }

    return {
      loss: avgLoss,
      gradient: gradientAcc,
      metrics: {
        falsePositives,
        falseNegatives,
        accuracy: n > 0 ? correct / n : 0,
      },
    };
  }

  /**
   * 単一フィードバックに対する損失と勾配を計算
   */
  private computeSingleLoss(
    feedback: FeedbackData,
    params: SystemParams
  ): {
    loss: number;
    gradient: Gradient;
    isCorrect: boolean;
    isFP: boolean;
    isFN: boolean;
  } {
    // フィードバックから真のラベルを取得
    const accepted = feedback.explicit === 'accepted';
    const regenerationPenalty = feedback.implicit.regenerationCount * 0.1;
    const editPenalty = feedback.implicit.editCount * 0.05;

    // 予測スコアを計算（簡略化）
    const predictedScore = this.computePredictedScore(params);

    // 損失を計算（二乗誤差）
    const target = accepted ? 1.0 : 0.0;
    const loss = Math.pow(predictedScore - target, 2) + regenerationPenalty + editPenalty;

    // 勾配を計算（解析的勾配）
    const error = predictedScore - target;
    const gradient: Gradient = {
      layerWeights: {
        subject: 2 * error * 0.1,
        attribute: 2 * error * 0.08,
        style: 2 * error * 0.06,
        composition: 2 * error * 0.04,
        emotion: 2 * error * 0.02,
      },
      thresholds: {
        cacheHit: accepted ? -0.01 : 0.01,
        diffGeneration: accepted ? -0.005 : 0.005,
      },
    };

    const isCorrect = (predictedScore > 0.5 && accepted) || (predictedScore <= 0.5 && !accepted);
    const isFP = predictedScore > 0.5 && !accepted;
    const isFN = predictedScore <= 0.5 && accepted;

    return { loss, gradient, isCorrect, isFP, isFN };
  }

  /**
   * 予測スコアを計算（簡略化）
   */
  private computePredictedScore(params: SystemParams): number {
    // 重み付け合計を正規化
    const totalWeight = Object.values(params.layerWeights).reduce((sum, w) => sum + w, 0);
    return Math.min(1.0, totalWeight / 1.0);
  }

  /**
   * 学習率を自動調整
   * 損失が改善しない場合は学習率を減衰
   */
  private adjustLearningRate(currentLoss: number, currentLearningRate: number): number {
    if (currentLoss < this.bestLoss) {
      // 改善した場合
      this.bestLoss = currentLoss;
      this.patienceCounter = 0;
      return Math.min(currentLearningRate * 1.05, this.maxLearningRate);
    } else {
      // 改善しなかった場合
      this.patienceCounter++;
      if (this.patienceCounter >= this.patience) {
        this.patienceCounter = 0;
        return Math.max(currentLearningRate * this.decayFactor, this.minLearningRate);
      }
      return currentLearningRate;
    }
  }

  /**
   * パラメータを更新
   * θt+1 = θt + η · ∇L(θt, Dt)
   */
  private updateParameters(
    currentParams: SystemParams,
    gradient: Gradient,
    learningRate: number
  ): SystemParams {
    const updatedLayerWeights = { ...currentParams.layerWeights };

    // Layer weights更新（勾配降下）
    Object.keys(gradient.layerWeights).forEach((layer) => {
      const layerType = layer as LayerType;
      updatedLayerWeights[layerType] = Math.max(
        0.0,
        Math.min(
          1.0,
          currentParams.layerWeights[layerType] - learningRate * gradient.layerWeights[layerType]
        )
      );
    });

    // 正規化（合計が1.0になるように）
    const total = Object.values(updatedLayerWeights).reduce((sum, w) => sum + w, 0);
    Object.keys(updatedLayerWeights).forEach((layer) => {
      const layerType = layer as LayerType;
      updatedLayerWeights[layerType] /= total;
    });

    // Thresholds更新
    const updatedThresholds: Thresholds = {
      cacheHit: Math.max(
        0.5,
        Math.min(
          0.99,
          currentParams.thresholds.cacheHit - learningRate * (gradient.thresholds.cacheHit || 0)
        )
      ),
      diffGeneration: Math.max(
        0.3,
        Math.min(
          0.95,
          currentParams.thresholds.diffGeneration - learningRate * (gradient.thresholds.diffGeneration || 0)
        )
      ),
    };

    return {
      layerWeights: updatedLayerWeights,
      thresholds: updatedThresholds,
      learningRate,
    };
  }

  /**
   * 最適化履歴を記録
   */
  private recordHistory(
    params: SystemParams,
    loss: number,
    learningRate: number
  ): void {
    this.optimizationHistory.push({
      epoch: this.optimizationHistory.length,
      params: JSON.parse(JSON.stringify(params)),
      loss,
      learningRate,
      timestamp: new Date(),
    });

    // 履歴が長すぎる場合は古いものを削除
    if (this.optimizationHistory.length > 1000) {
      this.optimizationHistory.shift();
    }
  }

  /**
   * 最適化履歴を取得
   */
  getHistory(): OptimizationHistory[] {
    return [...this.optimizationHistory];
  }

  /**
   * 最適なパラメータを取得
   */
  getBestParams(): SystemParams | null {
    if (this.optimizationHistory.length === 0) return null;

    const best = this.optimizationHistory.reduce((min, curr) =>
      curr.loss < min.loss ? curr : min
    );

    return best.params;
  }

  /**
   * 収束判定
   */
  hasConverged(windowSize: number = 10, tolerance: number = 0.001): boolean {
    if (this.optimizationHistory.length < windowSize) return false;

    const recent = this.optimizationHistory.slice(-windowSize);
    const losses = recent.map((h) => h.loss);
    const variance = this.calculateVariance(losses);

    return variance < tolerance;
  }

  /**
   * 分散を計算
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }
}
