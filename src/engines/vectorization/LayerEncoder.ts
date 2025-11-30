/**
 * LayerEncoder - 各層に最適化されたベクトルエンコーダー
 *
 * 各層（主題、属性、スタイル、構図、感情）ごとに特化した
 * エンコーディングロジックを提供します。
 */

import { LayerType, LAYER_DIMENSIONS } from '../../types/index.js';
import { getLayerEmbeddings } from './embeddings.js';

/**
 * 単一層のエンコーダー
 */
export class LayerEncoder {
  private layerType: LayerType;
  private dimensions: number;

  constructor(layerType: LayerType) {
    this.layerType = layerType;
    this.dimensions = LAYER_DIMENSIONS[layerType];
  }

  /**
   * テキストを正規化されたベクトルにエンコード
   *
   * @param text - エンコード対象のテキスト
   * @returns 正規化された Float32Array ベクトル
   */
  encode(text: string): Float32Array {
    const tokens = this.tokenize(text);
    const embeddings = getLayerEmbeddings(this.layerType);

    // トークンごとのベクトルを集約
    const vector = new Float32Array(this.dimensions);
    let totalWeight = 0;

    for (const token of tokens) {
      const embedding = embeddings.get(token.toLowerCase());
      if (embedding) {
        const weight = this.calculateTokenWeight(token);
        for (let i = 0; i < this.dimensions; i++) {
          vector[i] += embedding[i] * weight;
        }
        totalWeight += weight;
      }
    }

    // 平均化
    if (totalWeight > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= totalWeight;
      }
    }

    // L2正規化
    return this.normalize(vector);
  }

  /**
   * テキストをトークンに分割
   */
  private tokenize(text: string): string[] {
    // 簡易的なトークナイゼーション
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  /**
   * トークンの重み計算（層ごとに最適化）
   */
  private calculateTokenWeight(token: string): number {
    // 層ごとに重要度が異なる単語の重み付け
    const weights: Record<LayerType, Record<string, number>> = {
      subject: {
        'person': 1.5,
        'animal': 1.5,
        'landscape': 1.5,
        'object': 1.3,
        'character': 1.4,
      },
      attribute: {
        'color': 1.5,
        'material': 1.5,
        'texture': 1.4,
        'age': 1.3,
        'size': 1.3,
      },
      style: {
        'realistic': 1.5,
        'cartoon': 1.5,
        'anime': 1.5,
        'watercolor': 1.4,
        'oil': 1.4,
      },
      composition: {
        'perspective': 1.5,
        'angle': 1.5,
        'layout': 1.4,
        'balance': 1.3,
        'center': 1.3,
      },
      emotion: {
        'happy': 1.5,
        'sad': 1.5,
        'calm': 1.4,
        'energetic': 1.4,
        'mysterious': 1.3,
      },
    };

    const layerWeights = weights[this.layerType];
    return layerWeights[token] || 1.0;
  }

  /**
   * ベクトルのL2正規化
   */
  private normalize(vector: Float32Array): Float32Array {
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude > 0) {
      const normalized = new Float32Array(vector.length);
      for (let i = 0; i < vector.length; i++) {
        normalized[i] = vector[i] / magnitude;
      }
      return normalized;
    }

    return vector;
  }

  /**
   * 2つのベクトル間のコサイン類似度を計算
   */
  static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

/**
 * マルチレイヤーエンコーダーファクトリー
 */
export class MultiLayerEncoderFactory {
  private encoders: Map<LayerType, LayerEncoder>;

  constructor() {
    this.encoders = new Map();
    const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];

    for (const layer of layers) {
      this.encoders.set(layer, new LayerEncoder(layer));
    }
  }

  /**
   * 指定された層のエンコーダーを取得
   */
  getEncoder(layerType: LayerType): LayerEncoder {
    const encoder = this.encoders.get(layerType);
    if (!encoder) {
      throw new Error(`Encoder not found for layer: ${layerType}`);
    }
    return encoder;
  }

  /**
   * すべての層でエンコード
   */
  encodeAll(text: string): Record<LayerType, Float32Array> {
    const result: Partial<Record<LayerType, Float32Array>> = {};
    const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];

    for (const layerType of layers) {
      const encoder = this.encoders.get(layerType);
      if (encoder) {
        result[layerType] = encoder.encode(text);
      }
    }

    return result as Record<LayerType, Float32Array>;
  }
}
