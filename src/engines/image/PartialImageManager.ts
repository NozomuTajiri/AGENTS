/**
 * 部分画像管理システム - メインマネージャー
 *
 * セグメンテーション、インデックス化、合成、差分生成を統合管理
 */

import type {
  ProcessedImage,
  ImagePart,
  MultiLayerVector,
  CompositionResult,
  GenerationParams,
} from '../../types/index.js';
import { Segmenter, type SegmentationConfig } from './Segmenter.js';
import { PartIndexer } from './PartIndexer.js';
import { Composer, type CompositionConfig } from './Composer.js';
import { DiffGenerator, type DiffGenerationConfig } from './DiffGenerator.js';

/**
 * 部分画像管理システム設定
 */
export interface PartialImageManagerConfig {
  segmentation?: Partial<SegmentationConfig>;
  composition?: Partial<CompositionConfig>;
  diffGeneration?: Partial<DiffGenerationConfig>;
}

/**
 * 画像処理結果
 */
export interface ImageProcessingResult {
  /** セグメント化されたパーツ */
  parts: ImagePart[];
  /** インデックス化された件数 */
  indexedCount: number;
  /** 処理時間（ミリ秒） */
  processingTime: number;
}

/**
 * 生成戦略
 */
export type GenerationStrategy = 'composition' | 'diff' | 'hybrid' | 'new';

/**
 * 生成リクエスト
 */
export interface GenerationRequest {
  /** プロンプトベクトル */
  promptVector: MultiLayerVector;
  /** プロンプトテキスト（オプション） */
  promptText?: string;
  /** 生成戦略 */
  strategy?: GenerationStrategy;
  /** 生成パラメータ */
  params?: Partial<GenerationParams>;
}

/**
 * 生成結果
 */
export interface GenerationResult {
  /** 生成された画像 */
  image: Buffer;
  /** 使用された戦略 */
  strategy: GenerationStrategy;
  /** 使用されたパーツ（compositionの場合） */
  usedParts?: ImagePart[];
  /** ベースパーツ（diffの場合） */
  basePart?: ImagePart;
  /** 合成結果（compositionの場合） */
  compositionResult?: CompositionResult;
  /** denoising strength（diffの場合） */
  denoisingStrength?: number;
  /** 生成パラメータ */
  params: GenerationParams;
  /** 処理時間（ミリ秒） */
  processingTime: number;
}

/**
 * 部分画像管理システム
 */
export class PartialImageManager {
  private segmenter: Segmenter;
  private indexer: PartIndexer;
  private composer: Composer;
  private diffGenerator: DiffGenerator;

  constructor(config?: PartialImageManagerConfig) {
    this.segmenter = new Segmenter(config?.segmentation);
    this.indexer = new PartIndexer();
    this.composer = new Composer(this.indexer, config?.composition);
    this.diffGenerator = new DiffGenerator(this.indexer, config?.diffGeneration);
  }

  /**
   * 画像を処理してパーツに分割、インデックス化
   */
  async processImage(image: ProcessedImage): Promise<ImageProcessingResult> {
    const startTime = Date.now();

    // 1. セグメンテーション
    const segmentResult = await this.segmenter.segment(image);

    // 2. インデックス化
    await this.indexer.indexParts(segmentResult.parts);

    const processingTime = Date.now() - startTime;

    return {
      parts: segmentResult.parts,
      indexedCount: segmentResult.totalParts,
      processingTime,
    };
  }

  /**
   * 複数画像を一括処理
   */
  async processImages(images: ProcessedImage[]): Promise<ImageProcessingResult[]> {
    const results: ImageProcessingResult[] = [];

    for (const image of images) {
      const result = await this.processImage(image);
      results.push(result);
    }

    return results;
  }

  /**
   * プロンプトベクトルから画像を生成
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    const startTime = Date.now();

    const strategy = request.strategy || await this.selectStrategy(request.promptVector);

    let result: GenerationResult;

    switch (strategy) {
      case 'composition':
        result = await this.generateByComposition(request);
        break;

      case 'diff':
        result = await this.generateByDiff(request);
        break;

      case 'hybrid':
        result = await this.generateByHybrid(request);
        break;

      case 'new':
      default:
        result = await this.generateNew(request);
        break;
    }

    result.processingTime = Date.now() - startTime;

    return result;
  }

  /**
   * 最適な生成戦略を選択
   */
  private async selectStrategy(promptVector: MultiLayerVector): Promise<GenerationStrategy> {
    // インデックス内のパーツ数を確認
    const stats = this.indexer.getStats();

    if (stats.totalParts === 0) {
      return 'new';
    }

    // 類似パーツを検索
    const searchResults = await this.indexer.search({
      queryVector: promptVector,
      topK: 5,
      minSimilarity: 0.6,
    });

    const hasHighSimilarity =
      searchResults.length > 0 && searchResults[0].similarity > 0.8;

    // 高類似度パーツがある場合は差分生成
    if (hasHighSimilarity) {
      return 'diff';
    }

    // 中程度の類似度パーツが複数ある場合は合成
    const hasMediumSimilarity =
      searchResults.length >= 3 && searchResults[0].similarity > 0.6;

    if (hasMediumSimilarity) {
      return 'composition';
    }

    // それ以外は新規生成
    return 'new';
  }

  /**
   * 合成による生成
   */
  private async generateByComposition(
    request: GenerationRequest
  ): Promise<GenerationResult> {
    const compositionResult = await this.composer.compose(request.promptVector);

    return {
      image: compositionResult.image,
      strategy: 'composition',
      usedParts: compositionResult.parts,
      compositionResult,
      params: this.buildParams(request.params),
      processingTime: 0, // 外側で設定
    };
  }

  /**
   * 差分生成
   */
  private async generateByDiff(
    request: GenerationRequest
  ): Promise<GenerationResult> {
    const diffResult = await this.diffGenerator.generateDiff(
      request.promptVector,
      undefined,
      request.promptText
    );

    return {
      image: diffResult.image,
      strategy: 'diff',
      basePart: diffResult.basePart,
      denoisingStrength: diffResult.denoisingStrength,
      params: diffResult.params,
      processingTime: 0,
    };
  }

  /**
   * ハイブリッド生成（合成 + 差分）
   */
  private async generateByHybrid(
    request: GenerationRequest
  ): Promise<GenerationResult> {
    // 1. まず合成で候補を作成
    const compositionResult = await this.composer.compose(request.promptVector);

    // 2. 合成結果を一時的に処理してパーツ化
    const tempImage: ProcessedImage = {
      id: `temp-${Date.now()}`,
      format: 'png',
      width: 512,
      height: 512,
      data: compositionResult.image,
      thumbnail: compositionResult.image,
    };

    const tempParts = await this.segmenter.segment(tempImage);

    // 3. 代表パーツを取得（最も信頼度が高いもの）
    const basePart = tempParts.parts.sort(
      (a, b) => b.metadata.confidence - a.metadata.confidence
    )[0];

    // 4. 差分生成で微調整
    const diffResult = await this.diffGenerator.generateDiff(
      request.promptVector,
      undefined,
      request.promptText
    );

    return {
      image: diffResult.image,
      strategy: 'hybrid',
      usedParts: compositionResult.parts,
      basePart,
      compositionResult,
      denoisingStrength: diffResult.denoisingStrength,
      params: diffResult.params,
      processingTime: 0,
    };
  }

  /**
   * 新規生成
   */
  private async generateNew(request: GenerationRequest): Promise<GenerationResult> {
    // 実装: 完全新規生成（AI APIを呼び出し）
    // シミュレーション: ダミー画像を生成

    const width = 512;
    const height = 512;
    const channels = 4;
    const image = Buffer.alloc(width * height * channels);

    // ランダムパターン
    for (let i = 0; i < image.length; i += channels) {
      image[i] = Math.floor(Math.random() * 256); // R
      image[i + 1] = Math.floor(Math.random() * 256); // G
      image[i + 2] = Math.floor(Math.random() * 256); // B
      image[i + 3] = 255; // A
    }

    return {
      image,
      strategy: 'new',
      params: this.buildParams(request.params),
      processingTime: 0,
    };
  }

  /**
   * 生成パラメータを構築
   */
  private buildParams(partial?: Partial<GenerationParams>): GenerationParams {
    return {
      model: partial?.model || 'stable-diffusion-v1',
      seed: partial?.seed || Math.floor(Math.random() * 1000000),
      steps: partial?.steps || 30,
      cfgScale: partial?.cfgScale || 7.5,
      denoisingStrength: partial?.denoisingStrength,
    };
  }

  /**
   * パーツを検索
   */
  async searchParts(
    query: MultiLayerVector,
    options?: {
      topK?: number;
      minSimilarity?: number;
      partType?: import('../../types/index.js').ImagePartType;
    }
  ): Promise<ImagePart[]> {
    const results = await this.indexer.search({
      queryVector: query,
      topK: options?.topK || 10,
      minSimilarity: options?.minSimilarity || 0.5,
      partType: options?.partType,
    });

    return results.map((r) => r.part);
  }

  /**
   * パーツをIDで取得
   */
  getPart(partId: string): ImagePart | undefined {
    return this.indexer.getPart(partId);
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    indexStats: ReturnType<PartIndexer['getStats']>;
    segmenterConfig: SegmentationConfig;
    composerConfig: CompositionConfig;
    diffGeneratorConfig: DiffGenerationConfig;
  } {
    return {
      indexStats: this.indexer.getStats(),
      segmenterConfig: this.segmenter.getConfig(),
      composerConfig: this.composer.getConfig(),
      diffGeneratorConfig: this.diffGenerator.getConfig(),
    };
  }

  /**
   * インデックスをクリア
   */
  clearIndex(): void {
    this.indexer.clear();
  }

  /**
   * パーツを削除
   */
  removePart(partId: string): boolean {
    return this.indexer.removePart(partId);
  }

  /**
   * 設定を更新
   */
  updateConfig(config: PartialImageManagerConfig): void {
    if (config.segmentation) {
      this.segmenter.updateConfig(config.segmentation);
    }
    if (config.composition) {
      this.composer.updateConfig(config.composition);
    }
    if (config.diffGeneration) {
      this.diffGenerator.updateConfig(config.diffGeneration);
    }
  }

  /**
   * バリエーション生成
   */
  async generateVariations(
    baseVector: MultiLayerVector,
    count: number = 3,
    variation: number = 0.2
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (let i = 0; i < count; i++) {
      // ベクトルに小さなノイズを加える
      const variedVector = this.addVectorNoise(baseVector, variation);

      const result = await this.generate({
        promptVector: variedVector,
        strategy: 'diff',
      });

      results.push(result);
    }

    return results;
  }

  /**
   * ベクトルにノイズを追加
   */
  private addVectorNoise(
    vector: MultiLayerVector,
    noiseLevel: number
  ): MultiLayerVector {
    const addNoise = (arr: Float32Array): Float32Array => {
      const result = new Float32Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        result[i] = arr[i] + (Math.random() - 0.5) * noiseLevel * 2;
      }
      return result;
    };

    return {
      subject: addNoise(vector.subject),
      attribute: addNoise(vector.attribute),
      style: addNoise(vector.style),
      composition: addNoise(vector.composition),
      emotion: addNoise(vector.emotion),
      relationMatrix: vector.relationMatrix,
      timestamp: new Date(),
    };
  }

  /**
   * エクスポート（永続化用）
   */
  async export(): Promise<ExportData> {
    const stats = this.indexer.getStats();
    const parts: ImagePart[] = [];

    // 全パーツを取得
    for (const type of ['foreground', 'background', 'detail', 'global'] as const) {
      const typeParts = this.indexer.getPartsByType(type);
      parts.push(...typeParts);
    }

    return {
      version: '1.0.0',
      timestamp: new Date(),
      stats,
      parts,
      config: {
        segmentation: this.segmenter.getConfig(),
        composition: this.composer.getConfig(),
        diffGeneration: this.diffGenerator.getConfig(),
      },
    };
  }

  /**
   * インポート（復元用）
   */
  async import(data: ExportData): Promise<void> {
    // インデックスをクリア
    this.clearIndex();

    // パーツをインデックス化
    await this.indexer.indexParts(data.parts);

    // 設定を復元
    if (data.config) {
      this.updateConfig(data.config);
    }
  }
}

/**
 * エクスポートデータ
 */
export interface ExportData {
  version: string;
  timestamp: Date;
  stats: ReturnType<PartIndexer['getStats']>;
  parts: ImagePart[];
  config?: PartialImageManagerConfig;
}
