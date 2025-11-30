/**
 * テキストプロンプト解析処理
 * 自然言語プロンプトの受信、正規化、言語検出、トークン化
 */

import type { ProcessedPrompt, PromptMetadata } from '../../types/index.js';

/**
 * 言語検出の設定
 */
interface LanguageDetectionConfig {
  /** デフォルト言語 */
  defaultLanguage: string;
  /** サポート言語リスト */
  supportedLanguages: string[];
}

/**
 * デフォルト言語設定
 */
const DEFAULT_LANG_CONFIG: LanguageDetectionConfig = {
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de'],
};

/**
 * テキストプロセッサ
 * プロンプトの正規化と解析を実施
 */
export class TextProcessor {
  private langConfig: LanguageDetectionConfig;

  constructor(langConfig?: Partial<LanguageDetectionConfig>) {
    this.langConfig = { ...DEFAULT_LANG_CONFIG, ...langConfig };
  }

  /**
   * テキストプロンプトを処理
   *
   * @param text - 処理対象のテキスト
   * @returns 処理済みプロンプト
   */
  process(text: string): ProcessedPrompt {
    const normalized = this.normalize(text);
    const language = this.detectLanguage(normalized);
    const tokens = this.tokenize(normalized);
    const metadata = this.extractMetadata(text, normalized);

    return {
      original: text,
      normalized,
      language,
      tokens,
      metadata,
    };
  }

  /**
   * プロンプトの正規化
   * - 前後の空白を削除
   * - 連続する空白を1つに
   * - 特殊記号の標準化
   *
   * @param text - 正規化対象のテキスト
   * @returns 正規化されたテキスト
   */
  private normalize(text: string): string {
    let normalized = text;

    // 前後の空白を削除
    normalized = normalized.trim();

    // 連続する空白を1つに統一
    normalized = normalized.replace(/\s+/g, ' ');

    // 全角スペースを半角スペースに
    normalized = normalized.replace(/\u3000/g, ' ');

    // ダッシュ系の統一（em dash, en dash → hyphen）
    normalized = normalized.replace(/[\u2013\u2014]/g, '-');

    // 引用符の統一（curly quotes → straight quotes）
    normalized = normalized.replace(/[\u2018\u2019]/g, "'");
    normalized = normalized.replace(/[\u201C\u201D]/g, '"');

    // 省略記号の統一
    normalized = normalized.replace(/\u2026/g, '...');

    return normalized;
  }

  /**
   * 言語検出
   * 簡易的なヒューリスティックベースの言語検出
   *
   * @param text - 検出対象のテキスト
   * @returns 検出された言語コード
   */
  private detectLanguage(text: string): string {
    // 日本語検出（ひらがな、カタカナ）
    const hiraganaKatakana = /[\u3040-\u309F\u30A0-\u30FF]/;
    if (hiraganaKatakana.test(text)) {
      return 'ja';
    }

    // 中国語検出（簡体字・繁体字の範囲、ただし日本語文字が含まれない場合）
    const chineseChars = /[\u4E00-\u9FFF]/;
    if (chineseChars.test(text)) {
      return 'zh';
    }

    // 韓国語検出（ハングル）
    const koreanChars = /[\uAC00-\uD7AF]/;
    if (koreanChars.test(text)) {
      return 'ko';
    }

    // アルファベットベースの言語の簡易判定
    const words = text.toLowerCase().split(/\s+/);

    // スペイン語の一般的な単語
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'es', 'un', 'una', 'del'];
    const spanishCount = words.filter((w) => spanishWords.includes(w)).length;

    // フランス語の一般的な単語
    const frenchWords = ['le', 'de', 'un', 'une', 'et', 'est', 'dans', 'que'];
    const frenchCount = words.filter((w) => frenchWords.includes(w)).length;

    // ドイツ語の一般的な単語
    const germanWords = ['der', 'die', 'das', 'und', 'ist', 'in', 'den', 'von'];
    const germanCount = words.filter((w) => germanWords.includes(w)).length;

    // 最も多くマッチした言語を選択
    const counts = [
      { lang: 'es', count: spanishCount },
      { lang: 'fr', count: frenchCount },
      { lang: 'de', count: germanCount },
    ];

    const maxCount = Math.max(...counts.map((c) => c.count));
    if (maxCount > 0) {
      const detected = counts.find((c) => c.count === maxCount);
      if (detected) {
        return detected.lang;
      }
    }

    // デフォルトは英語
    return this.langConfig.defaultLanguage;
  }

  /**
   * テキストのトークン化
   * 単語とフレーズに分割
   *
   * @param text - トークン化対象のテキスト
   * @returns トークン配列
   */
  private tokenize(text: string): string[] {
    // 基本的な区切り文字で分割
    const tokens: string[] = [];

    // カンマ、ピリオド、セミコロンで分割
    const phrases = text.split(/[,;]+/).map((s) => s.trim()).filter((s) => s.length > 0);

    phrases.forEach((phrase) => {
      // スペースで単語に分割
      const words = phrase.split(/\s+/).filter((w) => w.length > 0);
      tokens.push(...words);
    });

    return tokens;
  }

  /**
   * メタデータの抽出
   *
   * @param original - 元のテキスト
   * @param normalized - 正規化されたテキスト
   * @returns プロンプトメタデータ
   */
  private extractMetadata(original: string, normalized: string): PromptMetadata {
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;
    const charCount = normalized.length;

    // 特殊文字の検出
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(normalized);

    // エンティティの検出（簡易版）
    const detectedEntities = this.extractEntities(normalized);

    return {
      wordCount,
      charCount,
      hasSpecialChars,
      detectedEntities,
    };
  }

  /**
   * エンティティの抽出
   * 大文字で始まる単語や特定パターンを抽出
   *
   * @param text - 抽出対象のテキスト
   * @returns エンティティ配列
   */
  private extractEntities(text: string): string[] {
    const entities: string[] = [];

    // 大文字で始まる単語（2文字以上）
    const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g);
    if (capitalizedWords) {
      entities.push(...capitalizedWords);
    }

    // 連続する大文字（頭字語など）
    const acronyms = text.match(/\b[A-Z]{2,}\b/g);
    if (acronyms) {
      entities.push(...acronyms);
    }

    // 数値パターン
    const numbers = text.match(/\b\d+(\.\d+)?\b/g);
    if (numbers) {
      entities.push(...numbers);
    }

    // 引用符で囲まれたフレーズ
    const quotedPhrases = text.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      entities.push(...quotedPhrases.map((q) => q.replace(/"/g, '')));
    }

    // 重複を除去してユニークなエンティティのみ返す
    return Array.from(new Set(entities));
  }

  /**
   * 言語設定の更新
   *
   * @param config - 更新する設定
   */
  updateLanguageConfig(config: Partial<LanguageDetectionConfig>): void {
    this.langConfig = { ...this.langConfig, ...config };
  }

  /**
   * 現在の言語設定を取得
   *
   * @returns 現在の言語設定
   */
  getLanguageConfig(): LanguageDetectionConfig {
    return { ...this.langConfig };
  }
}
