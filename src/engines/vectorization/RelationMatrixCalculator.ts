/**
 * RelationMatrixCalculator - 層間関係行列計算
 *
 * 5つの層（主題、属性、スタイル、構図、感情）間の相互関係強度を
 * 交差行列として計算します。
 *
 * 関係行列 R = {rij} where i, j ∈ {主題, 属性, スタイル, 構図, 感情}
 * rij は層iと層jの関係強度を表します（0〜1の範囲）
 */

import { LayerType, RelationMatrix } from '../../types/index.js';
import { LayerEncoder } from './LayerEncoder.js';

/**
 * 層間関係行列を計算
 */
export class RelationMatrixCalculator {
  private layerOrder: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];

  /**
   * 異なる次元のベクトル間の相関を計算
   *
   * 次元が異なるベクトル間の関係性を推定するため、
   * 統計的モーメント（平均、分散、歪度）の類似性を使用します。
   */
  private computeCrossLayerSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    const stats1 = this.computeStatistics(vec1);
    const stats2 = this.computeStatistics(vec2);

    // 統計的特徴の類似度を計算
    const meanSim = 1 - Math.abs(stats1.mean - stats2.mean);
    const stdSim = 1 - Math.abs(stats1.std - stats2.std);
    const skewSim = 1 - Math.abs(stats1.skewness - stats2.skewness);

    // 重み付き平均（平均とばらつきを重視）
    return meanSim * 0.4 + stdSim * 0.4 + skewSim * 0.2;
  }

  /**
   * ベクトルの統計的特徴を計算
   */
  private computeStatistics(vec: Float32Array): {
    mean: number;
    std: number;
    skewness: number;
  } {
    const n = vec.length;

    // 平均
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += vec[i];
    }
    const mean = sum / n;

    // 分散と標準偏差
    let variance = 0;
    for (let i = 0; i < n; i++) {
      variance += Math.pow(vec[i] - mean, 2);
    }
    variance /= n;
    const std = Math.sqrt(variance);

    // 歪度（skewness）
    let skewness = 0;
    if (std > 0) {
      for (let i = 0; i < n; i++) {
        skewness += Math.pow((vec[i] - mean) / std, 3);
      }
      skewness /= n;
    }

    return { mean, std, skewness };
  }

  /**
   * ベクトルから関係行列を計算
   *
   * @param vectors - 各層のベクトル
   * @returns 5x5の関係行列
   */
  calculate(vectors: Record<LayerType, Float32Array>): RelationMatrix {
    const size = this.layerOrder.length;
    const data: number[][] = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));

    // 各層ペアの関係強度を計算
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const layerI = this.layerOrder[i];
        const layerJ = this.layerOrder[j];

        if (i === j) {
          // 対角成分は1（自己相関）
          data[i][j] = 1.0;
        } else {
          // 異なる次元のベクトル間の関係強度を計算
          // 統計的な相関を使用（ピアソン相関係数の近似）
          const similarity = this.computeCrossLayerSimilarity(
            vectors[layerI],
            vectors[layerJ]
          );
          // 類似度を0〜1の範囲に正規化
          data[i][j] = (similarity + 1) / 2;
        }
      }
    }

    return {
      data,
      layers: [...this.layerOrder],
    };
  }

  /**
   * テキストベースの関係行列を計算
   *
   * プロンプトテキストを解析し、層間の共起関係も考慮した
   * より詳細な関係行列を生成します。
   */
  calculateFromText(
    text: string,
    vectors: Record<LayerType, Float32Array>
  ): RelationMatrix {
    const baseMatrix = this.calculate(vectors);

    // テキストからの共起情報を追加
    const cooccurrence = this.analyzeCooccurrence(text);

    // ベースの類似度と共起情報を統合
    const size = this.layerOrder.length;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i !== j) {
          const layerI = this.layerOrder[i];
          const layerJ = this.layerOrder[j];
          const key = `${layerI}-${layerJ}`;

          // 80%: ベクトル類似度, 20%: 共起情報
          baseMatrix.data[i][j] =
            baseMatrix.data[i][j] * 0.8 +
            (cooccurrence.get(key) || 0) * 0.2;
        }
      }
    }

    return baseMatrix;
  }

  /**
   * テキスト内の層間共起関係を解析
   */
  private analyzeCooccurrence(text: string): Map<string, number> {
    const cooccurrence = new Map<string, number>();
    const tokens = text.toLowerCase().split(/\s+/);

    // 層ごとのキーワード
    const layerKeywords: Record<LayerType, Set<string>> = {
      subject: new Set(['person', 'animal', 'landscape', 'object', 'character']),
      attribute: new Set(['color', 'material', 'texture', 'age', 'size']),
      style: new Set(['realistic', 'cartoon', 'anime', 'watercolor', 'abstract']),
      composition: new Set(['center', 'perspective', 'angle', 'foreground', 'background']),
      emotion: new Set(['happy', 'sad', 'calm', 'energetic', 'mysterious']),
    };

    // トークン内での層の出現位置を記録
    const layerPositions: Map<LayerType, number[]> = new Map();

    for (const layer of this.layerOrder) {
      layerPositions.set(layer, []);
    }

    tokens.forEach((token, index) => {
      for (const [layer, keywords] of Object.entries(layerKeywords)) {
        if (keywords.has(token)) {
          layerPositions.get(layer as LayerType)?.push(index);
        }
      }
    });

    // 近接度に基づいて共起スコアを計算
    for (let i = 0; i < this.layerOrder.length; i++) {
      for (let j = i + 1; j < this.layerOrder.length; j++) {
        const layerI = this.layerOrder[i];
        const layerJ = this.layerOrder[j];

        const positionsI = layerPositions.get(layerI) || [];
        const positionsJ = layerPositions.get(layerJ) || [];

        let totalDistance = 0;
        let count = 0;

        for (const posI of positionsI) {
          for (const posJ of positionsJ) {
            const distance = Math.abs(posI - posJ);
            // 距離が近いほど高スコア（ウィンドウサイズ5）
            if (distance <= 5) {
              totalDistance += 1 - distance / 5;
              count++;
            }
          }
        }

        const score = count > 0 ? totalDistance / count : 0;

        cooccurrence.set(`${layerI}-${layerJ}`, score);
        cooccurrence.set(`${layerJ}-${layerI}`, score); // 対称
      }
    }

    return cooccurrence;
  }

  /**
   * 関係行列の強度を調整（重み付き）
   *
   * 特定の層ペアの関係性を強調または抑制します。
   */
  applyWeights(
    matrix: RelationMatrix,
    weights: Partial<Record<string, number>>
  ): RelationMatrix {
    const adjustedData = matrix.data.map(row => [...row]);

    for (let i = 0; i < this.layerOrder.length; i++) {
      for (let j = 0; j < this.layerOrder.length; j++) {
        if (i !== j) {
          const layerI = this.layerOrder[i];
          const layerJ = this.layerOrder[j];
          const key = `${layerI}-${layerJ}`;

          if (weights[key] !== undefined) {
            adjustedData[i][j] *= weights[key]!;
            // 0〜1の範囲にクリップ
            adjustedData[i][j] = Math.max(0, Math.min(1, adjustedData[i][j]));
          }
        }
      }
    }

    return {
      data: adjustedData,
      layers: [...this.layerOrder],
    };
  }

  /**
   * 関係行列を対称化
   */
  symmetrize(matrix: RelationMatrix): RelationMatrix {
    const size = matrix.data.length;
    const symmetricData: number[][] = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        // 平均を取って対称化
        symmetricData[i][j] = (matrix.data[i][j] + matrix.data[j][i]) / 2;
      }
    }

    return {
      data: symmetricData,
      layers: [...matrix.layers],
    };
  }

  /**
   * 関係行列の統計情報を取得
   */
  getStatistics(matrix: RelationMatrix): {
    mean: number;
    max: number;
    min: number;
    std: number;
  } {
    const values: number[] = [];

    // 対角成分を除く
    for (let i = 0; i < matrix.data.length; i++) {
      for (let j = 0; j < matrix.data[i].length; j++) {
        if (i !== j) {
          values.push(matrix.data[i][j]);
        }
      }
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const std = Math.sqrt(variance);

    return { mean, max, min, std };
  }

  /**
   * 2つの関係行列の差分を計算
   */
  computeDifference(
    matrix1: RelationMatrix,
    matrix2: RelationMatrix
  ): RelationMatrix {
    const size = matrix1.data.length;
    const diffData: number[][] = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        diffData[i][j] = Math.abs(matrix1.data[i][j] - matrix2.data[i][j]);
      }
    }

    return {
      data: diffData,
      layers: [...matrix1.layers],
    };
  }

  /**
   * 関係行列をJSON形式で出力
   */
  toJSON(matrix: RelationMatrix): string {
    return JSON.stringify(
      {
        layers: matrix.layers,
        data: matrix.data,
      },
      null,
      2
    );
  }
}
