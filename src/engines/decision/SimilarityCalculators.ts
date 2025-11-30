/**
 * 多角的類似度計算モジュール
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import { MultiLayerVector, SimilarityMetrics } from '../../types/index.js';

/**
 * コサイン類似度計算
 *
 * 計算式: (v1·v2)/(‖v1‖×‖v2‖)
 * ベクトル間の角度を測定し、方向の類似性を評価
 */
export class CosineSimilarityCalculator {
  /**
   * ベクトル内積を計算
   */
  private dotProduct(v1: Float32Array, v2: Float32Array): number {
    if (v1.length !== v2.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      sum += v1[i] * v2[i];
    }
    return sum;
  }

  /**
   * ベクトルのノルム（長さ）を計算
   */
  private norm(v: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * コサイン類似度を計算
   */
  calculate(v1: Float32Array, v2: Float32Array): number {
    const dot = this.dotProduct(v1, v2);
    const norm1 = this.norm(v1);
    const norm2 = this.norm(v2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dot / (norm1 * norm2);
  }

  /**
   * マルチレイヤーベクトルのコサイン類似度を計算
   */
  calculateMultiLayer(vector1: MultiLayerVector, vector2: MultiLayerVector): number {
    const layers = ['subject', 'attribute', 'style', 'composition', 'emotion'] as const;
    const weights = {
      subject: 0.3,
      attribute: 0.25,
      style: 0.2,
      composition: 0.15,
      emotion: 0.1,
    };

    let weightedSum = 0;
    for (const layer of layers) {
      const sim = this.calculate(vector1[layer], vector2[layer]);
      weightedSum += sim * weights[layer];
    }

    return weightedSum;
  }
}

/**
 * 意味木距離計算
 *
 * 構造化意味表現の編集距離を測定
 * 計算式: 1 - (edit_dist / max_dist)
 */
export class SemanticTreeDistanceCalculator {
  /**
   * ベクトルを離散化して「意味木」として扱う
   * 各次元の値を閾値で分類し、構造的な差異を計算
   */
  private discretize(vector: Float32Array, bins: number = 10): Uint8Array {
    const result = new Uint8Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      // 0-1の範囲を想定し、bins個のビンに分類
      result[i] = Math.min(bins - 1, Math.floor(vector[i] * bins));
    }
    return result;
  }

  /**
   * レーベンシュタイン距離（編集距離）を計算
   */
  private editDistance(a: Uint8Array, b: Uint8Array): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // 削除
          dp[i][j - 1] + 1,      // 挿入
          dp[i - 1][j - 1] + cost // 置換
        );
      }
    }

    return dp[m][n];
  }

  /**
   * 意味木距離を計算（0-1の範囲、1が完全一致）
   */
  calculate(v1: Float32Array, v2: Float32Array): number {
    const discrete1 = this.discretize(v1);
    const discrete2 = this.discretize(v2);

    const editDist = this.editDistance(discrete1, discrete2);
    const maxDist = Math.max(v1.length, v2.length);

    return 1 - (editDist / maxDist);
  }

  /**
   * マルチレイヤーベクトルの意味木距離を計算
   */
  calculateMultiLayer(vector1: MultiLayerVector, vector2: MultiLayerVector): number {
    const layers = ['subject', 'attribute', 'style', 'composition', 'emotion'] as const;
    const weights = {
      subject: 0.3,
      attribute: 0.25,
      style: 0.2,
      composition: 0.15,
      emotion: 0.1,
    };

    let weightedSum = 0;
    for (const layer of layers) {
      const sim = this.calculate(vector1[layer], vector2[layer]);
      weightedSum += sim * weights[layer];
    }

    return weightedSum;
  }
}

/**
 * 潜在意味解析（LSA）類似度計算
 *
 * 共起パターンに基づく類似度を測定
 * 計算式: correlation(LSA(p1), LSA(p2))
 */
export class LatentSemanticAnalysisCalculator {
  /**
   * SVD（特異値分解）の簡易近似
   * 実際の実装では、より洗練されたSVDアルゴリズムを使用
   */
  private approximateLSA(vector: Float32Array): Float32Array {
    // LSAの簡易実装: 主要成分への射影
    // 実運用ではTensorFlow.jsやONNX Runtimeを使用
    const reduced = new Float32Array(Math.floor(vector.length / 2));

    for (let i = 0; i < reduced.length; i++) {
      // 隣接する次元をペアで平均化（簡易次元削減）
      reduced[i] = (vector[i * 2] + vector[i * 2 + 1]) / 2;
    }

    return reduced;
  }

  /**
   * ピアソン相関係数を計算
   */
  private correlation(v1: Float32Array, v2: Float32Array): number {
    if (v1.length !== v2.length) {
      throw new Error('Vector dimensions must match');
    }

    const n = v1.length;
    let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;

    for (let i = 0; i < n; i++) {
      sum1 += v1[i];
      sum2 += v2[i];
      sum1Sq += v1[i] * v1[i];
      sum2Sq += v2[i] * v2[i];
      pSum += v1[i] * v2[i];
    }

    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

    if (den === 0) return 0;

    return num / den;
  }

  /**
   * LSA類似度を計算（0-1の範囲に正規化）
   */
  calculate(v1: Float32Array, v2: Float32Array): number {
    const lsa1 = this.approximateLSA(v1);
    const lsa2 = this.approximateLSA(v2);

    const corr = this.correlation(lsa1, lsa2);

    // -1～1の相関係数を0～1の類似度に変換
    return (corr + 1) / 2;
  }

  /**
   * マルチレイヤーベクトルのLSA類似度を計算
   */
  calculateMultiLayer(vector1: MultiLayerVector, vector2: MultiLayerVector): number {
    const layers = ['subject', 'attribute', 'style', 'composition', 'emotion'] as const;
    const weights = {
      subject: 0.3,
      attribute: 0.25,
      style: 0.2,
      composition: 0.15,
      emotion: 0.1,
    };

    let weightedSum = 0;
    for (const layer of layers) {
      const sim = this.calculate(vector1[layer], vector2[layer]);
      weightedSum += sim * weights[layer];
    }

    return weightedSum;
  }
}

/**
 * 文脈的一貫性計算
 *
 * コンテキスト整合性を評価
 * 計算式: coherence(p1, p2 | context)
 */
export class ContextualCoherenceCalculator {
  /**
   * リレーション行列から文脈的類似度を計算
   */
  private matrixSimilarity(m1: number[][], m2: number[][]): number {
    if (m1.length !== m2.length || m1[0].length !== m2[0].length) {
      throw new Error('Matrix dimensions must match');
    }

    let totalDiff = 0;
    let count = 0;

    for (let i = 0; i < m1.length; i++) {
      for (let j = 0; j < m1[i].length; j++) {
        const diff = Math.abs(m1[i][j] - m2[i][j]);
        totalDiff += diff;
        count++;
      }
    }

    const avgDiff = totalDiff / count;

    // 差分を類似度に変換（差が小さいほど類似度が高い）
    return Math.max(0, 1 - avgDiff);
  }

  /**
   * 文脈的一貫性を計算
   */
  calculate(vector1: MultiLayerVector, vector2: MultiLayerVector): number {
    // リレーション行列の類似度を文脈的一貫性として使用
    return this.matrixSimilarity(vector1.relationMatrix, vector2.relationMatrix);
  }
}

/**
 * 統合された類似度計算器
 */
export class SimilarityCalculator {
  private cosineCalc = new CosineSimilarityCalculator();
  private treeCalc = new SemanticTreeDistanceCalculator();
  private lsaCalc = new LatentSemanticAnalysisCalculator();
  private coherenceCalc = new ContextualCoherenceCalculator();

  /**
   * すべての類似度指標を計算
   */
  calculateAll(vector1: MultiLayerVector, vector2: MultiLayerVector): SimilarityMetrics {
    return {
      cosine: this.cosineCalc.calculateMultiLayer(vector1, vector2),
      semanticTree: this.treeCalc.calculateMultiLayer(vector1, vector2),
      latentSemantic: this.lsaCalc.calculateMultiLayer(vector1, vector2),
      contextualCoherence: this.coherenceCalc.calculate(vector1, vector2),
    };
  }
}
