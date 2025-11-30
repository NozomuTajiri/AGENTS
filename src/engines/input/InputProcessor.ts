/**
 * 統合入力処理システム
 * マルチモーダル入力の統合処理とワークフロー管理
 */

import type {
  MultiModalInput,
  ProcessedPrompt,
  ProcessedImage,
  ProcessedSketch,
  ValidationResult,
} from '../../types/index.js';
import { TextProcessor } from './TextProcessor.js';
import { ImageProcessor } from './ImageProcessor.js';
import { SketchProcessor } from './SketchProcessor.js';
import { Validator } from './Validator.js';

/**
 * 入力処理結果
 */
export interface InputProcessingResult {
  /** 処理済みテキストプロンプト */
  text?: ProcessedPrompt;
  /** 処理済み画像 */
  image?: ProcessedImage;
  /** 処理済みスケッチ */
  sketch?: ProcessedSketch;
  /** 処理済み参照画像 */
  referenceImages?: ProcessedImage[];
  /** バリデーション結果 */
  validation: ValidationResult;
  /** 処理時間（ミリ秒） */
  processingTime: number;
  /** 入力タイプ */
  inputType: InputType;
}

/**
 * 入力タイプ
 */
export type InputType = 'text-only' | 'image-only' | 'sketch-only' | 'multimodal';

/**
 * 入力プロセッサ設定
 */
export interface InputProcessorConfig {
  /** バリデーションを実行するか */
  enableValidation: boolean;
  /** 処理タイムアウト（ミリ秒） */
  processingTimeout: number;
  /** パフォーマンス目標（ミリ秒） */
  performanceTarget: number;
}

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG: InputProcessorConfig = {
  enableValidation: true,
  processingTimeout: 5000,
  performanceTarget: 50,
};

/**
 * 統合入力プロセッサ
 * テキスト、画像、スケッチのマルチモーダル入力を統合処理
 */
export class InputProcessor {
  private textProcessor: TextProcessor;
  private imageProcessor: ImageProcessor;
  private sketchProcessor: SketchProcessor;
  private validator: Validator;
  private config: InputProcessorConfig;

  constructor(config?: Partial<InputProcessorConfig>) {
    this.textProcessor = new TextProcessor();
    this.imageProcessor = new ImageProcessor();
    this.sketchProcessor = new SketchProcessor();
    this.validator = new Validator();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * マルチモーダル入力を処理
   *
   * @param input - 処理対象の入力データ
   * @returns 処理結果
   * @throws {Error} バリデーションエラーまたはタイムアウト
   */
  async process(input: MultiModalInput): Promise<InputProcessingResult> {
    const startTime = performance.now();

    // タイムアウト処理
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Processing timeout exceeded ${this.config.processingTimeout}ms`));
      }, this.config.processingTimeout);
    });

    const processingPromise = this.processInternal(input, startTime);

    return Promise.race([processingPromise, timeoutPromise]);
  }

  /**
   * 内部処理メソッド
   *
   * @param input - 処理対象の入力データ
   * @param startTime - 処理開始時刻
   * @returns 処理結果
   */
  private async processInternal(
    input: MultiModalInput,
    startTime: number
  ): Promise<InputProcessingResult> {
    // バリデーション
    let validation: ValidationResult;
    if (this.config.enableValidation) {
      validation = this.validator.validate(input);
      if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }
    } else {
      validation = { valid: true, errors: [], warnings: [] };
    }

    // 入力タイプの判定
    const inputType = this.determineInputType(input);

    // 各モダリティの処理
    const result: InputProcessingResult = {
      validation,
      processingTime: 0,
      inputType,
    };

    // テキスト処理
    if (input.text) {
      result.text = this.textProcessor.process(input.text);
    }

    // 画像処理
    if (input.image) {
      result.image = this.imageProcessor.process(input.image);
    }

    // スケッチ処理
    if (input.sketch) {
      result.sketch = this.sketchProcessor.process(input.sketch);
    }

    // 参照画像処理
    if (input.referenceImages && input.referenceImages.length > 0) {
      result.referenceImages = this.imageProcessor.processMultiple(input.referenceImages);
    }

    // 処理時間の記録
    const endTime = performance.now();
    result.processingTime = endTime - startTime;

    // パフォーマンス警告
    if (result.processingTime > this.config.performanceTarget) {
      result.validation.warnings.push(
        `Processing time (${result.processingTime.toFixed(2)}ms) exceeded target (${this.config.performanceTarget}ms)`
      );
    }

    return result;
  }

  /**
   * 入力タイプの判定
   *
   * @param input - 入力データ
   * @returns 入力タイプ
   */
  private determineInputType(input: MultiModalInput): InputType {
    const hasText = input.text !== undefined && input.text.length > 0;
    const hasImage = input.image !== undefined;
    const hasSketch = input.sketch !== undefined;
    const hasReferences =
      input.referenceImages !== undefined && input.referenceImages.length > 0;

    const modalityCount = [hasText, hasImage, hasSketch, hasReferences].filter(Boolean).length;

    if (modalityCount > 1) {
      return 'multimodal';
    }

    if (hasText) return 'text-only';
    if (hasImage || hasReferences) return 'image-only';
    if (hasSketch) return 'sketch-only';

    return 'text-only'; // デフォルト
  }

  /**
   * 同期的に処理（非推奨：パフォーマンステスト用）
   *
   * @param input - 処理対象の入力データ
   * @returns 処理結果
   */
  processSync(input: MultiModalInput): InputProcessingResult {
    const startTime = performance.now();

    // バリデーション
    let validation: ValidationResult;
    if (this.config.enableValidation) {
      validation = this.validator.validate(input);
      if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }
    } else {
      validation = { valid: true, errors: [], warnings: [] };
    }

    const inputType = this.determineInputType(input);

    const result: InputProcessingResult = {
      validation,
      processingTime: 0,
      inputType,
    };

    // 各モダリティの処理
    if (input.text) {
      result.text = this.textProcessor.process(input.text);
    }

    if (input.image) {
      result.image = this.imageProcessor.process(input.image);
    }

    if (input.sketch) {
      result.sketch = this.sketchProcessor.process(input.sketch);
    }

    if (input.referenceImages && input.referenceImages.length > 0) {
      result.referenceImages = this.imageProcessor.processMultiple(input.referenceImages);
    }

    const endTime = performance.now();
    result.processingTime = endTime - startTime;

    return result;
  }

  /**
   * テキストのみの簡易処理
   *
   * @param text - テキストプロンプト
   * @returns 処理済みプロンプト
   */
  processTextOnly(text: string): ProcessedPrompt {
    return this.textProcessor.process(text);
  }

  /**
   * 画像のみの簡易処理
   *
   * @param image - 画像データ
   * @returns 処理済み画像
   */
  processImageOnly(image: Buffer): ProcessedImage {
    return this.imageProcessor.process(image);
  }

  /**
   * スケッチのみの簡易処理
   *
   * @param sketch - スケッチデータ
   * @returns 処理済みスケッチ
   */
  processSketchOnly(sketch: Buffer): ProcessedSketch {
    return this.sketchProcessor.process(sketch);
  }

  /**
   * 設定の更新
   *
   * @param config - 更新する設定
   */
  updateConfig(config: Partial<InputProcessorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   *
   * @returns 現在の設定
   */
  getConfig(): InputProcessorConfig {
    return { ...this.config };
  }

  /**
   * 各プロセッサへのアクセス（高度な使用）
   */
  getTextProcessor(): TextProcessor {
    return this.textProcessor;
  }

  getImageProcessor(): ImageProcessor {
    return this.imageProcessor;
  }

  getSketchProcessor(): SketchProcessor {
    return this.sketchProcessor;
  }

  getValidator(): Validator {
    return this.validator;
  }
}
