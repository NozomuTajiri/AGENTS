/**
 * Validator ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Validator } from './Validator.js';
import type { MultiModalInput } from '../../types/index.js';

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('validate', () => {
    it('空入力を拒否する', () => {
      const input: MultiModalInput = {};
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('EMPTY_INPUT');
    });

    it('有効なテキスト入力を受け入れる', () => {
      const input: MultiModalInput = {
        text: 'A beautiful sunset over the mountains',
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空白のみのテキストを拒否する', () => {
      const input: MultiModalInput = {
        text: '   \n\t  ',
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EMPTY_TEXT')).toBe(true);
    });

    it('長すぎるテキストを拒否する', () => {
      const input: MultiModalInput = {
        text: 'a'.repeat(6000),
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'TEXT_TOO_LONG')).toBe(true);
    });

    it('有効なPNG画像を受け入れる', () => {
      // PNG マジックナンバー
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const input: MultiModalInput = {
        image: pngBuffer,
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
    });

    it('有効なJPEG画像を受け入れる', () => {
      // JPEG マジックナンバー
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      const input: MultiModalInput = {
        image: jpegBuffer,
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
    });

    it('有効なWebP画像を受け入れる', () => {
      // WebP マジックナンバー
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const input: MultiModalInput = {
        image: webpBuffer,
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
    });

    it('不正なフォーマットの画像を拒否する', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const input: MultiModalInput = {
        image: invalidBuffer,
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_IMAGE_FORMAT')).toBe(true);
    });

    it('空の画像データを拒否する', () => {
      const input: MultiModalInput = {
        image: Buffer.from([]),
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EMPTY_IMAGE')).toBe(true);
    });

    it('大きすぎる画像を拒否する', () => {
      const largeBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB
      largeBuffer[0] = 0x89;
      largeBuffer[1] = 0x50;
      largeBuffer[2] = 0x4e;
      largeBuffer[3] = 0x47;

      const input: MultiModalInput = {
        image: largeBuffer,
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'IMAGE_TOO_LARGE')).toBe(true);
    });

    it('有効なスケッチ入力を受け入れる', () => {
      const sketchBuffer = Buffer.from('{"lines":[{"points":[{"x":0,"y":0}]}]}');
      const input: MultiModalInput = {
        sketch: sketchBuffer,
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
    });

    it('複数の参照画像を受け入れる', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const input: MultiModalInput = {
        text: 'test',
        referenceImages: [pngBuffer, pngBuffer, pngBuffer, pngBuffer],
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('参照画像が多すぎる場合を拒否する', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const input: MultiModalInput = {
        text: 'test',
        referenceImages: Array(10).fill(pngBuffer),
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'TOO_MANY_REFERENCES')).toBe(true);
    });

    it('マルチモーダル入力を正しく検証する', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const sketchBuffer = Buffer.from('{"lines":[]}');

      const input: MultiModalInput = {
        text: 'A beautiful landscape',
        image: pngBuffer,
        sketch: sketchBuffer,
        referenceImages: [pngBuffer],
      };
      const result = validator.validate(input);

      expect(result.valid).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('設定を更新できる', () => {
      validator.updateConfig({ maxPromptLength: 1000 });
      const config = validator.getConfig();

      expect(config.maxPromptLength).toBe(1000);
    });

    it('一部の設定のみ更新できる', () => {
      const originalConfig = validator.getConfig();
      validator.updateConfig({ maxPromptLength: 1000 });
      const newConfig = validator.getConfig();

      expect(newConfig.maxPromptLength).toBe(1000);
      expect(newConfig.maxImageSize).toBe(originalConfig.maxImageSize);
    });
  });
});
