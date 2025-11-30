/**
 * パーツベースのインデックシングエンジン
 *
 * 各パーツを意味層とマッピングし、高速検索用のインデックスを構築
 *
 * インデックス構造:
 * index(part) = {layer_1: v1, layer_2: v2, ..., layer_n: vn}
 */

import type {
  ImagePart,
  ImagePartType,
  MultiLayerVector,
  LayerType,
} from '../../types/index.js';

/**
 * パーツインデックス
 */
export interface PartIndex {
  partId: string;
  type: ImagePartType;
  layerVectors: Record<LayerType, Float32Array>;
  tags: string[];
  timestamp: Date;
}

/**
 * インデックス検索クエリ
 */
export interface IndexQuery {
  /** 検索対象層 */
  layers?: LayerType[];
  /** 検索ベクトル */
  queryVector: MultiLayerVector;
  /** パーツタイプフィルタ */
  partType?: ImagePartType;
  /** タグフィルタ */
  tags?: string[];
  /** 最大結果数 */
  topK?: number;
  /** 最小類似度 */
  minSimilarity?: number;
}

/**
 * 検索結果
 */
export interface IndexSearchResult {
  part: ImagePart;
  similarity: number;
  layerScores: Record<LayerType, number>;
}

/**
 * インデックス統計
 */
export interface IndexStats {
  totalParts: number;
  partsByType: Record<ImagePartType, number>;
  averageVectorNorm: Record<LayerType, number>;
  indexSize: number;
}

/**
 * デフォルト検索設定
 */
const DEFAULT_SEARCH_CONFIG = {
  topK: 10,
  minSimilarity: 0.5,
  layers: ['subject', 'attribute', 'style', 'composition', 'emotion'] as LayerType[],
};

/**
 * パーツインデクサー
 */
export class PartIndexer {
  private indices: Map<string, PartIndex>;
  private partStore: Map<string, ImagePart>;
  private typeIndex: Map<ImagePartType, Set<string>>;
  private tagIndex: Map<string, Set<string>>;

  constructor() {
    this.indices = new Map();
    this.partStore = new Map();
    this.typeIndex = new Map();
    this.tagIndex = new Map();
  }

  /**
   * パーツをインデックスに追加
   */
  async indexPart(part: ImagePart): Promise<void> {
    const index: PartIndex = {
      partId: part.id,
      type: part.type,
      layerVectors: {
        subject: part.vectors.subject,
        attribute: part.vectors.attribute,
        style: part.vectors.style,
        composition: part.vectors.composition,
        emotion: part.vectors.emotion,
      },
      tags: part.metadata.tags,
      timestamp: new Date(),
    };

    // メインインデックスに追加
    this.indices.set(part.id, index);
    this.partStore.set(part.id, part);

    // タイプ別インデックス更新
    if (!this.typeIndex.has(part.type)) {
      this.typeIndex.set(part.type, new Set());
    }
    this.typeIndex.get(part.type)!.add(part.id);

    // タグ別インデックス更新
    for (const tag of part.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(part.id);
    }
  }

  /**
   * 複数パーツを一括インデックス
   */
  async indexParts(parts: ImagePart[]): Promise<void> {
    for (const part of parts) {
      await this.indexPart(part);
    }
  }

  /**
   * パーツを検索
   */
  async search(query: IndexQuery): Promise<IndexSearchResult[]> {
    const config = { ...DEFAULT_SEARCH_CONFIG, ...query };

    // フィルタリング用のパーツID候補
    let candidateIds = new Set(this.indices.keys());

    // タイプフィルタ適用
    if (query.partType) {
      const typeIds = this.typeIndex.get(query.partType);
      if (!typeIds) return [];
      candidateIds = new Set([...candidateIds].filter((id) => typeIds.has(id)));
    }

    // タグフィルタ適用
    if (query.tags && query.tags.length > 0) {
      for (const tag of query.tags) {
        const tagIds = this.tagIndex.get(tag);
        if (!tagIds) return [];
        candidateIds = new Set([...candidateIds].filter((id) => tagIds.has(id)));
      }
    }

    // 類似度計算
    const results: IndexSearchResult[] = [];
    for (const partId of candidateIds) {
      const index = this.indices.get(partId)!;
      const part = this.partStore.get(partId)!;

      const { similarity, layerScores } = this.calculateSimilarity(
        query.queryVector,
        index,
        config.layers!
      );

      if (similarity >= config.minSimilarity!) {
        results.push({ part, similarity, layerScores });
      }
    }

    // 類似度でソート
    results.sort((a, b) => b.similarity - a.similarity);

    // Top-K取得
    return results.slice(0, config.topK);
  }

  /**
   * 多層ベクトル間の類似度計算
   */
  private calculateSimilarity(
    queryVector: MultiLayerVector,
    index: PartIndex,
    layers: LayerType[]
  ): { similarity: number; layerScores: Record<LayerType, number> } {
    const layerScores: Partial<Record<LayerType, number>> = {};
    let totalScore = 0;
    let weightSum = 0;

    // 各層ごとにコサイン類似度を計算
    for (const layer of layers) {
      const queryLayerVector = queryVector[layer];
      const indexLayerVector = index.layerVectors[layer];

      const score = this.cosineSimilarity(queryLayerVector, indexLayerVector);
      layerScores[layer] = score;

      // 層の重み（次元数に基づく）
      const weight = queryLayerVector.length;
      totalScore += score * weight;
      weightSum += weight;
    }

    const similarity = weightSum > 0 ? totalScore / weightSum : 0;

    return {
      similarity,
      layerScores: layerScores as Record<LayerType, number>,
    };
  }

  /**
   * コサイン類似度計算
   */
  private cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const normProduct = Math.sqrt(norm1) * Math.sqrt(norm2);
    return normProduct > 0 ? dotProduct / normProduct : 0;
  }

  /**
   * パーツIDで取得
   */
  getPart(partId: string): ImagePart | undefined {
    return this.partStore.get(partId);
  }

  /**
   * タイプ別にパーツを取得
   */
  getPartsByType(type: ImagePartType): ImagePart[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.partStore.get(id))
      .filter((part): part is ImagePart => part !== undefined);
  }

  /**
   * タグでパーツを取得
   */
  getPartsByTag(tag: string): ImagePart[] {
    const ids = this.tagIndex.get(tag);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.partStore.get(id))
      .filter((part): part is ImagePart => part !== undefined);
  }

  /**
   * インデックスから削除
   */
  removePart(partId: string): boolean {
    const index = this.indices.get(partId);
    if (!index) return false;

    // メインインデックスから削除
    this.indices.delete(partId);
    this.partStore.delete(partId);

    // タイプインデックスから削除
    const typeSet = this.typeIndex.get(index.type);
    if (typeSet) {
      typeSet.delete(partId);
      if (typeSet.size === 0) {
        this.typeIndex.delete(index.type);
      }
    }

    // タグインデックスから削除
    for (const tag of index.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(partId);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    return true;
  }

  /**
   * インデックスをクリア
   */
  clear(): void {
    this.indices.clear();
    this.partStore.clear();
    this.typeIndex.clear();
    this.tagIndex.clear();
  }

  /**
   * インデックス統計を取得
   */
  getStats(): IndexStats {
    const partsByType: Partial<Record<ImagePartType, number>> = {};
    const averageVectorNorm: Partial<Record<LayerType, number>> = {};

    // タイプ別集計
    for (const [type, ids] of this.typeIndex.entries()) {
      partsByType[type] = ids.size;
    }

    // 層別の平均ノルム計算
    const layerSums: Partial<Record<LayerType, number>> = {};
    const layerCounts: Partial<Record<LayerType, number>> = {};

    for (const index of this.indices.values()) {
      for (const layer of Object.keys(index.layerVectors) as LayerType[]) {
        const vector = index.layerVectors[layer];
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

        layerSums[layer] = (layerSums[layer] || 0) + norm;
        layerCounts[layer] = (layerCounts[layer] || 0) + 1;
      }
    }

    for (const layer of Object.keys(layerSums) as LayerType[]) {
      averageVectorNorm[layer] = layerSums[layer]! / layerCounts[layer]!;
    }

    return {
      totalParts: this.indices.size,
      partsByType: partsByType as Record<ImagePartType, number>,
      averageVectorNorm: averageVectorNorm as Record<LayerType, number>,
      indexSize: this.calculateIndexSize(),
    };
  }

  /**
   * インデックスサイズ（バイト）を概算
   */
  private calculateIndexSize(): number {
    let size = 0;

    for (const index of this.indices.values()) {
      // 各層のベクトルサイズ
      for (const vector of Object.values(index.layerVectors)) {
        size += vector.length * 4; // Float32 = 4 bytes
      }
      // メタデータサイズ（概算）
      size += 1000; // タグ、ID、タイムスタンプなど
    }

    return size;
  }

  /**
   * 類似パーツのクラスタリング
   */
  async findSimilarParts(
    part: ImagePart,
    threshold: number = 0.8
  ): Promise<ImagePart[]> {
    const query: IndexQuery = {
      queryVector: part.vectors,
      minSimilarity: threshold,
      topK: 50,
    };

    const results = await this.search(query);
    return results
      .filter((result) => result.part.id !== part.id)
      .map((result) => result.part);
  }
}
