/**
 * VectorizationEngine - 多層ベクトル化エンジン
 *
 * 5層分解アーキテクチャによるマルチレイヤーベクトル化を実行します。
 * - 主題層（128次元）
 * - 属性層（96次元）
 * - スタイル層（64次元）
 * - 構図層（48次元）
 * - 感情層（32次元）
 *
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import { MultiLayerVector, LayerType } from '../../types/index.js';
import { MultiLayerEncoderFactory } from './LayerEncoder.js';
import { RelationMatrixCalculator } from './RelationMatrixCalculator.js';
import { preloadEmbeddings } from './embeddings.js';

/**
 * ベクトル化オプション
 */
export interface VectorizationOptions {
  /**
   * 埋め込みを事前ロードするか
   */
  preloadEmbeddings?: boolean;

  /**
   * 関係行列を対称化するか
   */
  symmetrizeRelationMatrix?: boolean;

  /**
   * テキストベースの共起分析を使用するか
   */
  useCooccurrenceAnalysis?: boolean;

  /**
   * 層間関係の重み調整
   */
  relationWeights?: Partial<Record<string, number>>;
}

/**
 * ベクトル化メトリクス
 */
export interface VectorizationMetrics {
  /**
   * 処理時間（ミリ秒）
   */
  processingTime: number;

  /**
   * 入力トークン数
   */
  tokenCount: number;

  /**
   * 総ベクトル次元数
   */
  totalDimensions: number;

  /**
   * 関係行列統計
   */
  relationMatrixStats: {
    mean: number;
    max: number;
    min: number;
    std: number;
  };
}

/**
 * 多層ベクトル化エンジン
 */
export class VectorizationEngine {
  private encoderFactory: MultiLayerEncoderFactory;
  private relationCalculator: RelationMatrixCalculator;
  private options: Required<VectorizationOptions>;

  constructor(options: VectorizationOptions = {}) {
    this.options = {
      preloadEmbeddings: options.preloadEmbeddings ?? true,
      symmetrizeRelationMatrix: options.symmetrizeRelationMatrix ?? true,
      useCooccurrenceAnalysis: options.useCooccurrenceAnalysis ?? true,
      relationWeights: options.relationWeights ?? {},
    };

    this.encoderFactory = new MultiLayerEncoderFactory();
    this.relationCalculator = new RelationMatrixCalculator();

    if (this.options.preloadEmbeddings) {
      preloadEmbeddings();
    }
  }

  /**
   * テキストを多層ベクトルに変換
   *
   * @param text - エンコード対象のテキスト（プロンプト等）
   * @returns 多層ベクトルとメトリクス
   */
  vectorize(text: string): {
    vector: MultiLayerVector;
    metrics: VectorizationMetrics;
  } {
    const startTime = performance.now();

    // 各層でエンコード
    const layerVectors = this.encoderFactory.encodeAll(text);

    // 関係行列を計算
    let relationMatrix = this.options.useCooccurrenceAnalysis
      ? this.relationCalculator.calculateFromText(text, layerVectors)
      : this.relationCalculator.calculate(layerVectors);

    // 重み適用
    if (Object.keys(this.options.relationWeights).length > 0) {
      relationMatrix = this.relationCalculator.applyWeights(
        relationMatrix,
        this.options.relationWeights
      );
    }

    // 対称化
    if (this.options.symmetrizeRelationMatrix) {
      relationMatrix = this.relationCalculator.symmetrize(relationMatrix);
    }

    // MultiLayerVectorを構築
    const vector: MultiLayerVector = {
      subject: layerVectors.subject,
      attribute: layerVectors.attribute,
      style: layerVectors.style,
      composition: layerVectors.composition,
      emotion: layerVectors.emotion,
      relationMatrix: relationMatrix.data,
      timestamp: new Date(),
    };

    // メトリクス計算
    const processingTime = performance.now() - startTime;
    const tokenCount = text.split(/\s+/).length;
    const totalDimensions = 128 + 96 + 64 + 48 + 32; // 368次元

    const metrics: VectorizationMetrics = {
      processingTime,
      tokenCount,
      totalDimensions,
      relationMatrixStats: this.relationCalculator.getStatistics(relationMatrix),
    };

    return { vector, metrics };
  }

  /**
   * バッチ処理：複数テキストを一括ベクトル化
   */
  vectorizeBatch(texts: string[]): Array<{
    text: string;
    vector: MultiLayerVector;
    metrics: VectorizationMetrics;
  }> {
    return texts.map(text => ({
      text,
      ...this.vectorize(text),
    }));
  }

  /**
   * 2つのベクトル間の類似度を計算
   *
   * 各層の類似度と関係行列の差分を総合的に評価します。
   */
  computeSimilarity(
    vector1: MultiLayerVector,
    vector2: MultiLayerVector
  ): {
    overall: number;
    layerScores: Record<LayerType, number>;
    relationDifference: number;
  } {
    const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];
    const layerScores: Partial<Record<LayerType, number>> = {};

    // 各層の類似度を計算
    let totalScore = 0;
    for (const layer of layers) {
      const v1 = vector1[layer];
      const v2 = vector2[layer];

      // コサイン類似度（-1〜1を0〜1に正規化）
      let dotProduct = 0;
      let mag1 = 0;
      let mag2 = 0;

      for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
      }

      const similarity =
        mag1 > 0 && mag2 > 0
          ? dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2))
          : 0;

      const normalizedScore = (similarity + 1) / 2;
      layerScores[layer] = normalizedScore;
      totalScore += normalizedScore;
    }

    // 平均層スコア
    const avgLayerScore = totalScore / layers.length;

    // 関係行列の差分
    const matrix1 = { data: vector1.relationMatrix, layers };
    const matrix2 = { data: vector2.relationMatrix, layers };
    const diffMatrix = this.relationCalculator.computeDifference(matrix1, matrix2);
    const diffStats = this.relationCalculator.getStatistics(diffMatrix);
    const relationDifference = diffStats.mean;

    // 総合スコア: 70%層類似度 + 30%関係行列類似度
    const overall = avgLayerScore * 0.7 + (1 - relationDifference) * 0.3;

    return {
      overall,
      layerScores: layerScores as Record<LayerType, number>,
      relationDifference,
    };
  }

  /**
   * ベクトルの統計情報を取得
   */
  getVectorStatistics(vector: MultiLayerVector): {
    layers: Record<
      LayerType,
      {
        dimensions: number;
        mean: number;
        std: number;
        norm: number;
      }
    >;
    relationMatrix: {
      mean: number;
      max: number;
      min: number;
      std: number;
    };
  } {
    const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];
    const layerStats: Partial<
      Record<
        LayerType,
        {
          dimensions: number;
          mean: number;
          std: number;
          norm: number;
        }
      >
    > = {};

    for (const layer of layers) {
      const vec = vector[layer];
      const dimensions = vec.length;

      // 平均
      const mean = vec.reduce((sum, val) => sum + val, 0) / dimensions;

      // 標準偏差
      const variance =
        vec.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dimensions;
      const std = Math.sqrt(variance);

      // L2ノルム
      const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));

      layerStats[layer] = { dimensions, mean, std, norm };
    }

    const relationMatrix = this.relationCalculator.getStatistics({
      data: vector.relationMatrix,
      layers,
    });

    return {
      layers: layerStats as Record<LayerType, { dimensions: number; mean: number; std: number; norm: number }>,
      relationMatrix,
    };
  }

  /**
   * ベクトルをJSON形式でエクスポート
   */
  exportToJSON(vector: MultiLayerVector): string {
    return JSON.stringify(
      {
        subject: Array.from(vector.subject),
        attribute: Array.from(vector.attribute),
        style: Array.from(vector.style),
        composition: Array.from(vector.composition),
        emotion: Array.from(vector.emotion),
        relationMatrix: vector.relationMatrix,
        timestamp: vector.timestamp.toISOString(),
      },
      null,
      2
    );
  }

  /**
   * JSONからベクトルをインポート
   */
  importFromJSON(json: string): MultiLayerVector {
    const data = JSON.parse(json);

    return {
      subject: new Float32Array(data.subject),
      attribute: new Float32Array(data.attribute),
      style: new Float32Array(data.style),
      composition: new Float32Array(data.composition),
      emotion: new Float32Array(data.emotion),
      relationMatrix: data.relationMatrix,
      timestamp: new Date(data.timestamp),
    };
  }
}
