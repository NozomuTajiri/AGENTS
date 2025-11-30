/**
 * 画像入力処理
 * 参照画像の受信、前処理、標準フォーマットへの変換
 */

import type { ProcessedImage } from '../../types/index.js';
import { randomBytes } from 'crypto';

/**
 * 画像処理設定
 */
interface ImageProcessingConfig {
  /** サムネイル最大幅 */
  thumbnailMaxWidth: number;
  /** サムネイル最大高さ */
  thumbnailMaxHeight: number;
  /** デフォルト出力フォーマット */
  defaultFormat: 'png' | 'jpg' | 'webp';
}

/**
 * デフォルト画像処理設定
 */
const DEFAULT_IMAGE_CONFIG: ImageProcessingConfig = {
  thumbnailMaxWidth: 256,
  thumbnailMaxHeight: 256,
  defaultFormat: 'png',
};

/**
 * 画像メタデータ
 */
interface ImageMetadata {
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp';
}

/**
 * 画像プロセッサ
 * 画像入力の標準化と前処理を実施
 */
export class ImageProcessor {
  private config: ImageProcessingConfig;

  constructor(config?: Partial<ImageProcessingConfig>) {
    this.config = { ...DEFAULT_IMAGE_CONFIG, ...config };
  }

  /**
   * 画像データを処理
   *
   * @param imageData - 処理対象の画像データ
   * @returns 処理済み画像
   */
  process(imageData: Buffer): ProcessedImage {
    const metadata = this.extractMetadata(imageData);
    const id = this.generateImageId();
    const thumbnail = this.generateThumbnail(imageData, metadata);

    return {
      id,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      data: imageData,
      thumbnail,
    };
  }

  /**
   * 複数画像の一括処理
   *
   * @param images - 処理対象の画像データ配列
   * @returns 処理済み画像配列
   */
  processMultiple(images: Buffer[]): ProcessedImage[] {
    return images.map((image) => this.process(image));
  }

  /**
   * 画像メタデータの抽出
   *
   * @param imageData - 画像データ
   * @returns 画像メタデータ
   */
  private extractMetadata(imageData: Buffer): ImageMetadata {
    const format = this.detectFormat(imageData);
    const dimensions = this.extractDimensions(imageData, format);

    return {
      width: dimensions.width,
      height: dimensions.height,
      format,
    };
  }

  /**
   * 画像フォーマットの検出
   *
   * @param buffer - 画像データ
   * @returns 検出されたフォーマット
   */
  private detectFormat(buffer: Buffer): 'png' | 'jpg' | 'webp' {
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

    // デフォルトはPNG
    return this.config.defaultFormat;
  }

  /**
   * 画像サイズの抽出
   *
   * @param buffer - 画像データ
   * @param format - 画像フォーマット
   * @returns 画像の幅と高さ
   */
  private extractDimensions(
    buffer: Buffer,
    format: 'png' | 'jpg' | 'webp'
  ): { width: number; height: number } {
    switch (format) {
      case 'png':
        return this.extractPngDimensions(buffer);
      case 'jpg':
        return this.extractJpegDimensions(buffer);
      case 'webp':
        return this.extractWebpDimensions(buffer);
      default:
        return { width: 0, height: 0 };
    }
  }

  /**
   * PNG画像のサイズ抽出
   *
   * @param buffer - PNG画像データ
   * @returns 画像の幅と高さ
   */
  private extractPngDimensions(buffer: Buffer): { width: number; height: number } {
    // PNG IHDR チャンクは8バイト目から
    // width: 16-19, height: 20-23
    if (buffer.length < 24) {
      return { width: 0, height: 0 };
    }

    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    return { width, height };
  }

  /**
   * JPEG画像のサイズ抽出
   *
   * @param buffer - JPEG画像データ
   * @returns 画像の幅と高さ
   */
  private extractJpegDimensions(buffer: Buffer): { width: number; height: number } {
    // JPEG SOF (Start Of Frame) マーカーを探す
    let offset = 2; // FF D8 の後から開始

    while (offset < buffer.length - 1) {
      // マーカーを探す (FF で始まる)
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];

      // SOF0-SOF15 マーカー (C0-CF, ただし C4, C8, CC を除く)
      if (
        (marker >= 0xc0 && marker <= 0xcf) &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        // SOF構造: FF Cn [length:2] [precision:1] [height:2] [width:2]
        if (offset + 9 <= buffer.length) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
      }

      // 次のセグメントへ
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }

    return { width: 0, height: 0 };
  }

  /**
   * WebP画像のサイズ抽出
   *
   * @param buffer - WebP画像データ
   * @returns 画像の幅と高さ
   */
  private extractWebpDimensions(buffer: Buffer): { width: number; height: number } {
    // WebP形式のサイズ抽出（簡易版）
    // VP8: 30-33 (width), 34-37 (height)
    // VP8L: 21-24 にサイズ情報
    if (buffer.length < 30) {
      return { width: 0, height: 0 };
    }

    // VP8L の場合
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
      if (buffer.length >= 25) {
        const bits = buffer.readUInt32LE(21);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
      }
    }

    // VP8 の場合
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
      if (buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      }
    }

    return { width: 0, height: 0 };
  }

  /**
   * サムネイル生成
   * 実際の画像処理ライブラリがない場合は元画像をそのまま返す
   *
   * @param imageData - 元画像データ
   * @param metadata - 画像メタデータ
   * @returns サムネイル画像データ
   */
  private generateThumbnail(imageData: Buffer, metadata: ImageMetadata): Buffer {
    // サイズがすでにサムネイルサイズ以下の場合はそのまま返す
    if (
      metadata.width <= this.config.thumbnailMaxWidth &&
      metadata.height <= this.config.thumbnailMaxHeight
    ) {
      return imageData;
    }

    // 実際の画像処理ライブラリ（sharp等）がない場合は元画像を返す
    // TODO: 本番環境ではsharpなどを使用してリサイズ処理を実装
    return imageData;
  }

  /**
   * ユニークな画像IDを生成
   *
   * @returns 画像ID
   */
  private generateImageId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `img_${timestamp}_${random}`;
  }

  /**
   * 設定の更新
   *
   * @param config - 更新する設定
   */
  updateConfig(config: Partial<ImageProcessingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   *
   * @returns 現在の画像処理設定
   */
  getConfig(): ImageProcessingConfig {
    return { ...this.config };
  }
}
