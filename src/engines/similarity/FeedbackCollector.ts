/**
 * フィードバック収集メカニズム
 * 特許: 生成AI画像のキャッシュシステム及び方法
 */

import type {
  FeedbackData,
  UsageHistory,
  SessionData,
  UserPreferences,
  ImplicitFeedback,
} from '../../types/index.js';

/**
 * クロスユーザーパターン分析結果
 */
export interface CrossUserPattern {
  promptPair: [string, string];
  confusionRate: number;
  sampleSize: number;
  averageSimilarity: number;
}

/**
 * 収集されたフィードバックの集計結果
 */
export interface FeedbackAggregation {
  totalFeedback: number;
  acceptanceRate: number;
  averageRegenerationCount: number;
  averageEditCount: number;
  patterns: CrossUserPattern[];
}

/**
 * フィードバック収集エンジン
 * 明示的・暗黙的フィードバック、使用パターン、クロスユーザーパターンを収集
 */
export class FeedbackCollector {
  private feedbackStore: Map<string, FeedbackData[]> = new Map();
  private usageHistoryStore: Map<string, UsageHistory> = new Map();
  private sessionStore: Map<string, SessionData> = new Map();

  /**
   * 明示的フィードバックを記録
   */
  recordExplicitFeedback(
    promptId: string,
    resultId: string,
    feedback: 'accepted' | 'rejected',
    userId?: string
  ): void {
    const feedbackData: FeedbackData = {
      promptId,
      resultId,
      explicit: feedback,
      implicit: {
        regenerationCount: 0,
        editCount: 0,
        dwellTime: 0,
        clickedVariants: [],
      },
      timestamp: new Date(),
      userId,
    };

    this.storeFeedback(promptId, feedbackData);
  }

  /**
   * 暗黙的フィードバックを記録
   */
  recordImplicitFeedback(
    promptId: string,
    resultId: string,
    implicit: Partial<ImplicitFeedback>,
    userId?: string
  ): void {
    const existingFeedback = this.findFeedback(promptId, resultId);

    if (existingFeedback) {
      // 既存のフィードバックを更新
      existingFeedback.implicit = {
        ...existingFeedback.implicit,
        ...implicit,
      };
    } else {
      // 新規フィードバック作成
      const feedbackData: FeedbackData = {
        promptId,
        resultId,
        explicit: null,
        implicit: {
          regenerationCount: implicit.regenerationCount ?? 0,
          editCount: implicit.editCount ?? 0,
          dwellTime: implicit.dwellTime ?? 0,
          clickedVariants: implicit.clickedVariants ?? [],
        },
        timestamp: new Date(),
        userId,
      };

      this.storeFeedback(promptId, feedbackData);
    }
  }

  /**
   * セッション開始
   */
  startSession(userId: string, sessionId: string): void {
    const session: SessionData = {
      sessionId,
      prompts: [],
      results: [],
      feedback: [],
      startTime: new Date(),
    };

    this.sessionStore.set(sessionId, session);

    // UsageHistoryを取得または作成
    let history = this.usageHistoryStore.get(userId);
    if (!history) {
      history = {
        userId,
        sessions: [],
        preferences: {
          preferredStyles: [],
          colorPreferences: [],
          qualityPreference: 'balanced',
        },
      };
      this.usageHistoryStore.set(userId, history);
    }

    history.sessions.push(session);
  }

  /**
   * セッション終了
   */
  endSession(sessionId: string): void {
    const session = this.sessionStore.get(sessionId);
    if (session) {
      session.endTime = new Date();
    }
  }

  /**
   * セッションにプロンプトを追加
   */
  addPromptToSession(sessionId: string, promptId: string, resultId: string): void {
    const session = this.sessionStore.get(sessionId);
    if (session) {
      session.prompts.push(promptId);
      session.results.push(resultId);
    }
  }

  /**
   * ユーザー設定を更新
   */
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): void {
    const history = this.usageHistoryStore.get(userId);
    if (history) {
      history.preferences = {
        ...history.preferences,
        ...preferences,
      };
    }
  }

  /**
   * 連続リクエストパターンを検出
   */
  detectContinuousRequestPattern(sessionId: string): {
    hasPattern: boolean;
    similarPrompts: string[];
    frequency: number;
  } {
    const session = this.sessionStore.get(sessionId);
    if (!session || session.prompts.length < 2) {
      return { hasPattern: false, similarPrompts: [], frequency: 0 };
    }

    const promptFrequency = new Map<string, number>();
    session.prompts.forEach((prompt) => {
      promptFrequency.set(prompt, (promptFrequency.get(prompt) || 0) + 1);
    });

    const repeated = Array.from(promptFrequency.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (repeated.length > 0) {
      return {
        hasPattern: true,
        similarPrompts: repeated.map(([prompt]) => prompt),
        frequency: repeated[0][1],
      };
    }

    return { hasPattern: false, similarPrompts: [], frequency: 0 };
  }

  /**
   * クロスユーザーパターンを分析
   * 複数ユーザーで混同されやすいプロンプトペアを検出
   */
  analyzeCrossUserPatterns(minSampleSize: number = 5): CrossUserPattern[] {
    const pairConfusion = new Map<string, {
      count: number;
      totalSimilarity: number;
      rejections: number;
    }>();

    // 全ユーザーのフィードバックを集計
    this.feedbackStore.forEach((feedbackList) => {
      feedbackList.forEach((feedback) => {
        if (feedback.explicit === 'rejected' && feedback.implicit.regenerationCount > 0) {
          const key = feedback.promptId;
          const existing = pairConfusion.get(key) || {
            count: 0,
            totalSimilarity: 0,
            rejections: 0,
          };

          existing.count++;
          existing.rejections++;
          pairConfusion.set(key, existing);
        }
      });
    });

    // パターンを抽出
    const patterns: CrossUserPattern[] = [];
    pairConfusion.forEach((data, promptId) => {
      if (data.count >= minSampleSize && data.rejections / data.count > 0.3) {
        patterns.push({
          promptPair: [promptId, promptId], // 簡略化: 実際は類似プロンプトとペア化
          confusionRate: data.rejections / data.count,
          sampleSize: data.count,
          averageSimilarity: data.totalSimilarity / data.count,
        });
      }
    });

    return patterns.sort((a, b) => b.confusionRate - a.confusionRate);
  }

  /**
   * フィードバックを集計
   */
  aggregateFeedback(promptIds?: string[]): FeedbackAggregation {
    let allFeedback: FeedbackData[] = [];

    if (promptIds) {
      promptIds.forEach((id) => {
        const feedback = this.feedbackStore.get(id) || [];
        allFeedback = allFeedback.concat(feedback);
      });
    } else {
      this.feedbackStore.forEach((feedback) => {
        allFeedback = allFeedback.concat(feedback);
      });
    }

    const totalFeedback = allFeedback.length;
    const accepted = allFeedback.filter((f) => f.explicit === 'accepted').length;
    const totalRegeneration = allFeedback.reduce(
      (sum, f) => sum + f.implicit.regenerationCount,
      0
    );
    const totalEdits = allFeedback.reduce((sum, f) => sum + f.implicit.editCount, 0);

    return {
      totalFeedback,
      acceptanceRate: totalFeedback > 0 ? accepted / totalFeedback : 0,
      averageRegenerationCount: totalFeedback > 0 ? totalRegeneration / totalFeedback : 0,
      averageEditCount: totalFeedback > 0 ? totalEdits / totalFeedback : 0,
      patterns: this.analyzeCrossUserPatterns(),
    };
  }

  /**
   * 特定プロンプトのフィードバックを取得
   */
  getFeedback(promptId: string): FeedbackData[] {
    return this.feedbackStore.get(promptId) || [];
  }

  /**
   * ユーザーの使用履歴を取得
   */
  getUserHistory(userId: string): UsageHistory | undefined {
    return this.usageHistoryStore.get(userId);
  }

  /**
   * セッション情報を取得
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessionStore.get(sessionId);
  }

  /**
   * フィードバックを保存（内部ヘルパー）
   */
  private storeFeedback(promptId: string, feedback: FeedbackData): void {
    const existing = this.feedbackStore.get(promptId) || [];
    existing.push(feedback);
    this.feedbackStore.set(promptId, existing);
  }

  /**
   * フィードバックを検索（内部ヘルパー）
   */
  private findFeedback(promptId: string, resultId: string): FeedbackData | undefined {
    const feedbackList = this.feedbackStore.get(promptId) || [];
    return feedbackList.find((f) => f.resultId === resultId);
  }
}
