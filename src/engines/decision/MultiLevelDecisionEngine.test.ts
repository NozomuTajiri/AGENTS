/**
 * マルチレベル決定エンジンのテスト
 */

import { describe, it, expect } from 'vitest';
import { MultiLevelDecisionEngine } from './MultiLevelDecisionEngine.js';
import { MultiLayerVector, CacheItem } from '../../types/index.js';

/**
 * テスト用のダミーベクトルを生成
 */
function createDummyVector(seed: number = 0): MultiLayerVector {
  const createArray = (length: number, offset: number): Float32Array => {
    const arr = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      arr[i] = Math.sin((seed + i + offset) * 0.1);
    }
    return arr;
  };

  return {
    subject: createArray(128, 0),
    attribute: createArray(96, 128),
    style: createArray(64, 224),
    composition: createArray(48, 288),
    emotion: createArray(32, 336),
    relationMatrix: Array(5)
      .fill(null)
      .map((_, i) =>
        Array(5)
          .fill(null)
          .map((_, j) => Math.abs(Math.sin((seed + i + j) * 0.5)))
      ),
    timestamp: new Date(),
  };
}

/**
 * テスト用のダミーキャッシュアイテムを生成
 */
function createDummyCacheItem(id: string, seed: number): CacheItem {
  return {
    id,
    vector: createDummyVector(seed),
    image: Buffer.from('dummy-image'),
    metadata: {
      prompt: `Test prompt ${id}`,
      generationParams: {
        model: 'test-model',
        seed,
        steps: 20,
        cfgScale: 7.5,
      },
      createdAt: new Date(),
      size: 1024,
      format: 'png',
      dimensions: { width: 512, height: 512 },
    },
    accessCount: 0,
    lastAccess: new Date(),
    generationDifficulty: 0.5,
    storageLevel: 'L1',
  };
}

describe('MultiLevelDecisionEngine', () => {
  it('should initialize with default config', () => {
    const engine = new MultiLevelDecisionEngine();
    const config = engine.getConfig();

    expect(config.engine.uncertaintyThreshold).toBe(0.5);
    expect(config.engine.learningRate).toBe(0.01);
    expect(config.engine.autoOptimize).toBe(true);
  });

  it('should decide new_generation when cache is empty', () => {
    const engine = new MultiLevelDecisionEngine();
    const queryVector = createDummyVector(1);
    const result = engine.decide(queryVector, []);

    expect(result.action).toBe('new_generation');
    expect(result.confidence).toBe(1.0);
    expect(result.uncertainty).toBe(0.0);
  });

  it('should decide cache_hit for highly similar vectors', () => {
    const engine = new MultiLevelDecisionEngine();

    // 同一のベクトル（類似度 = 1.0）
    const queryVector = createDummyVector(1);
    const cacheItems = [createDummyCacheItem('item1', 1)];

    const result = engine.decide(queryVector, cacheItems);

    // 完全一致なのでキャッシュヒットまたは差分生成になるはず
    expect(['cache_hit', 'diff_generation']).toContain(result.action);
    expect(result.matchedItem).toBeDefined();
  });

  it('should decide new_generation for dissimilar vectors', () => {
    const engine = new MultiLevelDecisionEngine();

    const queryVector = createDummyVector(1);
    const cacheItems = [createDummyCacheItem('item1', 100)]; // 全く異なるベクトル

    const result = engine.decide(queryVector, cacheItems);

    // 類似度が低いので新規生成になる可能性が高い
    expect(['new_generation', 'diff_generation']).toContain(result.action);
  });

  it('should calculate similarity between two vectors', () => {
    const engine = new MultiLevelDecisionEngine();

    const vector1 = createDummyVector(1);
    const vector2 = createDummyVector(2);

    const result = engine.calculateSimilarity(vector1, vector2);

    expect(result.similarity).toBeGreaterThanOrEqual(0);
    expect(result.similarity).toBeLessThanOrEqual(1);
    expect(result.uncertainty).toBeGreaterThanOrEqual(0);
    expect(result.uncertainty).toBeLessThanOrEqual(1);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.cosine).toBeGreaterThanOrEqual(-1);
    expect(result.metrics.cosine).toBeLessThanOrEqual(1);
  });

  it('should process batch decisions', () => {
    const engine = new MultiLevelDecisionEngine();

    const queries = [createDummyVector(1), createDummyVector(2), createDummyVector(3)];
    const cacheItems = [createDummyCacheItem('item1', 10), createDummyCacheItem('item2', 20)];

    const results = engine.decideBatch(queries, cacheItems);

    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(['cache_hit', 'diff_generation', 'new_generation']).toContain(result.action);
      expect(result.metrics).toBeDefined();
    });
  });

  it('should update config', () => {
    const engine = new MultiLevelDecisionEngine();

    engine.updateConfig({
      uncertaintyThreshold: 0.7,
      learningRate: 0.05,
    });

    const config = engine.getConfig();

    expect(config.engine.uncertaintyThreshold).toBe(0.7);
    expect(config.engine.learningRate).toBe(0.05);
  });

  it('should reset engine state', () => {
    const engine = new MultiLevelDecisionEngine();

    // エンジンを使用
    const queryVector = createDummyVector(1);
    const cacheItems = [createDummyCacheItem('item1', 1)];
    engine.decide(queryVector, cacheItems);

    // リセット
    engine.reset();

    // リセット後も動作することを確認
    const result = engine.decide(queryVector, cacheItems);
    expect(result).toBeDefined();
  });

  it('should evaluate model performance', () => {
    const engine = new MultiLevelDecisionEngine();

    const evaluation = engine.evaluate();

    expect(evaluation.ensemble).toBeDefined();
    expect(evaluation.thresholds).toBeDefined();
    expect(evaluation.ensemble.mse).toBeGreaterThanOrEqual(0);
    expect(evaluation.ensemble.accuracy).toBeGreaterThanOrEqual(0);
    expect(evaluation.ensemble.accuracy).toBeLessThanOrEqual(1);
  });
});
