/**
 * 入力バリデーション処理
 * プロンプト長制限、画像フォーマット・サイズ検証、不正入力のフィルタリング
 */

import type { ValidationResult, ValidationError, MultiModalInput } from '../../types/index.js';

/**
 * バリデーション設定
 */
interface ValidationConfig {
  maxPromptLength: number;
  maxImageSize: number;
  allowedImageFormats: string[];
  maxReferenceImages: number;
}

/**
 * デフォルトバリデーション設定
 */
const DEFAULT_CONFIG: ValidationConfig = {
  maxPromptLength: 5000,
  maxImageSize: 10 * 1024 * 1024, // 10MB
  allowedImageFormats: ['png', 'jpg', 'jpeg', 'webp'],
  maxReferenceImages: 5,
};

/**
 * 入力バリデータ
 * マルチモーダル入力の検証を実施
 */
export class Validator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * マルチモーダル入力の総合バリデーション
   *
   * @param input - 検証対象の入力データ
   * @returns バリデーション結果
   */
  validate(input: MultiModalInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // 入力が空でないことを確認
    if (!input.text && !input.image && !input.sketch) {
      errors.push({
        field: 'input',
        message: 'At least one input type (text, image, or sketch) must be provided',
        code: 'EMPTY_INPUT',
      });
    }

    // テキストプロンプトの検証
    if (input.text !== undefined) {
      const textErrors = this.validateText(input.text);
      errors.push(...textErrors);
    }

    // 画像入力の検証
    if (input.image !== undefined) {
      const imageErrors = this.validateImage(input.image);
      errors.push(...imageErrors);
    }

    // スケッチ入力の検証
    if (input.sketch !== undefined) {
      const sketchErrors = this.validateSketch(input.sketch);
      errors.push(...sketchErrors);
    }

    // 参照画像の検証
    if (input.referenceImages !== undefined) {
      const refErrors = this.validateReferenceImages(input.referenceImages);
      errors.push(...refErrors);

      if (input.referenceImages.length > 3) {
        warnings.push('Large number of reference images may impact processing time');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * テキストプロンプトのバリデーション
   *
   * @param text - 検証対象のテキスト
   * @returns エラー配列
   */
  private validateText(text: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // 空文字チェック
    if (text.trim().length === 0) {
      errors.push({
        field: 'text',
        message: 'Text prompt cannot be empty or whitespace only',
        code: 'EMPTY_TEXT',
      });
      return errors;
    }

    // 長さチェック
    if (text.length > this.config.maxPromptLength) {
      errors.push({
        field: 'text',
        message: `Text prompt exceeds maximum length of ${this.config.maxPromptLength} characters`,
        code: 'TEXT_TOO_LONG',
      });
    }

    // 不正な文字のチェック
    const hasControlChars = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(text);
    if (hasControlChars) {
      errors.push({
        field: 'text',
        message: 'Text contains invalid control characters',
        code: 'INVALID_CHARACTERS',
      });
    }

    return errors;
  }

  /**
   * 画像入力のバリデーション
   *
   * @param image - 検証対象の画像データ
   * @returns エラー配列
   */
  private validateImage(image: Buffer): ValidationError[] {
    const errors: ValidationError[] = [];

    // サイズチェック
    if (image.length === 0) {
      errors.push({
        field: 'image',
        message: 'Image data cannot be empty',
        code: 'EMPTY_IMAGE',
      });
      return errors;
    }

    if (image.length > this.config.maxImageSize) {
      errors.push({
        field: 'image',
        message: `Image size exceeds maximum of ${this.config.maxImageSize} bytes`,
        code: 'IMAGE_TOO_LARGE',
      });
    }

    // フォーマットチェック（マジックナンバー）
    const format = this.detectImageFormat(image);
    if (!format) {
      errors.push({
        field: 'image',
        message: 'Unable to detect valid image format',
        code: 'INVALID_IMAGE_FORMAT',
      });
    } else if (!this.config.allowedImageFormats.includes(format)) {
      errors.push({
        field: 'image',
        message: `Image format '${format}' is not allowed. Allowed formats: ${this.config.allowedImageFormats.join(', ')}`,
        code: 'UNSUPPORTED_FORMAT',
      });
    }

    return errors;
  }

  /**
   * スケッチ入力のバリデーション
   *
   * @param sketch - 検証対象のスケッチデータ
   * @returns エラー配列
   */
  private validateSketch(sketch: Buffer): ValidationError[] {
    const errors: ValidationError[] = [];

    if (sketch.length === 0) {
      errors.push({
        field: 'sketch',
        message: 'Sketch data cannot be empty',
        code: 'EMPTY_SKETCH',
      });
      return errors;
    }

    // スケッチデータのサイズチェック
    if (sketch.length > this.config.maxImageSize) {
      errors.push({
        field: 'sketch',
        message: `Sketch size exceeds maximum of ${this.config.maxImageSize} bytes`,
        code: 'SKETCH_TOO_LARGE',
      });
    }

    return errors;
  }

  /**
   * 参照画像配列のバリデーション
   *
   * @param images - 検証対象の画像配列
   * @returns エラー配列
   */
  private validateReferenceImages(images: Buffer[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // 数量チェック
    if (images.length > this.config.maxReferenceImages) {
      errors.push({
        field: 'referenceImages',
        message: `Number of reference images (${images.length}) exceeds maximum of ${this.config.maxReferenceImages}`,
        code: 'TOO_MANY_REFERENCES',
      });
    }

    // 各画像の検証
    images.forEach((image, index) => {
      const imageErrors = this.validateImage(image);
      imageErrors.forEach((error) => {
        errors.push({
          ...error,
          field: `referenceImages[${index}]`,
        });
      });
    });

    return errors;
  }

  /**
   * 画像フォーマットの検出（マジックナンバーベース）
   *
   * @param buffer - 画像データ
   * @returns 検出されたフォーマット、または null
   */
  private detectImageFormat(buffer: Buffer): string | null {
    if (buffer.length < 4) {
      return null;
    }

    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'png';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpg';
    }

    // WebP: RIFF ... WEBP
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return 'webp';
    }

    return null;
  }

  /**
   * バリデーション設定の更新
   *
   * @param config - 更新する設定
   */
  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   *
   * @returns 現在のバリデーション設定
   */
  getConfig(): ValidationConfig {
    return { ...this.config };
  }
}
