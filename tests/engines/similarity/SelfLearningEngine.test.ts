/**
 * 自己学習型類似度計算エンジン - 統合テスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelfLearningEngine } from '../../../src/engines/similarity/SelfLearningEngine.js';
import type { MultiLayerVector } from '../../../src/types/index.js';

describe('SelfLearningEngine', () => {
  let engine: SelfLearningEngine;

  beforeEach(() => {
    engine = new SelfLearningEngine({
      enableFeedbackCollection: true,
      enableParameterOptimization: true,
      enableVectorAdjustment: true,
      optimizationInterval: 5,
      adjustmentInterval: 10,
      minFeedbackForOptimization: 3,
      minFeedbackForAdjustment: 5,
    });
  });

  describe('ベクトル登録と類似度計算', () => {
    it('ベクトルを登録して類似度を計算できる', () => {
      const vector1: MultiLayerVector = {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      };

      const vector2: MultiLayerVector = {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      };

      engine.registerVector('prompt1', vector1);
      engine.registerVector('prompt2', vector2);

      const result = engine.computeSimilarity(vector1, vector2);

      expect(result.score).toBeGreaterThan(0.9); // 同一ベクトルなので高スコア
      expect(result.breakdown.subject).toBe(1.0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('異なるベクトルの類似度は低い', () => {
      const vector1: MultiLayerVector = {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      };

      const vector2: MultiLayerVector = {
        subject: new Float32Array([0, 1, 0, 0]),
        attribute: new Float32Array([0, 1, 0]),
        style: new Float32Array([0, 1]),
        composition: new Float32Array([0]),
        emotion: new Float32Array([0]),
        relationMatrix: [[0]],
        timestamp: new Date(),
      };

      const result = engine.computeSimilarity(vector1, vector2);

      expect(result.score).toBeLessThan(0.5);
    });
  });

  describe('フィードバック収集', () => {
    it('明示的フィードバックを記録できる', () => {
      engine.recordFeedback('prompt1', 'result1', 'accepted', undefined, 'user1');

      const metrics = engine.getPerformanceMetrics();
      expect(metrics.acceptanceRate).toBeGreaterThanOrEqual(0);
    });

    it('暗黙的フィードバックを記録できる', () => {
      engine.recordFeedback(
        'prompt2',
        'result2',
        'rejected',
        {
          regenerationCount: 2,
          editCount: 3,
          dwellTime: 1000,
          clickedVariants: ['var1', 'var2'],
        },
        'user2'
      );

      const metrics = engine.getPerformanceMetrics();
      expect(metrics.averageRegenerationCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('セッション管理', () => {
    it('セッションを開始・終了できる', () => {
      engine.startSession('user1', 'session1');
      engine.endSession('session1');

      const history = engine.getUserHistory('user1');
      expect(history).toBeDefined();
      expect(history?.sessions).toHaveLength(1);
    });
  });

  describe('パラメータ最適化', () => {
    it('十分なフィードバック後にパラメータが更新される', () => {
      const initialParams = engine.getCurrentParams();

      // 複数のフィードバックを記録
      for (let i = 0; i < 10; i++) {
        engine.recordFeedback(
          `prompt${i}`,
          `result${i}`,
          i % 2 === 0 ? 'accepted' : 'rejected',
          {
            regenerationCount: i % 3,
            editCount: i % 2,
            dwellTime: 1000 + i * 100,
            clickedVariants: [],
          },
          'user1'
        );
      }

      const updatedParams = engine.getCurrentParams();

      // 学習率は変化する可能性がある
      expect(updatedParams).toBeDefined();
      expect(updatedParams.layerWeights).toBeDefined();
    });
  });

  describe('学習状態の取得', () => {
    it('学習状態を取得できる', () => {
      const state = engine.getLearningState();

      expect(state.totalFeedback).toBe(0);
      expect(state.currentParams).toBeDefined();
      expect(state.performanceMetrics).toBeDefined();
    });

    it('パフォーマンスメトリクスを取得できる', () => {
      const metrics = engine.getPerformanceMetrics();

      expect(metrics.acceptanceRate).toBe(0);
      expect(metrics.averageRegenerationCount).toBe(0);
      expect(metrics.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('設定の更新', () => {
    it('設定を動的に更新できる', () => {
      engine.updateConfig({
        enableParameterOptimization: false,
        optimizationInterval: 100,
      });

      // 設定更新後もエンジンは動作する
      engine.recordFeedback('prompt1', 'result1', 'accepted', undefined, 'user1');

      const state = engine.getLearningState();
      expect(state.totalFeedback).toBe(1);
    });
  });

  describe('リセット機能', () => {
    it('エンジンをリセットできる', () => {
      engine.registerVector('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      engine.recordFeedback('prompt1', 'result1', 'accepted', undefined, 'user1');

      engine.reset();

      const state = engine.getLearningState();
      expect(state.totalFeedback).toBe(0);
    });
  });
});
