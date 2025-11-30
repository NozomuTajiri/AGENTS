/**
 * InputProcessor ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputProcessor } from './InputProcessor.js';
import type { MultiModalInput } from '../../types/index.js';

describe('InputProcessor', () => {
  let processor: InputProcessor;

  beforeEach(() => {
    processor = new InputProcessor();
  });

  /**
   * テスト用PNG画像データを生成
   */
  function createTestPng(): Buffer {
    const buffer = Buffer.alloc(24);
    buffer.writeUInt32BE(0x89504e47, 0);
    buffer.writeUInt32BE(0x0d0a1a0a, 4);
    buffer.write('IHDR', 12);
    buffer.writeUInt32BE(800, 16);
    buffer.writeUInt32BE(600, 20);
    return buffer;
  }

  describe('process', () => {
    it('テキストのみの入力を処理できる', async () => {
      const input: MultiModalInput = {
        text: 'A beautiful sunset over the mountains',
      };

      const result = await processor.process(input);

      expect(result.validation.valid).toBe(true);
      expect(result.text).toBeDefined();
      expect(result.text?.original).toBe(input.text);
      expect(result.inputType).toBe('text-only');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('画像のみの入力を処理できる', async () => {
      const input: MultiModalInput = {
        image: createTestPng(),
      };

      const result = await processor.process(input);

      expect(result.validation.valid).toBe(true);
      expect(result.image).toBeDefined();
      expect(result.image?.format).toBe('png');
      expect(result.inputType).toBe('image-only');
    });

    it('スケッチのみの入力を処理できる', async () => {
      const sketchData = {
        lines: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
            strokeWidth: 2,
          },
        ],
      };

      const input: MultiModalInput = {
        sketch: Buffer.from(JSON.stringify(sketchData)),
      };

      const result = await processor.process(input);

      expect(result.validation.valid).toBe(true);
      expect(result.sketch).toBeDefined();
      expect(result.sketch?.lines.length).toBeGreaterThan(0);
      expect(result.inputType).toBe('sketch-only');
    });

    it('マルチモーダル入力を処理できる', async () => {
      const sketchData = {
        lines: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        ],
      };

      const input: MultiModalInput = {
        text: 'A beautiful landscape',
        image: createTestPng(),
        sketch: Buffer.from(JSON.stringify(sketchData)),
        referenceImages: [createTestPng()],
      };

      const result = await processor.process(input);

      expect(result.validation.valid).toBe(true);
      expect(result.text).toBeDefined();
      expect(result.image).toBeDefined();
      expect(result.sketch).toBeDefined();
      expect(result.referenceImages).toBeDefined();
      expect(result.referenceImages?.length).toBe(1);
      expect(result.inputType).toBe('multimodal');
    });

    it('参照画像を複数処理できる', async () => {
      const input: MultiModalInput = {
        text: 'Test',
        referenceImages: [createTestPng(), createTestPng(), createTestPng()],
      };

      const result = await processor.process(input);

      expect(result.validation.valid).toBe(true);
      expect(result.referenceImages?.length).toBe(3);
    });

    it('バリデーションエラー時に例外を投げる', async () => {
      const input: MultiModalInput = {
        text: '', // 空文字
      };

      await expect(processor.process(input)).rejects.toThrow('Validation failed');
    });

    it('処理時間を測定する', async () => {
      const input: MultiModalInput = {
        text: 'A beautiful sunset over the mountains',
      };

      const result = await processor.process(input);

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(1000); // 1秒以内
    });

    it('パフォーマンス目標を超えた場合に警告を出す', async () => {
      processor.updateConfig({ performanceTarget: 0.01 }); // 極端に短い目標

      const input: MultiModalInput = {
        text: 'Test',
      };

      const result = await processor.process(input);

      expect(result.validation.warnings.length).toBeGreaterThan(0);
      expect(
        result.validation.warnings.some((w) => w.includes('Processing time'))
      ).toBe(true);
    });
  });

  describe('processSync', () => {
    it('同期的にテキストを処理できる', () => {
      const input: MultiModalInput = {
        text: 'A beautiful sunset',
      };

      const result = processor.processSync(input);

      expect(result.validation.valid).toBe(true);
      expect(result.text).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('同期的にマルチモーダル入力を処理できる', () => {
      const input: MultiModalInput = {
        text: 'Test',
        image: createTestPng(),
      };

      const result = processor.processSync(input);

      expect(result.validation.valid).toBe(true);
      expect(result.text).toBeDefined();
      expect(result.image).toBeDefined();
    });
  });

  describe('processTextOnly', () => {
    it('テキストのみを処理できる', () => {
      const text = 'A beautiful sunset';
      const result = processor.processTextOnly(text);

      expect(result.original).toBe(text);
      expect(result.normalized).toBe(text);
      expect(result.tokens.length).toBeGreaterThan(0);
    });
  });

  describe('processImageOnly', () => {
    it('画像のみを処理できる', () => {
      const image = createTestPng();
      const result = processor.processImageOnly(image);

      expect(result.format).toBe('png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('processSketchOnly', () => {
    it('スケッチのみを処理できる', () => {
      const sketchData = {
        lines: [
          {
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        ],
      };

      const sketch = Buffer.from(JSON.stringify(sketchData));
      const result = processor.processSketchOnly(sketch);

      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.boundingBox).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    it('バリデーション設定を無効化できる', async () => {
      processor.updateConfig({ enableValidation: false });

      const input: MultiModalInput = {
        text: '', // 通常は無効
      };

      const result = await processor.process(input);

      expect(result.validation.valid).toBe(true);
    });

    it('タイムアウト設定を更新できる', () => {
      processor.updateConfig({ processingTimeout: 10000 });
      const config = processor.getConfig();

      expect(config.processingTimeout).toBe(10000);
    });

    it('パフォーマンス目標を更新できる', () => {
      processor.updateConfig({ performanceTarget: 100 });
      const config = processor.getConfig();

      expect(config.performanceTarget).toBe(100);
    });
  });

  describe('入力タイプ判定', () => {
    it('テキストのみの場合はtext-onlyと判定', async () => {
      const input: MultiModalInput = { text: 'Test' };
      const result = await processor.process(input);

      expect(result.inputType).toBe('text-only');
    });

    it('画像のみの場合はimage-onlyと判定', async () => {
      const input: MultiModalInput = { image: createTestPng() };
      const result = await processor.process(input);

      expect(result.inputType).toBe('image-only');
    });

    it('参照画像のみの場合はimage-onlyと判定', async () => {
      const input: MultiModalInput = {
        text: 'Test',
        referenceImages: [createTestPng()],
      };
      const result = await processor.process(input);

      expect(result.inputType).toBe('multimodal');
    });

    it('複数のモダリティがある場合はmultimodalと判定', async () => {
      const input: MultiModalInput = {
        text: 'Test',
        image: createTestPng(),
      };
      const result = await processor.process(input);

      expect(result.inputType).toBe('multimodal');
    });
  });

  describe('プロセッサアクセス', () => {
    it('各プロセッサにアクセスできる', () => {
      expect(processor.getTextProcessor()).toBeDefined();
      expect(processor.getImageProcessor()).toBeDefined();
      expect(processor.getSketchProcessor()).toBeDefined();
      expect(processor.getValidator()).toBeDefined();
    });
  });
});
