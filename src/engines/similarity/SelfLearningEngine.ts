/**
 * 自己学習型類似度計算エンジン
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * フィードバック収集、ベイジアン最適化、ベクトル空間再調整を統合
 */

import type {
  MultiLayerVector,
  SystemParams,
  FeedbackData,
  UsageHistory,
  LayerType,
} from '../../types/index.js';
import { FeedbackCollector } from './FeedbackCollector.js';
import { BayesianOptimizer } from './BayesianOptimizer.js';
import { VectorSpaceAdjuster } from './VectorSpaceAdjuster.js';

/**
 * 学習サイクル設定
 */
export interface LearningConfig {
  enableFeedbackCollection: boolean;
  enableParameterOptimization: boolean;
  enableVectorAdjustment: boolean;
  optimizationInterval: number; // フィードバック数
  adjustmentInterval: number; // フィードバック数
  minFeedbackForOptimization: number;
  minFeedbackForAdjustment: number;
}

/**
 * 学習状態
 */
export interface LearningState {
  totalFeedback: number;
  lastOptimizationEpoch: number;
  lastAdjustmentEpoch: number;
  currentParams: SystemParams;
  performanceMetrics: PerformanceMetrics;
}

/**
 * パフォーマンスメトリクス
 */
export interface PerformanceMetrics {
  acceptanceRate: number;
  averageRegenerationCount: number;
  parameterConvergence: boolean;
  vectorSpaceQuality: number;
  lastUpdated: Date;
}

/**
 * 類似度計算結果（学習対応版）
 */
export interface SimilarityResult {
  score: number;
  breakdown: Record<LayerType, number>;
  adjusted: boolean;
  confidence: number;
}

/**
 * 自己学習型類似度計算エンジン
 */
export class SelfLearningEngine {
  private feedbackCollector: FeedbackCollector;
  private bayesianOptimizer: BayesianOptimizer;
  private vectorSpaceAdjuster: VectorSpaceAdjuster;
  private vectorStore: Map<string, MultiLayerVector> = new Map();
  private learningState: LearningState;

  constructor(
    private config: LearningConfig = {
      enableFeedbackCollection: true,
      enableParameterOptimization: true,
      enableVectorAdjustment: true,
      optimizationInterval: 50,
      adjustmentInterval: 100,
      minFeedbackForOptimization: 20,
      minFeedbackForAdjustment: 50,
    },
    initialParams?: SystemParams
  ) {
    this.feedbackCollector = new FeedbackCollector();
    this.bayesianOptimizer = new BayesianOptimizer(initialParams);
    this.vectorSpaceAdjuster = new VectorSpaceAdjuster();

    this.learningState = {
      totalFeedback: 0,
      lastOptimizationEpoch: 0,
      lastAdjustmentEpoch: 0,
      currentParams: initialParams || {
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
      },
      performanceMetrics: {
        acceptanceRate: 0,
        averageRegenerationCount: 0,
        parameterConvergence: false,
        vectorSpaceQuality: 1.0,
        lastUpdated: new Date(),
      },
    };
  }

  /**
   * ベクトルを登録
   */
  registerVector(id: string, vector: MultiLayerVector): void {
    this.vectorStore.set(id, vector);
  }

  /**
   * 類似度を計算（学習済みパラメータ使用）
   */
  computeSimilarity(
    vector1: MultiLayerVector,
    vector2: MultiLayerVector
  ): SimilarityResult {
    const params = this.learningState.currentParams;
    const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];

    const breakdown: Record<LayerType, number> = {
      subject: 0,
      attribute: 0,
      style: 0,
      composition: 0,
      emotion: 0,
    };

    let totalScore = 0;

    layers.forEach((layer) => {
      const similarity = this.cosineSimilarity(vector1[layer], vector2[layer]);
      breakdown[layer] = similarity;
      totalScore += similarity * params.layerWeights[layer];
    });

    // 信頼度を計算（パラメータの収束度に基づく）
    const confidence = this.learningState.performanceMetrics.parameterConvergence ? 0.9 : 0.7;

    return {
      score: totalScore,
      breakdown,
      adjusted: this.config.enableVectorAdjustment,
      confidence,
    };
  }

  /**
   * フィードバックを記録
   */
  recordFeedback(
    promptId: string,
    resultId: string,
    feedback: 'accepted' | 'rejected',
    implicit?: Partial<FeedbackData['implicit']>,
    userId?: string
  ): void {
    if (!this.config.enableFeedbackCollection) return;

    // 明示的フィードバック記録
    this.feedbackCollector.recordExplicitFeedback(promptId, resultId, feedback, userId);

    // 暗黙的フィードバック記録
    if (implicit) {
      this.feedbackCollector.recordImplicitFeedback(promptId, resultId, implicit, userId);
    }

    this.learningState.totalFeedback++;

    // 学習サイクルをトリガー
    this.triggerLearningCycle();
  }

  /**
   * 学習サイクルをトリガー
   */
  private triggerLearningCycle(): void {
    // パラメータ最適化
    if (this.shouldOptimizeParameters()) {
      this.optimizeParameters();
    }

    // ベクトル空間調整
    if (this.shouldAdjustVectorSpace()) {
      this.adjustVectorSpace();
    }

    // パフォーマンスメトリクス更新
    this.updatePerformanceMetrics();
  }

  /**
   * パラメータ最適化が必要か判定
   */
  private shouldOptimizeParameters(): boolean {
    if (!this.config.enableParameterOptimization) return false;

    const feedbackSinceLastOptimization =
      this.learningState.totalFeedback - this.learningState.lastOptimizationEpoch;

    return (
      feedbackSinceLastOptimization >= this.config.optimizationInterval &&
      this.learningState.totalFeedback >= this.config.minFeedbackForOptimization
    );
  }

  /**
   * ベクトル空間調整が必要か判定
   */
  private shouldAdjustVectorSpace(): boolean {
    if (!this.config.enableVectorAdjustment) return false;

    const feedbackSinceLastAdjustment =
      this.learningState.totalFeedback - this.learningState.lastAdjustmentEpoch;

    return (
      feedbackSinceLastAdjustment >= this.config.adjustmentInterval &&
      this.learningState.totalFeedback >= this.config.minFeedbackForAdjustment
    );
  }

  /**
   * パラメータ最適化を実行
   */
  private optimizeParameters(): void {
    const allFeedback = this.collectAllFeedback();
    if (allFeedback.length === 0) return;

    const optimizedParams = this.bayesianOptimizer.optimize(
      allFeedback,
      this.learningState.currentParams
    );

    this.learningState.currentParams = optimizedParams;
    this.learningState.lastOptimizationEpoch = this.learningState.totalFeedback;

    // 収束判定
    const hasConverged = this.bayesianOptimizer.hasConverged();
    this.learningState.performanceMetrics.parameterConvergence = hasConverged;
  }

  /**
   * ベクトル空間調整を実行
   */
  private adjustVectorSpace(): void {
    const patterns = this.feedbackCollector.analyzeCrossUserPatterns();
    if (patterns.length === 0) return;

    const adjustedVectors = this.vectorSpaceAdjuster.adjustVectorSpace(
      this.vectorStore,
      patterns
    );

    // ベクトルストアを更新
    this.vectorStore = adjustedVectors;
    this.learningState.lastAdjustmentEpoch = this.learningState.totalFeedback;
  }

  /**
   * パフォーマンスメトリクス更新
   */
  private updatePerformanceMetrics(): void {
    const aggregation = this.feedbackCollector.aggregateFeedback();

    this.learningState.performanceMetrics = {
      acceptanceRate: aggregation.acceptanceRate,
      averageRegenerationCount: aggregation.averageRegenerationCount,
      parameterConvergence: this.learningState.performanceMetrics.parameterConvergence,
      vectorSpaceQuality: this.computeVectorSpaceQuality(aggregation.patterns),
      lastUpdated: new Date(),
    };
  }

  /**
   * ベクトル空間品質を計算
   */
  private computeVectorSpaceQuality(patterns: Array<{ confusionRate: number }>): number {
    if (patterns.length === 0) return 1.0;

    // 混同率が低いほど品質が高い
    const averageConfusion = patterns.reduce((sum, p) => sum + p.confusionRate, 0) / patterns.length;
    return Math.max(0, 1 - averageConfusion);
  }

  /**
   * 全フィードバックを収集
   */
  private collectAllFeedback(): FeedbackData[] {
    const allFeedback: FeedbackData[] = [];
    this.vectorStore.forEach((_, promptId) => {
      const feedback = this.feedbackCollector.getFeedback(promptId);
      allFeedback.push(...feedback);
    });
    return allFeedback;
  }

  /**
   * コサイン類似度を計算
   */
  private cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 現在のパラメータを取得
   */
  getCurrentParams(): SystemParams {
    return { ...this.learningState.currentParams };
  }

  /**
   * 学習状態を取得
   */
  getLearningState(): LearningState {
    return { ...this.learningState };
  }

  /**
   * パフォーマンスメトリクスを取得
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.learningState.performanceMetrics };
  }

  /**
   * ユーザー履歴を取得
   */
  getUserHistory(userId: string): UsageHistory | undefined {
    return this.feedbackCollector.getUserHistory(userId);
  }

  /**
   * セッションを開始
   */
  startSession(userId: string, sessionId: string): void {
    this.feedbackCollector.startSession(userId, sessionId);
  }

  /**
   * セッションを終了
   */
  endSession(sessionId: string): void {
    this.feedbackCollector.endSession(sessionId);
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<LearningConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * リセット（テスト用）
   */
  reset(): void {
    this.vectorStore.clear();
    this.vectorSpaceAdjuster.reset();
    this.learningState.totalFeedback = 0;
    this.learningState.lastOptimizationEpoch = 0;
    this.learningState.lastAdjustmentEpoch = 0;
  }
}
