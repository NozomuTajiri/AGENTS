/**
 * TextProcessor ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextProcessor } from './TextProcessor.js';

describe('TextProcessor', () => {
  let processor: TextProcessor;

  beforeEach(() => {
    processor = new TextProcessor();
  });

  describe('process', () => {
    it('基本的なテキストを処理できる', () => {
      const text = 'A beautiful sunset over the mountains';
      const result = processor.process(text);

      expect(result.original).toBe(text);
      expect(result.normalized).toBe(text);
      expect(result.tokens.length).toBeGreaterThan(0);
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('前後の空白を削除する', () => {
      const text = '  Hello World  ';
      const result = processor.process(text);

      expect(result.normalized).toBe('Hello World');
    });

    it('連続する空白を1つにまとめる', () => {
      const text = 'Hello    World   Test';
      const result = processor.process(text);

      expect(result.normalized).toBe('Hello World Test');
    });

    it('全角スペースを半角スペースに変換する', () => {
      const text = 'Hello　World';
      const result = processor.process(text);

      expect(result.normalized).toBe('Hello World');
    });

    it('日本語を検出する', () => {
      const text = 'これは日本語のテストです';
      const result = processor.process(text);

      expect(result.language).toBe('ja');
    });

    it('中国語を検出する', () => {
      const text = '这是中文测试';
      const result = processor.process(text);

      expect(result.language).toBe('zh');
    });

    it('韓国語を検出する', () => {
      const text = '이것은 한국어 테스트입니다';
      const result = processor.process(text);

      expect(result.language).toBe('ko');
    });

    it('英語をデフォルトとして検出する', () => {
      const text = 'This is an English test';
      const result = processor.process(text);

      expect(result.language).toBe('en');
    });

    it('スペイン語を検出する', () => {
      const text = 'El gato está en la casa';
      const result = processor.process(text);

      expect(result.language).toBe('es');
    });

    it('テキストをトークン化する', () => {
      const text = 'A beautiful sunset, over the mountains';
      const result = processor.process(text);

      expect(result.tokens).toContain('A');
      expect(result.tokens).toContain('beautiful');
      expect(result.tokens).toContain('sunset');
      expect(result.tokens).toContain('mountains');
    });

    it('メタデータを正しく抽出する', () => {
      const text = 'Hello World! This is a test.';
      const result = processor.process(text);

      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.metadata.charCount).toBe(result.normalized.length);
      expect(result.metadata.hasSpecialChars).toBe(true);
    });

    it('大文字で始まる単語をエンティティとして抽出する', () => {
      const text = 'John visited Paris in France';
      const result = processor.process(text);

      expect(result.metadata.detectedEntities).toContain('John');
      expect(result.metadata.detectedEntities).toContain('Paris');
      expect(result.metadata.detectedEntities).toContain('France');
    });

    it('引用符で囲まれたフレーズをエンティティとして抽出する', () => {
      const text = 'The "Mona Lisa" is famous';
      const result = processor.process(text);

      expect(result.metadata.detectedEntities).toContain('Mona Lisa');
    });

    it('数値をエンティティとして抽出する', () => {
      const text = 'The year is 2025 and the temperature is 23.5 degrees';
      const result = processor.process(text);

      expect(result.metadata.detectedEntities).toContain('2025');
      expect(result.metadata.detectedEntities).toContain('23.5');
    });

    it('curly quotesをstraight quotesに変換する', () => {
      const text = '\u201CHello\u201D and \u2018World\u2019';
      const result = processor.process(text);

      expect(result.normalized).toBe('"Hello" and \'World\'');
    });

    it('em dashとen dashをhyphenに変換する', () => {
      const text = 'This—is—a—test';
      const result = processor.process(text);

      expect(result.normalized).toBe('This-is-a-test');
    });
  });

  describe('updateLanguageConfig', () => {
    it('デフォルト言語を更新できる', () => {
      processor.updateLanguageConfig({ defaultLanguage: 'ja' });
      const config = processor.getLanguageConfig();

      expect(config.defaultLanguage).toBe('ja');
    });

    it('サポート言語リストを更新できる', () => {
      const newLanguages = ['en', 'ja'];
      processor.updateLanguageConfig({ supportedLanguages: newLanguages });
      const config = processor.getLanguageConfig();

      expect(config.supportedLanguages).toEqual(newLanguages);
    });
  });
});
