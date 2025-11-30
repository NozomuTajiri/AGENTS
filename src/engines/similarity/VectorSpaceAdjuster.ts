/**
 * 適応型ベクトル空間再調整エンジン
 * 特許: 生成AI画像のキャッシュシステム及び方法
 *
 * 変換式: V't = T(Vt, Ht)
 * - 混同されるプロンプト間の距離を増大
 * - 正確に区別されるプロンプト間の距離を減少
 */

import type { MultiLayerVector, LayerType } from '../../types/index.js';
import type { CrossUserPattern } from './FeedbackCollector.js';

/**
 * ベクトル空間変換行列
 */
export interface TransformationMatrix {
  layer: LayerType;
  matrix: number[][];
  bias: number[];
  epoch: number;
}

/**
 * 調整履歴
 */
export interface AdjustmentHistory {
  epoch: number;
  transformations: TransformationMatrix[];
  confusionPairs: number;
  timestamp: Date;
}

/**
 * 距離メトリクス
 */
export interface DistanceMetrics {
  beforeAdjustment: number;
  afterAdjustment: number;
  improvement: number;
}

/**
 * ベクトル空間再調整エンジン
 */
export class VectorSpaceAdjuster {
  private transformations: Map<LayerType, TransformationMatrix> = new Map();
  private adjustmentHistory: AdjustmentHistory[] = [];
  private learningRate: number = 0.01;
  private regularizationStrength: number = 0.001;

  /**
   * ベクトル空間を調整
   * V't = T(Vt, Ht)
   */
  adjustVectorSpace(
    vectors: Map<string, MultiLayerVector>,
    confusionPatterns: CrossUserPattern[]
  ): Map<string, MultiLayerVector> {
    // 変換行列を学習
    this.learnTransformations(vectors, confusionPatterns);

    // ベクトルを変換
    const adjustedVectors = new Map<string, MultiLayerVector>();

    vectors.forEach((vector, id) => {
      const transformed = this.transformVector(vector);
      adjustedVectors.set(id, transformed);
    });

    // 履歴を記録
    this.recordAdjustment(confusionPatterns.length);

    return adjustedVectors;
  }

  /**
   * 変換行列を学習
   * 混同ペアの距離を最大化、非混同ペアの距離を最小化
   */
  private learnTransformations(
    vectors: Map<string, MultiLayerVector>,
    confusionPatterns: CrossUserPattern[]
  ): void {
    const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];

    layers.forEach((layer) => {
      const dim = this.getLayerDimension(layer);

      // 初期化（前回の変換行列がなければ単位行列）
      let transformation = this.transformations.get(layer);
      if (!transformation) {
        transformation = {
          layer,
          matrix: this.createIdentityMatrix(dim),
          bias: new Array(dim).fill(0),
          epoch: 0,
        };
        this.transformations.set(layer, transformation);
      }

      // 混同パターンに基づいて変換行列を更新
      confusionPatterns.forEach((pattern) => {
        const [id1, id2] = pattern.promptPair;
        const vec1 = vectors.get(id1);
        const vec2 = vectors.get(id2);

        if (vec1 && vec2) {
          this.updateTransformation(
            transformation!,
            vec1[layer],
            vec2[layer],
            pattern.confusionRate
          );
        }
      });

      transformation.epoch++;
    });
  }

  /**
   * 変換行列を更新（対比学習）
   */
  private updateTransformation(
    transformation: TransformationMatrix,
    vec1: Float32Array,
    vec2: Float32Array,
    confusionRate: number
  ): void {
    const dim = vec1.length;

    // 差分ベクトル
    const diff = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      diff[i] = vec1[i] - vec2[i];
    }

    // 外積を計算（ランク1更新）
    const outerProduct: number[][] = [];
    for (let i = 0; i < dim; i++) {
      outerProduct[i] = [];
      for (let j = 0; j < dim; j++) {
        outerProduct[i][j] = diff[i] * diff[j];
      }
    }

    // 変換行列を更新（勾配上昇で距離を増大）
    const updateStrength = this.learningRate * confusionRate;

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        // 混同される場合は距離を増大
        transformation.matrix[i][j] += updateStrength * outerProduct[i][j];

        // 正則化（過学習を防止）
        transformation.matrix[i][j] *= 1 - this.regularizationStrength;
      }
    }

    // バイアスも更新
    for (let i = 0; i < dim; i++) {
      transformation.bias[i] += updateStrength * diff[i] * 0.1;
    }
  }

  /**
   * ベクトルを変換
   */
  transformVector(vector: MultiLayerVector): MultiLayerVector {
    const transformed: MultiLayerVector = {
      subject: this.applyTransformation('subject', vector.subject),
      attribute: this.applyTransformation('attribute', vector.attribute),
      style: this.applyTransformation('style', vector.style),
      composition: this.applyTransformation('composition', vector.composition),
      emotion: this.applyTransformation('emotion', vector.emotion),
      relationMatrix: vector.relationMatrix,
      timestamp: new Date(),
    };

    return transformed;
  }

  /**
   * 層ごとに変換を適用
   */
  private applyTransformation(layer: LayerType, vector: Float32Array): Float32Array {
    const transformation = this.transformations.get(layer);
    if (!transformation) {
      return vector;
    }

    const dim = vector.length;
    const result = new Float32Array(dim);

    // 行列積: result = matrix * vector + bias
    for (let i = 0; i < dim; i++) {
      let sum = 0;
      for (let j = 0; j < dim; j++) {
        sum += transformation.matrix[i][j] * vector[j];
      }
      result[i] = sum + transformation.bias[i];
    }

    // 正規化（ベクトルのノルムを保持）
    const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < dim; i++) {
        result[i] /= norm;
      }
    }

    return result;
  }

  /**
   * 距離改善度を計算
   */
  computeDistanceMetrics(
    originalVec1: MultiLayerVector,
    originalVec2: MultiLayerVector,
    transformedVec1: MultiLayerVector,
    transformedVec2: MultiLayerVector,
    layer: LayerType
  ): DistanceMetrics {
    const beforeDistance = this.euclideanDistance(
      originalVec1[layer],
      originalVec2[layer]
    );

    const afterDistance = this.euclideanDistance(
      transformedVec1[layer],
      transformedVec2[layer]
    );

    return {
      beforeAdjustment: beforeDistance,
      afterAdjustment: afterDistance,
      improvement: (afterDistance - beforeDistance) / beforeDistance,
    };
  }

  /**
   * ユークリッド距離を計算
   */
  private euclideanDistance(vec1: Float32Array, vec2: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * 層の次元数を取得
   */
  private getLayerDimension(layer: LayerType): number {
    const dimensions: Record<LayerType, number> = {
      subject: 128,
      attribute: 96,
      style: 64,
      composition: 48,
      emotion: 32,
    };
    return dimensions[layer];
  }

  /**
   * 単位行列を作成
   */
  private createIdentityMatrix(size: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        matrix[i][j] = i === j ? 1.0 : 0.0;
      }
    }
    return matrix;
  }

  /**
   * 調整履歴を記録
   */
  private recordAdjustment(confusionPairs: number): void {
    const transformations: TransformationMatrix[] = [];
    this.transformations.forEach((t) => {
      transformations.push(JSON.parse(JSON.stringify(t)));
    });

    this.adjustmentHistory.push({
      epoch: this.adjustmentHistory.length,
      transformations,
      confusionPairs,
      timestamp: new Date(),
    });

    // 履歴が長すぎる場合は古いものを削除
    if (this.adjustmentHistory.length > 100) {
      this.adjustmentHistory.shift();
    }
  }

  /**
   * 変換行列を取得
   */
  getTransformation(layer: LayerType): TransformationMatrix | undefined {
    return this.transformations.get(layer);
  }

  /**
   * 調整履歴を取得
   */
  getHistory(): AdjustmentHistory[] {
    return [...this.adjustmentHistory];
  }

  /**
   * 変換行列をリセット
   */
  reset(): void {
    this.transformations.clear();
    this.adjustmentHistory = [];
  }

  /**
   * 学習率を設定
   */
  setLearningRate(rate: number): void {
    this.learningRate = Math.max(0.0001, Math.min(0.1, rate));
  }

  /**
   * 正則化強度を設定
   */
  setRegularizationStrength(strength: number): void {
    this.regularizationStrength = Math.max(0, Math.min(0.01, strength));
  }
}
