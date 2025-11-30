/**
 * 適応型ベクトル空間再調整エンジン - ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorSpaceAdjuster } from '../../../src/engines/similarity/VectorSpaceAdjuster.js';
import type { MultiLayerVector } from '../../../src/types/index.js';
import type { CrossUserPattern } from '../../../src/engines/similarity/FeedbackCollector.js';

describe('VectorSpaceAdjuster', () => {
  let adjuster: VectorSpaceAdjuster;

  beforeEach(() => {
    adjuster = new VectorSpaceAdjuster();
  });

  describe('ベクトル空間調整', () => {
    it('ベクトル空間を調整できる', () => {
      const vectors = new Map<string, MultiLayerVector>();

      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      vectors.set('prompt2', {
        subject: new Float32Array([0.9, 0.1, 0, 0]),
        attribute: new Float32Array([0.9, 0.1, 0]),
        style: new Float32Array([0.9, 0.1]),
        composition: new Float32Array([0.9]),
        emotion: new Float32Array([0.9]),
        relationMatrix: [[0.9]],
        timestamp: new Date(),
      });

      const confusionPatterns: CrossUserPattern[] = [
        {
          promptPair: ['prompt1', 'prompt2'],
          confusionRate: 0.7,
          sampleSize: 10,
          averageSimilarity: 0.95,
        },
      ];

      const adjustedVectors = adjuster.adjustVectorSpace(vectors, confusionPatterns);

      expect(adjustedVectors.size).toBe(2);
      expect(adjustedVectors.get('prompt1')).toBeDefined();
      expect(adjustedVectors.get('prompt2')).toBeDefined();
    });

    it('調整後のベクトルは正規化されている', () => {
      const vectors = new Map<string, MultiLayerVector>();

      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const confusionPatterns: CrossUserPattern[] = [];
      const adjustedVectors = adjuster.adjustVectorSpace(vectors, confusionPatterns);

      const vector = adjustedVectors.get('prompt1')!;

      // 各層のノルムを確認（正規化されているはず）
      const subjectNorm = Math.sqrt(
        vector.subject.reduce((sum, val) => sum + val * val, 0)
      );

      expect(subjectNorm).toBeCloseTo(1.0, 2);
    });
  });

  describe('距離メトリクス', () => {
    it('調整前後の距離を計算できる', () => {
      const vec1: MultiLayerVector = {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      };

      const vec2: MultiLayerVector = {
        subject: new Float32Array([0, 1, 0, 0]),
        attribute: new Float32Array([0, 1, 0]),
        style: new Float32Array([0, 1]),
        composition: new Float32Array([0]),
        emotion: new Float32Array([0]),
        relationMatrix: [[0]],
        timestamp: new Date(),
      };

      const transformedVec1: MultiLayerVector = {
        subject: new Float32Array([0.9, 0.1, 0, 0]),
        attribute: new Float32Array([0.9, 0.1, 0]),
        style: new Float32Array([0.9, 0.1]),
        composition: new Float32Array([0.9]),
        emotion: new Float32Array([0.9]),
        relationMatrix: [[0.9]],
        timestamp: new Date(),
      };

      const transformedVec2: MultiLayerVector = {
        subject: new Float32Array([0.1, 0.9, 0, 0]),
        attribute: new Float32Array([0.1, 0.9, 0]),
        style: new Float32Array([0.1, 0.9]),
        composition: new Float32Array([0.1]),
        emotion: new Float32Array([0.1]),
        relationMatrix: [[0.1]],
        timestamp: new Date(),
      };

      const metrics = adjuster.computeDistanceMetrics(
        vec1,
        vec2,
        transformedVec1,
        transformedVec2,
        'subject'
      );

      expect(metrics.beforeAdjustment).toBeGreaterThan(0);
      expect(metrics.afterAdjustment).toBeGreaterThan(0);
      expect(typeof metrics.improvement).toBe('number');
    });
  });

  describe('変換行列管理', () => {
    it('変換行列を取得できる', () => {
      const vectors = new Map<string, MultiLayerVector>();
      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const confusionPatterns: CrossUserPattern[] = [
        {
          promptPair: ['prompt1', 'prompt1'],
          confusionRate: 0.5,
          sampleSize: 5,
          averageSimilarity: 0.9,
        },
      ];

      adjuster.adjustVectorSpace(vectors, confusionPatterns);

      const transformation = adjuster.getTransformation('subject');
      expect(transformation).toBeDefined();
      expect(transformation?.matrix).toBeDefined();
      expect(transformation?.bias).toBeDefined();
    });

    it('調整履歴を記録する', () => {
      const vectors = new Map<string, MultiLayerVector>();
      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const confusionPatterns: CrossUserPattern[] = [];

      adjuster.adjustVectorSpace(vectors, confusionPatterns);
      adjuster.adjustVectorSpace(vectors, confusionPatterns);

      const history = adjuster.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].epoch).toBe(0);
      expect(history[1].epoch).toBe(1);
    });
  });

  describe('リセット機能', () => {
    it('変換行列と履歴をリセットできる', () => {
      const vectors = new Map<string, MultiLayerVector>();
      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const confusionPatterns: CrossUserPattern[] = [
        {
          promptPair: ['prompt1', 'prompt1'],
          confusionRate: 0.5,
          sampleSize: 5,
          averageSimilarity: 0.9,
        },
      ];

      adjuster.adjustVectorSpace(vectors, confusionPatterns);
      adjuster.reset();

      const transformation = adjuster.getTransformation('subject');
      expect(transformation).toBeUndefined();

      const history = adjuster.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('パラメータ設定', () => {
    it('学習率を設定できる', () => {
      adjuster.setLearningRate(0.05);

      // 設定後も正常動作する
      const vectors = new Map<string, MultiLayerVector>();
      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const adjustedVectors = adjuster.adjustVectorSpace(vectors, []);
      expect(adjustedVectors.size).toBe(1);
    });

    it('正則化強度を設定できる', () => {
      adjuster.setRegularizationStrength(0.005);

      const vectors = new Map<string, MultiLayerVector>();
      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const adjustedVectors = adjuster.adjustVectorSpace(vectors, []);
      expect(adjustedVectors.size).toBe(1);
    });

    it('学習率は範囲外の値を制限する', () => {
      adjuster.setLearningRate(100); // 大きすぎる値
      adjuster.setLearningRate(-1); // 負の値

      // エラーが出ずに動作する
      const vectors = new Map<string, MultiLayerVector>();
      vectors.set('prompt1', {
        subject: new Float32Array([1, 0, 0, 0]),
        attribute: new Float32Array([1, 0, 0]),
        style: new Float32Array([1, 0]),
        composition: new Float32Array([1]),
        emotion: new Float32Array([1]),
        relationMatrix: [[1]],
        timestamp: new Date(),
      });

      const adjustedVectors = adjuster.adjustVectorSpace(vectors, []);
      expect(adjustedVectors.size).toBe(1);
    });
  });
});
