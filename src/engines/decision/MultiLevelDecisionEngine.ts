/**
 * マルチレベル決定エンジン
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * 多角的類似度指標とアンサンブルモデルを統合し、
 * 不確実性を考慮した高精度な決定を実現
 */

import { MultiLayerVector, DecisionResult, CacheItem, FeedbackData } from '../../types/index.js';
import { SimilarityCalculator } from './SimilarityCalculators.js';
import { UncertaintyQuantifier } from './UncertaintyQuantifier.js';
import { EnsembleModel } from './EnsembleModel.js';
import { AdaptiveThreshold } from './AdaptiveThreshold.js';

/**
 * 決定エンジンの設定
 */
export interface DecisionEngineConfig {
  /** 不確実性閾値（これを超えると保守的判断） */
  uncertaintyThreshold?: number;

  /** 学習率 */
  learningRate?: number;

  /** 最適化バッチサイズ */
  batchSize?: number;

  /** 自動最適化を有効化 */
  autoOptimize?: boolean;
}

/**
 * マルチレベル決定エンジン
 *
 * 統合された決定フロー:
 * 1. 類似度計算（4種類の指標）
 * 2. アンサンブルモデルで統合
 * 3. 不確実性定量化
 * 4. 適応的閾値で3段階判定
 */
export class MultiLevelDecisionEngine {
  private similarityCalc = new SimilarityCalculator();
  private uncertaintyQuantifier = new UncertaintyQuantifier();
  private ensembleModel: EnsembleModel;
  private adaptiveThreshold: AdaptiveThreshold;
  private config: Required<DecisionEngineConfig>;

  constructor(config?: DecisionEngineConfig) {
    this.config = {
      uncertaintyThreshold: 0.5,
      learningRate: 0.01,
      batchSize: 32,
      autoOptimize: true,
      ...config,
    };

    this.ensembleModel = new EnsembleModel();
    this.adaptiveThreshold = new AdaptiveThreshold();
  }

  /**
   * メイン決定ロジック
   *
   * @param queryVector - クエリベクトル
   * @param cacheItems - キャッシュアイテム候補
   * @returns 決定結果
   */
  decide(queryVector: MultiLayerVector, cacheItems: CacheItem[]): DecisionResult {
    // キャッシュが空の場合は新規生成
    if (cacheItems.length === 0) {
      return {
        action: 'new_generation',
        confidence: 1.0,
        uncertainty: 0.0,
        metrics: {
          cosine: 0,
          semanticTree: 0,
          latentSemantic: 0,
          contextualCoherence: 0,
        },
      };
    }

    // 各キャッシュアイテムとの類似度を計算
    const candidates = cacheItems.map(item => {
      // 1. 多角的類似度指標を計算
      const metrics = this.similarityCalc.calculateAll(queryVector, item.vector);

      // 2. アンサンブルモデルで統合
      const similarity = this.ensembleModel.predict(metrics);

      // 3. 不確実性を定量化
      const uncertaintyResult = this.uncertaintyQuantifier.quantify(metrics);

      return {
        item,
        metrics,
        similarity,
        ...uncertaintyResult,
      };
    });

    // 最も類似度が高い候補を選択
    candidates.sort((a, b) => b.similarity - a.similarity);
    const bestCandidate = candidates[0];

    // 4. 適応的閾値で3段階判定
    let action = this.adaptiveThreshold.decideAction(bestCandidate.similarity);

    // 不確実性が高い場合は保守的判断（新規生成優先）
    if (bestCandidate.uncertainty > this.config.uncertaintyThreshold) {
      if (action === 'cache_hit') {
        action = 'diff_generation'; // キャッシュヒット → 差分生成にダウングレード
      } else if (action === 'diff_generation') {
        action = 'new_generation'; // 差分生成 → 新規生成にダウングレード
      }
    }

    // 決定結果を構築
    const result: DecisionResult = {
      action,
      confidence: bestCandidate.confidence,
      uncertainty: bestCandidate.uncertainty,
      metrics: bestCandidate.metrics,
    };

    // アクションに応じて追加情報を設定
    if (action === 'cache_hit' || action === 'diff_generation') {
      result.matchedItem = bestCandidate.item;
    }

    if (action === 'diff_generation') {
      // 差分生成の強度を設定（類似度が高いほど差分は小さい）
      result.diffStrength = 1 - bestCandidate.similarity;
    }

    return result;
  }

  /**
   * フィードバックを追加
   *
   * @param feedback - フィードバックデータ
   * @param metrics - 類似度指標
   * @param groundTruth - 実際の類似度（オプション）
   */
  addFeedback(feedback: FeedbackData, metrics?: import('../../types/index.js').SimilarityMetrics, groundTruth?: number): void {
    // 適応的閾値にフィードバックを追加
    this.adaptiveThreshold.addFeedback(feedback);

    // アンサンブルモデルにフィードバックを追加
    if (metrics && groundTruth !== undefined) {
      this.ensembleModel.addFeedback(metrics, groundTruth);
    }

    // 自動最適化が有効な場合
    if (this.config.autoOptimize) {
      this.optimize();
    }
  }

  /**
   * モデルを最適化
   */
  optimize(): void {
    // アンサンブルモデルを最適化
    this.ensembleModel.optimize(this.config.learningRate, this.config.batchSize);

    // 適応的閾値を最適化
    this.adaptiveThreshold.optimize();
  }

  /**
   * モデルのパフォーマンスを評価
   */
  evaluate(): {
    ensemble: { mse: number; accuracy: number };
    thresholds: import('./AdaptiveThreshold.js').ThresholdStatistics;
  } {
    return {
      ensemble: this.ensembleModel.evaluate(),
      thresholds: this.adaptiveThreshold.getStatistics(),
    };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): {
    engine: Required<DecisionEngineConfig>;
    ensemble: import('./EnsembleModel.js').EnsembleParameters;
    thresholds: import('./AdaptiveThreshold.js').ThresholdConfig;
  } {
    return {
      engine: this.config,
      ensemble: this.ensembleModel.getParameters(),
      thresholds: this.adaptiveThreshold.getThresholds(),
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<DecisionEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * モデルをリセット
   */
  reset(): void {
    this.ensembleModel.clearFeedback();
    this.adaptiveThreshold.reset();
  }

  /**
   * バッチ決定（複数のクエリを一度に処理）
   */
  decideBatch(
    queries: MultiLayerVector[],
    cacheItems: CacheItem[]
  ): DecisionResult[] {
    return queries.map(query => this.decide(query, cacheItems));
  }

  /**
   * 類似度のみを計算（決定は行わない）
   */
  calculateSimilarity(vector1: MultiLayerVector, vector2: MultiLayerVector): {
    metrics: import('../../types/index.js').SimilarityMetrics;
    similarity: number;
    uncertainty: number;
  } {
    const metrics = this.similarityCalc.calculateAll(vector1, vector2);
    const similarity = this.ensembleModel.predict(metrics);
    const uncertaintyResult = this.uncertaintyQuantifier.quantify(metrics);

    return {
      metrics,
      similarity,
      uncertainty: uncertaintyResult.uncertainty,
    };
  }
}
