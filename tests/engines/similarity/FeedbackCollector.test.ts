/**
 * フィードバック収集メカニズム - ユニットテスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FeedbackCollector } from '../../../src/engines/similarity/FeedbackCollector.js';

describe('FeedbackCollector', () => {
  let collector: FeedbackCollector;

  beforeEach(() => {
    collector = new FeedbackCollector();
  });

  describe('明示的フィードバック', () => {
    it('採用フィードバックを記録できる', () => {
      collector.recordExplicitFeedback('prompt1', 'result1', 'accepted', 'user1');

      const feedback = collector.getFeedback('prompt1');
      expect(feedback).toHaveLength(1);
      expect(feedback[0].explicit).toBe('accepted');
      expect(feedback[0].userId).toBe('user1');
    });

    it('不採用フィードバックを記録できる', () => {
      collector.recordExplicitFeedback('prompt2', 'result2', 'rejected', 'user2');

      const feedback = collector.getFeedback('prompt2');
      expect(feedback).toHaveLength(1);
      expect(feedback[0].explicit).toBe('rejected');
    });

    it('複数のフィードバックを記録できる', () => {
      collector.recordExplicitFeedback('prompt1', 'result1', 'accepted');
      collector.recordExplicitFeedback('prompt1', 'result2', 'rejected');

      const feedback = collector.getFeedback('prompt1');
      expect(feedback).toHaveLength(2);
    });
  });

  describe('暗黙的フィードバック', () => {
    it('再生成回数を記録できる', () => {
      collector.recordImplicitFeedback('prompt1', 'result1', {
        regenerationCount: 3,
      });

      const feedback = collector.getFeedback('prompt1');
      expect(feedback[0].implicit.regenerationCount).toBe(3);
    });

    it('編集回数を記録できる', () => {
      collector.recordImplicitFeedback('prompt2', 'result2', {
        editCount: 5,
      });

      const feedback = collector.getFeedback('prompt2');
      expect(feedback[0].implicit.editCount).toBe(5);
    });

    it('滞留時間を記録できる', () => {
      collector.recordImplicitFeedback('prompt3', 'result3', {
        dwellTime: 1500,
      });

      const feedback = collector.getFeedback('prompt3');
      expect(feedback[0].implicit.dwellTime).toBe(1500);
    });

    it('クリックされたバリアントを記録できる', () => {
      collector.recordImplicitFeedback('prompt4', 'result4', {
        clickedVariants: ['var1', 'var2', 'var3'],
      });

      const feedback = collector.getFeedback('prompt4');
      expect(feedback[0].implicit.clickedVariants).toEqual(['var1', 'var2', 'var3']);
    });
  });

  describe('セッション管理', () => {
    it('セッションを開始できる', () => {
      collector.startSession('user1', 'session1');

      const session = collector.getSession('session1');
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('session1');
    });

    it('セッションを終了できる', () => {
      collector.startSession('user1', 'session1');
      collector.endSession('session1');

      const session = collector.getSession('session1');
      expect(session?.endTime).toBeDefined();
    });

    it('セッションにプロンプトを追加できる', () => {
      collector.startSession('user1', 'session1');
      collector.addPromptToSession('session1', 'prompt1', 'result1');
      collector.addPromptToSession('session1', 'prompt2', 'result2');

      const session = collector.getSession('session1');
      expect(session?.prompts).toHaveLength(2);
      expect(session?.results).toHaveLength(2);
    });
  });

  describe('ユーザー設定', () => {
    it('ユーザー設定を更新できる', () => {
      collector.startSession('user1', 'session1');
      collector.updateUserPreferences('user1', {
        preferredStyles: ['anime', 'realistic'],
        qualityPreference: 'quality',
      });

      const history = collector.getUserHistory('user1');
      expect(history?.preferences.preferredStyles).toEqual(['anime', 'realistic']);
      expect(history?.preferences.qualityPreference).toBe('quality');
    });
  });

  describe('連続リクエストパターン検出', () => {
    it('連続リクエストパターンを検出できる', () => {
      collector.startSession('user1', 'session1');
      collector.addPromptToSession('session1', 'prompt1', 'result1');
      collector.addPromptToSession('session1', 'prompt1', 'result2');
      collector.addPromptToSession('session1', 'prompt1', 'result3');

      const pattern = collector.detectContinuousRequestPattern('session1');
      expect(pattern.hasPattern).toBe(true);
      expect(pattern.frequency).toBe(3);
    });

    it('パターンがない場合はfalseを返す', () => {
      collector.startSession('user1', 'session1');
      collector.addPromptToSession('session1', 'prompt1', 'result1');
      collector.addPromptToSession('session1', 'prompt2', 'result2');

      const pattern = collector.detectContinuousRequestPattern('session1');
      expect(pattern.hasPattern).toBe(false);
    });
  });

  describe('クロスユーザーパターン分析', () => {
    it('混同されやすいプロンプトペアを検出できる', () => {
      // 複数ユーザーが同じプロンプトを拒否
      for (let i = 0; i < 10; i++) {
        collector.recordExplicitFeedback(`prompt1`, `result${i}`, 'rejected', `user${i}`);
        collector.recordImplicitFeedback(`prompt1`, `result${i}`, {
          regenerationCount: 2,
        });
      }

      const patterns = collector.analyzeCrossUserPatterns(5);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].confusionRate).toBeGreaterThan(0);
    });
  });

  describe('フィードバック集計', () => {
    it('全体の集計結果を取得できる', () => {
      collector.recordExplicitFeedback('prompt1', 'result1', 'accepted');
      collector.recordExplicitFeedback('prompt2', 'result2', 'rejected');
      collector.recordImplicitFeedback('prompt1', 'result1', {
        regenerationCount: 1,
        editCount: 2,
      });

      const aggregation = collector.aggregateFeedback();
      expect(aggregation.totalFeedback).toBe(2);
      expect(aggregation.acceptanceRate).toBe(0.5);
      expect(aggregation.averageRegenerationCount).toBeGreaterThan(0);
    });

    it('特定プロンプトの集計結果を取得できる', () => {
      collector.recordExplicitFeedback('prompt1', 'result1', 'accepted');
      collector.recordExplicitFeedback('prompt2', 'result2', 'rejected');

      const aggregation = collector.aggregateFeedback(['prompt1']);
      expect(aggregation.totalFeedback).toBe(1);
      expect(aggregation.acceptanceRate).toBe(1.0);
    });
  });
});
