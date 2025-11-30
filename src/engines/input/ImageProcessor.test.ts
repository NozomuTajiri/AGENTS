/**
 * ImageProcessor ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImageProcessor } from './ImageProcessor.js';

describe('ImageProcessor', () => {
  let processor: ImageProcessor;

  beforeEach(() => {
    processor = new ImageProcessor();
  });

  /**
   * テスト用PNG画像データを生成
   */
  function createTestPng(width: number, height: number): Buffer {
    const buffer = Buffer.alloc(24);
    // PNG signature
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(0x0d0a1a0a, 4);
    // IHDR chunk
    buffer.writeUInt32BE(0x0000000d, 8); // chunk length
    buffer.write('IHDR', 12);
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
  }

  /**
   * テスト用JPEG画像データを生成
   */
  function createTestJpeg(width: number, height: number): Buffer {
    const buffer = Buffer.alloc(20);
    // JPEG signature
    buffer[0] = 0xff;
    buffer[1] = 0xd8;
    buffer[2] = 0xff;
    // SOF0 marker
    buffer[3] = 0xc0;
    buffer.writeUInt16BE(17, 4); // segment length
    buffer[6] = 8; // precision
    buffer.writeUInt16BE(height, 7);
    buffer.writeUInt16BE(width, 9);
    return buffer;
  }

  /**
   * テスト用WebP画像データを生成
   */
  function createTestWebp(width: number, height: number): Buffer {
    const buffer = Buffer.alloc(30);
    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(22, 4); // file size - 8
    buffer.write('WEBP', 8);
    // VP8 chunk
    buffer.write('VP8 ', 12);
    buffer.writeUInt32LE(10, 16); // chunk size
    // Frame tag
    buffer.writeUInt16LE(width & 0x3fff, 26);
    buffer.writeUInt16LE(height & 0x3fff, 28);
    return buffer;
  }

  describe('process', () => {
    it('PNG画像を処理できる', () => {
      const pngBuffer = createTestPng(800, 600);
      const result = processor.process(pngBuffer);

      expect(result.format).toBe('png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.id).toMatch(/^img_/);
      expect(result.data).toBe(pngBuffer);
    });

    it('JPEG画像を処理できる', () => {
      const jpegBuffer = createTestJpeg(1024, 768);
      const result = processor.process(jpegBuffer);

      expect(result.format).toBe('jpg');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.id).toMatch(/^img_/);
    });

    it('WebP画像を処理できる', () => {
      const webpBuffer = createTestWebp(1920, 1080);
      const result = processor.process(webpBuffer);

      expect(result.format).toBe('webp');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.id).toMatch(/^img_/);
    });

    it('サムネイルを生成する', () => {
      const pngBuffer = createTestPng(800, 600);
      const result = processor.process(pngBuffer);

      expect(result.thumbnail).toBeDefined();
      expect(Buffer.isBuffer(result.thumbnail)).toBe(true);
    });

    it('小さい画像の場合はサムネイルに元画像を使用する', () => {
      const pngBuffer = createTestPng(200, 150);
      const result = processor.process(pngBuffer);

      expect(result.thumbnail).toBe(pngBuffer);
    });

    it('各画像にユニークなIDを付与する', () => {
      const pngBuffer = createTestPng(800, 600);
      const result1 = processor.process(pngBuffer);
      const result2 = processor.process(pngBuffer);

      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('processMultiple', () => {
    it('複数の画像を一括処理できる', () => {
      const images = [
        createTestPng(800, 600),
        createTestJpeg(1024, 768),
        createTestWebp(1920, 1080),
      ];

      const results = processor.processMultiple(images);

      expect(results).toHaveLength(3);
      expect(results[0].format).toBe('png');
      expect(results[1].format).toBe('jpg');
      expect(results[2].format).toBe('webp');
    });

    it('空の配列を処理できる', () => {
      const results = processor.processMultiple([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('updateConfig', () => {
    it('サムネイルサイズを更新できる', () => {
      processor.updateConfig({
        thumbnailMaxWidth: 128,
        thumbnailMaxHeight: 128,
      });

      const config = processor.getConfig();
      expect(config.thumbnailMaxWidth).toBe(128);
      expect(config.thumbnailMaxHeight).toBe(128);
    });

    it('デフォルトフォーマットを更新できる', () => {
      processor.updateConfig({ defaultFormat: 'webp' });

      const config = processor.getConfig();
      expect(config.defaultFormat).toBe('webp');
    });
  });

  describe('フォーマット検出', () => {
    it('不明なフォーマットの場合はデフォルトを使用する', () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const result = processor.process(unknownBuffer);

      expect(result.format).toBe('png'); // デフォルト
    });
  });

  describe('サイズ抽出', () => {
    it('不正なPNGデータの場合は0を返す', () => {
      const invalidPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
      const result = processor.process(invalidPng);

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('不正なJPEGデータの場合は0を返す', () => {
      const invalidJpeg = Buffer.from([0xff, 0xd8, 0xff]);
      const result = processor.process(invalidJpeg);

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });

    it('不正なWebPデータの場合は0を返す', () => {
      const invalidWebp = Buffer.from([0x52, 0x49, 0x46, 0x46]);
      const result = processor.process(invalidWebp);

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
    });
  });
});
