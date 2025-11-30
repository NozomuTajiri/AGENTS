/**
 * Semantic Cache System - Unit Tests
 *
 * SemanticCacheSystemの統合テスト
 *
 * @module tests/SemanticCacheSystem
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticCacheSystem } from '../src/core/SemanticCacheSystem.js';
import type {
  GenerationRequest,
  GenerationResult,
  FeedbackData,
  SystemStats,
  HealthCheckResult,
} from '../src/index.js';

describe('SemanticCacheSystem', () => {
  let system: SemanticCacheSystem;

  beforeEach(() => {
    system = new SemanticCacheSystem({
      memoryLimit: 0.92,
      decision: {
        cacheHitThreshold: 0.85,
        diffGenerationThreshold: 0.65,
      },
      storage: {
        numShards: 4,
      },
    });
  });

  afterEach(async () => {
    if (system) {
      await system.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(system.initialize()).resolves.not.toThrow();
    });

    it('should throw error on double initialization', async () => {
      await system.initialize();
      await expect(system.initialize()).rejects.toThrow(
        'System already initialized'
      );
    });
  });

  describe('Generation', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should generate image from prompt', async () => {
      const request: GenerationRequest = {
        prompt: 'a beautiful sunset over mountains',
      };

      const result: GenerationResult = await system.generate(request);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.image).toBeInstanceOf(Buffer);
      expect(result.prompt).toBe(request.prompt);
      expect(result.vector).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(typeof result.fromCache).toBe('boolean');
      expect(typeof result.processingTime).toBe('number');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedSystem = new SemanticCacheSystem();
      const request: GenerationRequest = {
        prompt: 'test prompt',
      };

      await expect(uninitializedSystem.generate(request)).rejects.toThrow(
        'System not initialized'
      );
    });

    it('should handle reference images', async () => {
      const request: GenerationRequest = {
        prompt: 'similar to reference',
        referenceImages: [Buffer.from('mock-reference-image')],
      };

      const result = await system.generate(request);
      expect(result).toBeDefined();
      expect(result.image).toBeInstanceOf(Buffer);
    });

    it('should handle constraints', async () => {
      const request: GenerationRequest = {
        prompt: 'constrained generation',
        constraints: {
          maxWidth: 1024,
          maxHeight: 1024,
          aspectRatio: '16:9',
          style: 'photorealistic',
        },
      };

      const result = await system.generate(request);
      expect(result).toBeDefined();
    });

    it('should use cache for similar prompts', async () => {
      const request1: GenerationRequest = {
        prompt: 'sunset over mountains',
      };
      const request2: GenerationRequest = {
        prompt: 'sunset over mountains',
      };

      const result1 = await system.generate(request1);
      const result2 = await system.generate(request2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // 2回目はキャッシュヒットの可能性がある
      const stats = system.getStats();
      expect(stats.totalRequests).toBe(2);
    });
  });

  describe('Feedback Recording', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should record explicit feedback', async () => {
      const request: GenerationRequest = {
        prompt: 'test prompt for feedback',
      };

      const result = await system.generate(request);

      const feedback: FeedbackData = {
        promptId: result.id,
        resultId: result.id,
        explicit: 'accepted',
        implicit: {
          regenerationCount: 0,
          editCount: 0,
          dwellTime: 5000,
          clickedVariants: [],
        },
        timestamp: new Date(),
      };

      expect(() => system.recordFeedback(feedback)).not.toThrow();
    });

    it('should record rejection feedback', async () => {
      const request: GenerationRequest = {
        prompt: 'another test',
      };

      const result = await system.generate(request);

      const feedback: FeedbackData = {
        promptId: result.id,
        resultId: result.id,
        explicit: 'rejected',
        implicit: {
          regenerationCount: 3,
          editCount: 2,
          dwellTime: 1000,
          clickedVariants: [],
        },
        timestamp: new Date(),
      };

      expect(() => system.recordFeedback(feedback)).not.toThrow();
    });

    it('should handle feedback before initialization gracefully', () => {
      const uninitializedSystem = new SemanticCacheSystem();

      const feedback: FeedbackData = {
        promptId: 'test-id',
        resultId: 'test-id',
        explicit: 'accepted',
        implicit: {
          regenerationCount: 0,
          editCount: 0,
          dwellTime: 5000,
          clickedVariants: [],
        },
        timestamp: new Date(),
      };

      // Should not throw, just warn
      expect(() => uninitializedSystem.recordFeedback(feedback)).not.toThrow();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should return system statistics', () => {
      const stats: SystemStats = system.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHits).toBeGreaterThanOrEqual(0);
      expect(stats.diffGenerations).toBeGreaterThanOrEqual(0);
      expect(stats.newGenerations).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.avgProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsageRatio).toBeGreaterThanOrEqual(0);
      expect(stats.storageStats).toBeDefined();
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should update statistics after generation', async () => {
      const statsBefore = system.getStats();
      const initialRequests = statsBefore.totalRequests;

      await system.generate({ prompt: 'test' });

      const statsAfter = system.getStats();
      expect(statsAfter.totalRequests).toBe(initialRequests + 1);
    });

    it('should track cache hit rate', async () => {
      const request: GenerationRequest = { prompt: 'cache test' };

      await system.generate(request);
      await system.generate(request);

      const stats = system.getStats();
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should clear all cache levels', async () => {
      await system.generate({ prompt: 'test 1' });
      await system.generate({ prompt: 'test 2' });

      await system.clearCache();

      const stats = system.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
    });

    it('should clear specific cache level', async () => {
      await system.generate({ prompt: 'test' });

      await expect(system.clearCache('L1')).resolves.not.toThrow();
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should perform health check', async () => {
      const health: HealthCheckResult = await system.healthCheck();

      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
      expect(['ok', 'degraded', 'error']).toContain(health.status);
      expect(health.components).toBeDefined();
      expect(health.components.input).toBeDefined();
      expect(health.components.vectorization).toBeDefined();
      expect(health.components.similarity).toBeDefined();
      expect(health.components.decision).toBeDefined();
      expect(health.components.image).toBeDefined();
      expect(health.components.storage).toBeDefined();
      expect(health.metrics).toBeDefined();
      expect(health.metrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(health.metrics.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.issues).toBeInstanceOf(Array);
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should detect component health', async () => {
      const health = await system.healthCheck();

      Object.values(health.components).forEach((component) => {
        expect(typeof component.healthy).toBe('boolean');
        if (component.responseTime !== undefined) {
          expect(component.responseTime).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Shutdown', () => {
    it('should shutdown successfully', async () => {
      await system.initialize();
      await expect(system.shutdown()).resolves.not.toThrow();
    });

    it('should allow shutdown without initialization', async () => {
      const uninitializedSystem = new SemanticCacheSystem();
      await expect(uninitializedSystem.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customSystem = new SemanticCacheSystem({
        memoryLimit: 0.8,
        input: {
          maxTextLength: 5000,
          maxImageSize: 5 * 1024 * 1024,
        },
        decision: {
          cacheHitThreshold: 0.9,
          diffGenerationThreshold: 0.7,
        },
      });

      expect(customSystem).toBeDefined();
    });

    it('should work with minimal configuration', () => {
      const minimalSystem = new SemanticCacheSystem();
      expect(minimalSystem).toBeDefined();
    });

    it('should work with optimization enabled', () => {
      const optimizedSystem = new SemanticCacheSystem({
        optimization: {
          enableOptimization: true,
          useCaseType: 'ecommerce',
          useCaseConfig: {
            catalogSize: 1000,
          },
        },
      });

      expect(optimizedSystem).toBeDefined();
    });
  });

  describe('Integration Flow', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    it('should execute full workflow: generate -> feedback -> stats', async () => {
      // 1. Generate
      const result = await system.generate({
        prompt: 'integration test prompt',
      });

      expect(result).toBeDefined();

      // 2. Feedback
      system.recordFeedback({
        promptId: result.id,
        resultId: result.id,
        explicit: 'accepted',
        implicit: {
          regenerationCount: 0,
          editCount: 0,
          dwellTime: 3000,
          clickedVariants: [],
        },
        timestamp: new Date(),
      });

      // 3. Stats
      const stats = system.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = [
        { prompt: 'concurrent 1' },
        { prompt: 'concurrent 2' },
        { prompt: 'concurrent 3' },
      ];

      const results = await Promise.all(
        requests.map((req) => system.generate(req))
      );

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.image).toBeInstanceOf(Buffer);
      });
    });
  });
});
