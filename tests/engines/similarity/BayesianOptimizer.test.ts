/**
 * ベイジアン最適化フレームワーク - ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BayesianOptimizer } from '../../../src/engines/similarity/BayesianOptimizer.js';
import type { FeedbackData, SystemParams } from '../../../src/types/index.js';

describe('BayesianOptimizer', () => {
  let optimizer: BayesianOptimizer;
  let initialParams: SystemParams;

  beforeEach(() => {
    initialParams = {
      layerWeights: {
        subject: 0.3,
        attribute: 0.25,
        style: 0.2,
        composition: 0.15,
        emotion: 0.1,
      },
      thresholds: {
        cacheHit: 0.95,
        diffGeneration: 0.85,
      },
      learningRate: 0.01,
    };
    optimizer = new BayesianOptimizer(initialParams);
  });

  describe('パラメータ最適化', () => {
    it('フィードバックからパラメータを最適化できる', () => {
      const feedbackData: FeedbackData[] = [
        {
          promptId: 'prompt1',
          resultId: 'result1',
          explicit: 'accepted',
          implicit: {
            regenerationCount: 0,
            editCount: 0,
            dwellTime: 2000,
            clickedVariants: [],
          },
          timestamp: new Date(),
        },
        {
          promptId: 'prompt2',
          resultId: 'result2',
          explicit: 'rejected',
          implicit: {
            regenerationCount: 3,
            editCount: 5,
            dwellTime: 500,
            clickedVariants: ['var1'],
          },
          timestamp: new Date(),
        },
      ];

      const optimizedParams = optimizer.optimize(feedbackData, initialParams);

      expect(optimizedParams).toBeDefined();
      expect(optimizedParams.layerWeights).toBeDefined();
      expect(optimizedParams.thresholds).toBeDefined();

      // 重みの合計は1.0付近
      const totalWeight = Object.values(optimizedParams.layerWeights).reduce(
        (sum, w) => sum + w,
        0
      );
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('最適化後の重みは0-1の範囲内', () => {
      const feedbackData: FeedbackData[] = Array.from({ length: 10 }, (_, i) => ({
        promptId: `prompt${i}`,
        resultId: `result${i}`,
        explicit: i % 2 === 0 ? 'accepted' : 'rejected',
        implicit: {
          regenerationCount: i % 3,
          editCount: i % 2,
          dwellTime: 1000 + i * 100,
          clickedVariants: [],
        },
        timestamp: new Date(),
      })) as FeedbackData[];

      const optimizedParams = optimizer.optimize(feedbackData, initialParams);

      Object.values(optimizedParams.layerWeights).forEach((weight) => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it('閾値は適切な範囲内', () => {
      const feedbackData: FeedbackData[] = [
        {
          promptId: 'prompt1',
          resultId: 'result1',
          explicit: 'accepted',
          implicit: {
            regenerationCount: 0,
            editCount: 0,
            dwellTime: 2000,
            clickedVariants: [],
          },
          timestamp: new Date(),
        },
      ];

      const optimizedParams = optimizer.optimize(feedbackData, initialParams);

      expect(optimizedParams.thresholds.cacheHit).toBeGreaterThanOrEqual(0.5);
      expect(optimizedParams.thresholds.cacheHit).toBeLessThanOrEqual(0.99);
      expect(optimizedParams.thresholds.diffGeneration).toBeGreaterThanOrEqual(0.3);
      expect(optimizedParams.thresholds.diffGeneration).toBeLessThanOrEqual(0.95);
    });
  });

  describe('最適化履歴', () => {
    it('最適化履歴を記録する', () => {
      const feedbackData: FeedbackData[] = [
        {
          promptId: 'prompt1',
          resultId: 'result1',
          explicit: 'accepted',
          implicit: {
            regenerationCount: 0,
            editCount: 0,
            dwellTime: 2000,
            clickedVariants: [],
          },
          timestamp: new Date(),
        },
      ];

      optimizer.optimize(feedbackData, initialParams);
      optimizer.optimize(feedbackData, initialParams);

      const history = optimizer.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].epoch).toBe(0);
      expect(history[1].epoch).toBe(1);
    });

    it('最適なパラメータを取得できる', () => {
      const feedbackData: FeedbackData[] = [
        {
          promptId: 'prompt1',
          resultId: 'result1',
          explicit: 'accepted',
          implicit: {
            regenerationCount: 0,
            editCount: 0,
            dwellTime: 2000,
            clickedVariants: [],
          },
          timestamp: new Date(),
        },
      ];

      optimizer.optimize(feedbackData, initialParams);
      const bestParams = optimizer.getBestParams();

      expect(bestParams).toBeDefined();
      expect(bestParams?.layerWeights).toBeDefined();
    });
  });

  describe('収束判定', () => {
    it('初期状態では収束していない', () => {
      const hasConverged = optimizer.hasConverged(10);
      expect(hasConverged).toBe(false);
    });

    it('十分なエポック後に収束判定が可能', () => {
      const feedbackData: FeedbackData[] = [
        {
          promptId: 'prompt1',
          resultId: 'result1',
          explicit: 'accepted',
          implicit: {
            regenerationCount: 0,
            editCount: 0,
            dwellTime: 2000,
            clickedVariants: [],
          },
          timestamp: new Date(),
        },
      ];

      let currentParams = initialParams;

      // 複数回最適化を実行
      for (let i = 0; i < 15; i++) {
        currentParams = optimizer.optimize(feedbackData, currentParams);
      }

      const hasConverged = optimizer.hasConverged(10, 0.001);
      expect(typeof hasConverged).toBe('boolean');
    });
  });

  describe('学習率の自動調整', () => {
    it('損失が改善すると学習率が増加する可能性がある', () => {
      const feedbackData: FeedbackData[] = [
        {
          promptId: 'prompt1',
          resultId: 'result1',
          explicit: 'accepted',
          implicit: {
            regenerationCount: 0,
            editCount: 0,
            dwellTime: 2000,
            clickedVariants: [],
          },
          timestamp: new Date(),
        },
      ];

      const params1 = optimizer.optimize(feedbackData, initialParams);
      const params2 = optimizer.optimize(feedbackData, params1);

      expect(params2.learningRate).toBeGreaterThan(0);
      expect(params2.learningRate).toBeLessThanOrEqual(0.1);
    });
  });
});
