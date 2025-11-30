/**
 * パーツコンポジション戦略エンジン
 *
 * 複数の画像パーツを組み合わせて新しい画像を合成
 *
 * 戦略:
 * 1. プロンプトを多層ベクトルに変換
 * 2. 各層に対応する最適パーツを検索
 * 3. 互換性スコアに基づいて組み合わせ評価
 * 4. 最適な組み合わせを選択
 */

import type {
  ImagePart,
  MultiLayerVector,
  CompositionResult,
  LayerType,
} from '../../types/index.js';
import type { PartIndexer, IndexSearchResult } from './PartIndexer.js';

/**
 * コンポジション設定
 */
export interface CompositionConfig {
  /** 使用する最大パーツ数 */
  maxParts: number;
  /** 互換性最小閾値 */
  minCompatibility: number;
  /** ブレンドモード */
  blendMode: 'alpha' | 'additive' | 'screen' | 'multiply';
  /** 品質目標 */
  qualityTarget: number;
}

/**
 * パーツ互換性スコア
 */
export interface CompatibilityScore {
  part1Id: string;
  part2Id: string;
  score: number;
  details: {
    spatialCompatibility: number;
    semanticCompatibility: number;
    styleCompatibility: number;
  };
}

/**
 * コンポジション候補
 */
export interface CompositionCandidate {
  parts: ImagePart[];
  score: number;
  compatibility: number;
  blendWeights: number[];
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: CompositionConfig = {
  maxParts: 5,
  minCompatibility: 0.6,
  blendMode: 'alpha',
  qualityTarget: 0.8,
};

/**
 * パーツコンポーザー
 */
export class Composer {
  private config: CompositionConfig;
  private indexer: PartIndexer;

  constructor(indexer: PartIndexer, config?: Partial<CompositionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.indexer = indexer;
  }

  /**
   * プロンプトベクトルから最適なコンポジションを生成
   */
  async compose(
    promptVector: MultiLayerVector,
    options?: {
      requiredParts?: ImagePart[];
      excludeParts?: string[];
    }
  ): Promise<CompositionResult> {
    // 1. 各層に最適なパーツを検索
    const layerCandidates = await this.findLayerCandidates(promptVector);

    // 2. 必須パーツを追加
    if (options?.requiredParts) {
      layerCandidates.push(...options.requiredParts);
    }

    // 3. 除外パーツをフィルタ
    const filteredCandidates = layerCandidates.filter(
      (part) => !options?.excludeParts?.includes(part.id)
    );

    // 4. 互換性評価
    const compatibleSets = await this.findCompatibleSets(
      filteredCandidates,
      promptVector
    );

    // 5. 最適な組み合わせを選択
    const bestCandidate = this.selectBestCandidate(compatibleSets);

    // 6. パーツを合成
    const composedImage = await this.blendParts(
      bestCandidate.parts,
      bestCandidate.blendWeights
    );

    // 7. 品質評価
    const quality = this.evaluateQuality(bestCandidate, promptVector);

    return {
      image: composedImage,
      parts: bestCandidate.parts,
      blendWeights: bestCandidate.blendWeights,
      quality,
    };
  }

  /**
   * 各層に最適なパーツを検索
   */
  private async findLayerCandidates(
    promptVector: MultiLayerVector
  ): Promise<ImagePart[]> {
    const candidates: ImagePart[] = [];
    const layers: LayerType[] = [
      'subject',
      'attribute',
      'style',
      'composition',
      'emotion',
    ];

    for (const layer of layers) {
      const results = await this.indexer.search({
        queryVector: promptVector,
        layers: [layer],
        topK: 3,
        minSimilarity: 0.5,
      });

      candidates.push(...results.map((r) => r.part));
    }

    // 重複削除
    return this.deduplicateParts(candidates);
  }

  /**
   * パーツの重複削除
   */
  private deduplicateParts(parts: ImagePart[]): ImagePart[] {
    const seen = new Set<string>();
    return parts.filter((part) => {
      if (seen.has(part.id)) return false;
      seen.add(part.id);
      return true;
    });
  }

  /**
   * 互換性のあるパーツセットを検索
   */
  private async findCompatibleSets(
    candidates: ImagePart[],
    promptVector: MultiLayerVector
  ): Promise<CompositionCandidate[]> {
    const sets: CompositionCandidate[] = [];

    // 組み合わせ生成（最大maxParts個）
    const combinations = this.generateCombinations(
      candidates,
      this.config.maxParts
    );

    for (const combo of combinations) {
      const compatibility = this.calculateSetCompatibility(combo);

      if (compatibility >= this.config.minCompatibility) {
        const score = this.scoreCandidate(combo, promptVector);
        const blendWeights = this.calculateBlendWeights(combo);

        sets.push({
          parts: combo,
          score,
          compatibility,
          blendWeights,
        });
      }
    }

    return sets;
  }

  /**
   * 組み合わせ生成
   */
  private generateCombinations(
    parts: ImagePart[],
    maxSize: number
  ): ImagePart[][] {
    const combinations: ImagePart[][] = [];

    // 単純な実装: 1〜maxSizeの全組み合わせ
    for (let size = 1; size <= Math.min(maxSize, parts.length); size++) {
      this.generateCombinationsRecursive(parts, size, 0, [], combinations);
    }

    return combinations;
  }

  /**
   * 組み合わせ生成（再帰）
   */
  private generateCombinationsRecursive(
    parts: ImagePart[],
    size: number,
    start: number,
    current: ImagePart[],
    result: ImagePart[][]
  ): void {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < parts.length; i++) {
      current.push(parts[i]);
      this.generateCombinationsRecursive(parts, size, i + 1, current, result);
      current.pop();
    }
  }

  /**
   * パーツセットの互換性計算
   */
  private calculateSetCompatibility(parts: ImagePart[]): number {
    if (parts.length <= 1) return 1.0;

    let totalCompatibility = 0;
    let pairCount = 0;

    // 全ペアの互換性を計算
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const compatibility = this.calculatePairCompatibility(parts[i], parts[j]);
        totalCompatibility += compatibility;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalCompatibility / pairCount : 0;
  }

  /**
   * パーツペアの互換性計算
   */
  private calculatePairCompatibility(part1: ImagePart, part2: ImagePart): number {
    // 空間的互換性: 重なり具合
    const spatialCompat = this.calculateSpatialCompatibility(part1, part2);

    // 意味的互換性: ベクトル類似度
    const semanticCompat = this.calculateSemanticCompatibility(part1, part2);

    // スタイル互換性
    const styleCompat = this.calculateStyleCompatibility(part1, part2);

    // 重み付き平均
    return spatialCompat * 0.3 + semanticCompat * 0.5 + styleCompat * 0.2;
  }

  /**
   * 空間的互換性計算
   */
  private calculateSpatialCompatibility(part1: ImagePart, part2: ImagePart): number {
    const overlap = this.calculateOverlap(part1.boundingBox, part2.boundingBox);
    // 重なりすぎない（0.3以下）ことを好む
    return overlap < 0.3 ? 1.0 - overlap : 0.5;
  }

  /**
   * バウンディングボックスの重なり計算
   */
  private calculateOverlap(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 <= x1 || y2 <= y1) return 0;

    const overlapArea = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const minArea = Math.min(area1, area2);

    return minArea > 0 ? overlapArea / minArea : 0;
  }

  /**
   * 意味的互換性計算
   */
  private calculateSemanticCompatibility(part1: ImagePart, part2: ImagePart): number {
    // 主要層（subject, style）の類似度を計算
    const subjectSim = this.cosineSimilarity(
      part1.vectors.subject,
      part2.vectors.subject
    );
    const styleSim = this.cosineSimilarity(part1.vectors.style, part2.vectors.style);

    return (subjectSim + styleSim) / 2;
  }

  /**
   * スタイル互換性計算
   */
  private calculateStyleCompatibility(part1: ImagePart, part2: ImagePart): number {
    return this.cosineSimilarity(part1.vectors.style, part2.vectors.style);
  }

  /**
   * コサイン類似度
   */
  private cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    if (vec1.length !== vec2.length) return 0;

    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dot += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * 候補のスコアリング
   */
  private scoreCandidate(
    parts: ImagePart[],
    promptVector: MultiLayerVector
  ): number {
    // パーツの平均ベクトルを計算
    const avgVector = this.averageVectors(parts.map((p) => p.vectors));

    // プロンプトベクトルとの類似度
    const similarity = this.vectorSimilarity(avgVector, promptVector);

    // パーツ数ペナルティ（多すぎると複雑）
    const countPenalty = 1.0 - (parts.length / this.config.maxParts) * 0.2;

    return similarity * countPenalty;
  }

  /**
   * ベクトルの平均
   */
  private averageVectors(vectors: MultiLayerVector[]): MultiLayerVector {
    if (vectors.length === 0) {
      throw new Error('Cannot average empty vector list');
    }

    const avgVector: MultiLayerVector = {
      subject: new Float32Array(128),
      attribute: new Float32Array(96),
      style: new Float32Array(64),
      composition: new Float32Array(48),
      emotion: new Float32Array(32),
      relationMatrix: [],
      timestamp: new Date(),
    };

    for (const vector of vectors) {
      for (let i = 0; i < avgVector.subject.length; i++) {
        avgVector.subject[i] += vector.subject[i];
      }
      for (let i = 0; i < avgVector.attribute.length; i++) {
        avgVector.attribute[i] += vector.attribute[i];
      }
      for (let i = 0; i < avgVector.style.length; i++) {
        avgVector.style[i] += vector.style[i];
      }
      for (let i = 0; i < avgVector.composition.length; i++) {
        avgVector.composition[i] += vector.composition[i];
      }
      for (let i = 0; i < avgVector.emotion.length; i++) {
        avgVector.emotion[i] += vector.emotion[i];
      }
    }

    const count = vectors.length;
    for (let i = 0; i < avgVector.subject.length; i++) avgVector.subject[i] /= count;
    for (let i = 0; i < avgVector.attribute.length; i++)
      avgVector.attribute[i] /= count;
    for (let i = 0; i < avgVector.style.length; i++) avgVector.style[i] /= count;
    for (let i = 0; i < avgVector.composition.length; i++)
      avgVector.composition[i] /= count;
    for (let i = 0; i < avgVector.emotion.length; i++) avgVector.emotion[i] /= count;

    return avgVector;
  }

  /**
   * 多層ベクトル間の類似度
   */
  private vectorSimilarity(vec1: MultiLayerVector, vec2: MultiLayerVector): number {
    const layers: Array<keyof MultiLayerVector> = [
      'subject',
      'attribute',
      'style',
      'composition',
      'emotion',
    ];

    let totalSim = 0;
    for (const layer of layers) {
      const v1 = vec1[layer] as Float32Array;
      const v2 = vec2[layer] as Float32Array;
      totalSim += this.cosineSimilarity(v1, v2);
    }

    return totalSim / layers.length;
  }

  /**
   * 最適候補を選択
   */
  private selectBestCandidate(
    candidates: CompositionCandidate[]
  ): CompositionCandidate {
    if (candidates.length === 0) {
      throw new Error('No valid composition candidates found');
    }

    // スコアでソート
    candidates.sort((a, b) => b.score - a.score);

    return candidates[0];
  }

  /**
   * ブレンド重みを計算
   */
  private calculateBlendWeights(parts: ImagePart[]): number[] {
    // 信頼度に基づく重み付け
    const confidences = parts.map((p) => p.metadata.confidence);
    const sum = confidences.reduce((a, b) => a + b, 0);

    return sum > 0 ? confidences.map((c) => c / sum) : parts.map(() => 1 / parts.length);
  }

  /**
   * パーツをブレンド
   */
  private async blendParts(
    parts: ImagePart[],
    weights: number[]
  ): Promise<Buffer> {
    // 実装: 実際の画像ブレンド処理
    // シミュレーション: 空のバッファを返す

    const width = 512;
    const height = 512;
    const channels = 4; // RGBA
    const imageData = Buffer.alloc(width * height * channels);

    // シミュレーション: グレースケールパターン
    for (let i = 0; i < imageData.length; i += channels) {
      imageData[i] = 128; // R
      imageData[i + 1] = 128; // G
      imageData[i + 2] = 128; // B
      imageData[i + 3] = 255; // A
    }

    return imageData;
  }

  /**
   * 品質評価
   */
  private evaluateQuality(
    candidate: CompositionCandidate,
    promptVector: MultiLayerVector
  ): number {
    const vectorSim = this.scoreCandidate(candidate.parts, promptVector);
    const compatibility = candidate.compatibility;

    // 品質スコア = ベクトル類似度 + 互換性
    return (vectorSim + compatibility) / 2;
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<CompositionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): CompositionConfig {
    return { ...this.config };
  }
}
