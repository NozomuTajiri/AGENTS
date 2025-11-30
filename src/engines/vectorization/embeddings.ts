/**
 * embeddings.ts - 層別埋め込み辞書
 *
 * 各層に最適化された単語埋め込みを提供します。
 * 実際のプロダクション環境では、事前学習済みモデル（word2vec, GloVe等）を使用しますが、
 * ここではシミュレーション用の簡易的な埋め込みを生成します。
 */

import { LayerType, LAYER_DIMENSIONS } from '../../types/index.js';

/**
 * 層ごとの重要語彙セット
 */
const LAYER_VOCABULARIES: Record<LayerType, string[]> = {
  subject: [
    'person', 'people', 'man', 'woman', 'child', 'baby',
    'animal', 'cat', 'dog', 'bird', 'horse', 'fish',
    'landscape', 'mountain', 'forest', 'ocean', 'sky', 'cloud',
    'building', 'house', 'city', 'tower', 'bridge',
    'object', 'car', 'tree', 'flower', 'food', 'book',
    'character', 'hero', 'warrior', 'wizard', 'robot',
  ],
  attribute: [
    'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple',
    'bright', 'dark', 'light', 'vivid', 'pale', 'pastel',
    'young', 'old', 'aged', 'new', 'vintage', 'modern',
    'large', 'small', 'big', 'tiny', 'huge', 'massive',
    'soft', 'hard', 'smooth', 'rough', 'shiny', 'matte',
    'wood', 'metal', 'glass', 'stone', 'fabric', 'leather',
  ],
  style: [
    'realistic', 'photorealistic', 'hyperrealistic',
    'cartoon', 'comic', 'manga', 'anime',
    'abstract', 'surreal', 'minimalist', 'modern',
    'vintage', 'retro', 'classic', 'traditional',
    'watercolor', 'oil', 'acrylic', 'digital',
    'sketch', 'drawing', 'painting', 'illustration',
    'impressionist', 'expressionist', 'cubist',
  ],
  composition: [
    'center', 'centered', 'middle', 'focus',
    'left', 'right', 'top', 'bottom', 'corner',
    'foreground', 'background', 'depth', 'layer',
    'perspective', 'angle', 'view', 'viewpoint',
    'wide', 'narrow', 'close', 'distant', 'far',
    'symmetry', 'balance', 'asymmetry', 'diagonal',
    'horizontal', 'vertical', 'parallel', 'curved',
  ],
  emotion: [
    'happy', 'joyful', 'cheerful', 'delighted', 'excited',
    'sad', 'melancholy', 'depressed', 'gloomy', 'sorrowful',
    'calm', 'peaceful', 'serene', 'tranquil', 'relaxed',
    'angry', 'furious', 'rage', 'frustrated', 'annoyed',
    'mysterious', 'enigmatic', 'curious', 'intriguing',
    'energetic', 'dynamic', 'vibrant', 'lively', 'active',
  ],
};

/**
 * 埋め込みキャッシュ
 */
const embeddingCache: Map<LayerType, Map<string, Float32Array>> = new Map();

/**
 * シード値から決定論的な乱数を生成（簡易版）
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * 文字列をシード値に変換
 */
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 単語とレイヤーに基づいて決定論的な埋め込みベクトルを生成
 */
function generateEmbedding(word: string, layerType: LayerType): Float32Array {
  const dimensions = LAYER_DIMENSIONS[layerType];
  const embedding = new Float32Array(dimensions);
  const baseSeed = stringToSeed(word + layerType);

  // 正規分布に近い値を生成
  for (let i = 0; i < dimensions; i++) {
    const seed = baseSeed + i * 12345;
    const u1 = seededRandom(seed);
    const u2 = seededRandom(seed + 1);

    // Box-Muller変換で正規分布を近似
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    embedding[i] = z * 0.1; // スケーリング
  }

  // L2正規化
  let magnitude = 0;
  for (let i = 0; i < dimensions; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

/**
 * 指定された層の埋め込み辞書を初期化
 */
function initializeLayerEmbeddings(layerType: LayerType): Map<string, Float32Array> {
  const embeddings = new Map<string, Float32Array>();
  const vocabulary = LAYER_VOCABULARIES[layerType];

  for (const word of vocabulary) {
    const embedding = generateEmbedding(word, layerType);
    embeddings.set(word, embedding);
  }

  return embeddings;
}

/**
 * 指定された層の埋め込み辞書を取得（遅延初期化）
 */
export function getLayerEmbeddings(layerType: LayerType): Map<string, Float32Array> {
  if (!embeddingCache.has(layerType)) {
    const embeddings = initializeLayerEmbeddings(layerType);
    embeddingCache.set(layerType, embeddings);
  }

  return embeddingCache.get(layerType)!;
}

/**
 * 単語の埋め込みベクトルを取得（存在しない場合は動的生成）
 */
export function getWordEmbedding(word: string, layerType: LayerType): Float32Array {
  const embeddings = getLayerEmbeddings(layerType);
  const normalizedWord = word.toLowerCase();

  if (!embeddings.has(normalizedWord)) {
    // 未知語は動的に生成
    const embedding = generateEmbedding(normalizedWord, layerType);
    embeddings.set(normalizedWord, embedding);
  }

  return embeddings.get(normalizedWord)!;
}

/**
 * すべての層の埋め込みを事前初期化
 */
export function preloadEmbeddings(): void {
  const layers: LayerType[] = ['subject', 'attribute', 'style', 'composition', 'emotion'];

  for (const layer of layers) {
    getLayerEmbeddings(layer);
  }
}

/**
 * 埋め込みキャッシュをクリア
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * 層の語彙サイズを取得
 */
export function getVocabularySize(layerType: LayerType): number {
  return LAYER_VOCABULARIES[layerType].length;
}

/**
 * すべての語彙を取得
 */
export function getAllVocabulary(layerType: LayerType): string[] {
  return [...LAYER_VOCABULARIES[layerType]];
}
