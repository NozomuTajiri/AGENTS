/**
 * 部分的差分生成エンジン
 *
 * 最も類似したパーツを基にした差分生成を行い、
 * denoising strengthを自動決定する
 */

import type {
  ImagePart,
  PromptDelta,
  MultiLayerVector,
  GenerationParams,
} from '../../types/index.js';
import type { PartIndexer } from './PartIndexer.js';

/**
 * 差分生成設定
 */
export interface DiffGenerationConfig {
  /** デフォルトのdenoising strength */
  defaultDenoisingStrength: number;
  /** 最小denoising strength */
  minDenoisingStrength: number;
  /** 最大denoising strength */
  maxDenoisingStrength: number;
  /** 類似度閾値 */
  similarityThreshold: number;
}

/**
 * 差分生成結果
 */
export interface DiffGenerationResult {
  /** 生成された画像 */
  image: Buffer;
  /** 使用されたベースパーツ */
  basePart: ImagePart;
  /** 計算されたdenoising strength */
  denoisingStrength: number;
  /** プロンプトデルタ */
  promptDelta: PromptDelta;
  /** 生成パラメータ */
  params: GenerationParams;
  /** 差分の大きさ（0-1） */
  deltaMagnitude: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: DiffGenerationConfig = {
  defaultDenoisingStrength: 0.5,
  minDenoisingStrength: 0.1,
  maxDenoisingStrength: 0.9,
  similarityThreshold: 0.6,
};

/**
 * 差分生成器
 */
export class DiffGenerator {
  private config: DiffGenerationConfig;
  private indexer: PartIndexer;

  constructor(indexer: PartIndexer, config?: Partial<DiffGenerationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.indexer = indexer;
  }

  /**
   * 差分生成を実行
   *
   * @param targetVector - 目標ベクトル
   * @param currentPrompt - 現在のプロンプト（オプション）
   * @param targetPrompt - 目標プロンプト（オプション）
   */
  async generateDiff(
    targetVector: MultiLayerVector,
    currentPrompt?: string,
    targetPrompt?: string
  ): Promise<DiffGenerationResult> {
    // 1. 最も類似したベースパーツを検索
    const basePart = await this.findBestBasePart(targetVector);

    if (!basePart) {
      throw new Error('No suitable base part found for diff generation');
    }

    // 2. プロンプトデルタを計算
    const promptDelta = this.calculatePromptDelta(
      currentPrompt || '',
      targetPrompt || ''
    );

    // 3. ベクトル差分を計算
    const vectorDelta = this.calculateVectorDelta(basePart.vectors, targetVector);

    // 4. Denoising strengthを自動決定
    const denoisingStrength = this.calculateDenoisingStrength(
      vectorDelta,
      promptDelta
    );

    // 5. 生成パラメータを構築
    const params = this.buildGenerationParams(
      basePart,
      denoisingStrength,
      promptDelta
    );

    // 6. 差分画像を生成（シミュレーション）
    const image = await this.synthesizeDiff(basePart, params);

    return {
      image,
      basePart,
      denoisingStrength,
      promptDelta,
      params,
      deltaMagnitude: vectorDelta.magnitude,
    };
  }

  /**
   * 最適なベースパーツを検索
   */
  private async findBestBasePart(
    targetVector: MultiLayerVector
  ): Promise<ImagePart | null> {
    const results = await this.indexer.search({
      queryVector: targetVector,
      topK: 1,
      minSimilarity: this.config.similarityThreshold,
    });

    return results.length > 0 ? results[0].part : null;
  }

  /**
   * プロンプトデルタを計算
   */
  private calculatePromptDelta(
    currentPrompt: string,
    targetPrompt: string
  ): PromptDelta {
    const currentTokens = this.tokenize(currentPrompt);
    const targetTokens = this.tokenize(targetPrompt);

    const currentSet = new Set(currentTokens);
    const targetSet = new Set(targetTokens);

    // 追加された用語
    const addedTerms = targetTokens.filter((token) => !currentSet.has(token));

    // 削除された用語
    const removedTerms = currentTokens.filter((token) => !targetSet.has(token));

    // 変更された用語（簡易的な実装）
    const modifiedTerms: Array<{ from: string; to: string }> = [];

    // 意味的距離を計算（簡易版）
    const semanticDistance = this.calculateSemanticDistance(
      currentPrompt,
      targetPrompt
    );

    return {
      addedTerms,
      removedTerms,
      modifiedTerms,
      semanticDistance,
    };
  }

  /**
   * テキストをトークン化
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * 意味的距離を計算（簡易版）
   */
  private calculateSemanticDistance(text1: string, text2: string): number {
    if (!text1 && !text2) return 0;
    if (!text1 || !text2) return 1;

    const tokens1 = this.tokenize(text1);
    const tokens2 = this.tokenize(text2);

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    // Jaccard距離
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    return 1 - jaccard; // 距離に変換
  }

  /**
   * ベクトル差分を計算
   */
  private calculateVectorDelta(
    baseVector: MultiLayerVector,
    targetVector: MultiLayerVector
  ): VectorDelta {
    const layerDeltas: Partial<Record<string, number>> = {};

    // 各層の差分を計算
    const layers: Array<keyof MultiLayerVector> = [
      'subject',
      'attribute',
      'style',
      'composition',
      'emotion',
    ];

    let totalDelta = 0;

    for (const layer of layers) {
      const base = baseVector[layer] as Float32Array;
      const target = targetVector[layer] as Float32Array;

      const delta = this.calculateLayerDelta(base, target);
      layerDeltas[layer] = delta;
      totalDelta += delta;
    }

    const magnitude = totalDelta / layers.length;

    return {
      layerDeltas,
      magnitude,
    };
  }

  /**
   * 層ごとの差分計算
   */
  private calculateLayerDelta(
    baseVector: Float32Array,
    targetVector: Float32Array
  ): number {
    if (baseVector.length !== targetVector.length) {
      throw new Error('Vector dimensions must match');
    }

    let sumSquaredDiff = 0;

    for (let i = 0; i < baseVector.length; i++) {
      const diff = targetVector[i] - baseVector[i];
      sumSquaredDiff += diff * diff;
    }

    return Math.sqrt(sumSquaredDiff / baseVector.length);
  }

  /**
   * Denoising strengthを計算
   */
  private calculateDenoisingStrength(
    vectorDelta: VectorDelta,
    promptDelta: PromptDelta
  ): number {
    // ベクトル差分に基づく強度
    const vectorStrength = Math.min(vectorDelta.magnitude, 1.0);

    // プロンプト差分に基づく強度
    const promptStrength = Math.min(promptDelta.semanticDistance, 1.0);

    // 組み合わせ（重み付き平均）
    const combinedStrength = vectorStrength * 0.6 + promptStrength * 0.4;

    // 設定範囲内にクランプ
    return Math.max(
      this.config.minDenoisingStrength,
      Math.min(this.config.maxDenoisingStrength, combinedStrength)
    );
  }

  /**
   * 生成パラメータを構築
   */
  private buildGenerationParams(
    basePart: ImagePart,
    denoisingStrength: number,
    promptDelta: PromptDelta
  ): GenerationParams {
    // ベースパーツの生成パラメータを継承
    const baseParams = basePart.metadata.generationParams;

    return {
      model: baseParams?.model || 'stable-diffusion-v1',
      seed: baseParams?.seed || Math.floor(Math.random() * 1000000),
      steps: baseParams?.steps || 30,
      cfgScale: baseParams?.cfgScale || 7.5,
      denoisingStrength,
    };
  }

  /**
   * 差分画像を合成（シミュレーション）
   */
  private async synthesizeDiff(
    basePart: ImagePart,
    params: GenerationParams
  ): Promise<Buffer> {
    // 実装: 実際のAI画像生成API呼び出し
    // シミュレーション: 空のバッファを返す

    const width = 512;
    const height = 512;
    const channels = 4; // RGBA
    const imageData = Buffer.alloc(width * height * channels);

    // denoising strengthに応じたノイズパターン
    const noiseLevel = Math.floor(params.denoisingStrength! * 100);

    for (let i = 0; i < imageData.length; i += channels) {
      const noise = Math.random() * noiseLevel;
      imageData[i] = 128 + noise; // R
      imageData[i + 1] = 128 + noise; // G
      imageData[i + 2] = 128 + noise; // B
      imageData[i + 3] = 255; // A
    }

    return imageData;
  }

  /**
   * 複数ベースパーツからの差分生成
   */
  async generateMultiBaseDiff(
    targetVector: MultiLayerVector,
    baseParts: ImagePart[],
    targetPrompt?: string
  ): Promise<DiffGenerationResult[]> {
    const results: DiffGenerationResult[] = [];

    for (const basePart of baseParts) {
      const promptDelta = this.calculatePromptDelta('', targetPrompt || '');
      const vectorDelta = this.calculateVectorDelta(basePart.vectors, targetVector);
      const denoisingStrength = this.calculateDenoisingStrength(
        vectorDelta,
        promptDelta
      );
      const params = this.buildGenerationParams(
        basePart,
        denoisingStrength,
        promptDelta
      );
      const image = await this.synthesizeDiff(basePart, params);

      results.push({
        image,
        basePart,
        denoisingStrength,
        promptDelta,
        params,
        deltaMagnitude: vectorDelta.magnitude,
      });
    }

    // デルタの大きさでソート（小さい順 = より類似）
    return results.sort((a, b) => a.deltaMagnitude - b.deltaMagnitude);
  }

  /**
   * 段階的差分生成
   */
  async generateProgressiveDiff(
    startVector: MultiLayerVector,
    endVector: MultiLayerVector,
    steps: number = 5
  ): Promise<DiffGenerationResult[]> {
    const results: DiffGenerationResult[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const interpolatedVector = this.interpolateVectors(
        startVector,
        endVector,
        t
      );

      const result = await this.generateDiff(interpolatedVector);
      results.push(result);
    }

    return results;
  }

  /**
   * ベクトル補間
   */
  private interpolateVectors(
    start: MultiLayerVector,
    end: MultiLayerVector,
    t: number
  ): MultiLayerVector {
    const interpolated: MultiLayerVector = {
      subject: this.interpolateFloat32Arrays(start.subject, end.subject, t),
      attribute: this.interpolateFloat32Arrays(start.attribute, end.attribute, t),
      style: this.interpolateFloat32Arrays(start.style, end.style, t),
      composition: this.interpolateFloat32Arrays(
        start.composition,
        end.composition,
        t
      ),
      emotion: this.interpolateFloat32Arrays(start.emotion, end.emotion, t),
      relationMatrix: start.relationMatrix, // 簡易実装: startをそのまま使用
      timestamp: new Date(),
    };

    return interpolated;
  }

  /**
   * Float32Array補間
   */
  private interpolateFloat32Arrays(
    start: Float32Array,
    end: Float32Array,
    t: number
  ): Float32Array {
    const result = new Float32Array(start.length);

    for (let i = 0; i < start.length; i++) {
      result[i] = start[i] * (1 - t) + end[i] * t;
    }

    return result;
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<DiffGenerationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): DiffGenerationConfig {
    return { ...this.config };
  }
}

/**
 * ベクトルデルタ（内部使用）
 */
interface VectorDelta {
  layerDeltas: Partial<Record<string, number>>;
  magnitude: number;
}
