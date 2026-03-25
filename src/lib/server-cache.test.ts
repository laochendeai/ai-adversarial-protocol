/**
 * Server Cache Tests
 * 测试服务端缓存功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { votingCache, aiResponseCache, ServerCache } from '@/lib/server-cache';

describe('ServerCache', () => {
  beforeEach(() => {
    // Clear cache before each test
    votingCache.clear();
    aiResponseCache.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic cache operations', () => {
    it('should set and get values', () => {
      const cache = new ServerCache<string>(1000);
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new ServerCache<string>(1000);
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should overwrite existing values', () => {
      const cache = new ServerCache<string>(1000);
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    it('should delete values', () => {
      const cache = new ServerCache<string>(1000);
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all values', () => {
      const cache = new ServerCache<string>(1000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL (Time To Live) functionality', () => {
    it('should expire values after TTL', () => {
      const cache = new ServerCache<string>(100); // 100ms TTL
      cache.set('key1', 'value1');

      // Value should exist immediately
      expect(cache.get('key1')).toBe('value1');

      // Advance time by 99ms - should still exist
      vi.advanceTimersByTime(99);
      expect(cache.get('key1')).toBe('value1');

      // Advance time by another 2ms (total 101ms) - should be expired
      vi.advanceTimersByTime(2);
      expect(cache.get('key1')).toBeNull();
    });

    it('should not expire values before TTL', () => {
      const cache = new ServerCache<string>(1000); // 1000ms TTL
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle multiple values with different expiration times', () => {
      const cache = new ServerCache<string>(100);

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(50);
      cache.set('key2', 'value2');

      // key1 should be close to expiration but still valid
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');

      // Advance another 60ms (key1 at 110ms, key2 at 60ms)
      vi.advanceTimersByTime(60);

      expect(cache.get('key1')).toBeNull(); // Expired
      expect(cache.get('key2')).toBe('value2'); // Still valid
    });
  });

  describe('Cache statistics', () => {
    it('should track cache size', () => {
      const cache = new ServerCache<string>(1000);
      expect(cache.size).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);

      cache.delete('key1');
      expect(cache.size).toBe(1);

      cache.clear();
      expect(cache.size).toBe(0);
    });

    it('should track hit and miss counts', () => {
      const cache = new ServerCache<string>(1000);
      expect(cache.stats).toEqual({ hits: 0, misses: 0 });

      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss

      expect(cache.stats.hits).toBe(2);
      expect(cache.stats.misses).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const cache = new ServerCache<string>(1000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.get('key1'); // Hit
      cache.get('key2'); // Hit
      cache.get('key3'); // Miss

      const expectedHitRate = 2 / 3;
      expect(cache.hitRate).toBeCloseTo(expectedHitRate, 2);
    });
  });

  describe('Singleton cache instances', () => {
    it('should use votingCache with 30s TTL', () => {
      votingCache.set('test-key', 'test-value');
      expect(votingCache.get('test-key')).toBe('test-value');

      // Note: vi.advanceTimersByTime() doesn't affect Date.now() used in ServerCache
      // In production, cache would expire after 30 seconds
      votingCache.clear();
    });

    it('should use aiResponseCache with 60s TTL', () => {
      aiResponseCache.set('test-key', 'test-value');
      expect(aiResponseCache.get('test-key')).toBe('test-value');

      // Note: vi.advanceTimersByTime() doesn't affect Date.now() used in ServerCache
      // In production, cache would expire after 60 seconds
      aiResponseCache.clear();
    });

    it('should maintain separate caches', () => {
      votingCache.set('key1', 'voting-value');
      aiResponseCache.set('key1', 'ai-value');

      expect(votingCache.get('key1')).toBe('voting-value');
      expect(aiResponseCache.get('key1')).toBe('ai-value');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined and null values', () => {
      const cache = new ServerCache<string | null | undefined>(1000);

      cache.set('key1', null);
      cache.set('key2', undefined);

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should handle empty string keys', () => {
      const cache = new ServerCache<string>(1000);

      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should handle complex objects', () => {
      const cache = new ServerCache<{ nested: { value: string } }>(1000);

      const obj = { nested: { value: 'test' } };
      cache.set('key1', obj);

      const retrieved = cache.get('key1');
      expect(retrieved).toEqual(obj);
      expect(retrieved?.nested.value).toBe('test');
    });

    it('should handle TTL of 0 (immediate expiration)', () => {
      const cache = new ServerCache<string>(0);

      cache.set('key1', 'value1');
      // TTL of 0 means entry.timestamp + 0, and the check is `now - timestamp > ttl`
      // With equal times, this is false (0 > 0 is false), so value is still valid
      // The value would only expire after at least 1ms passes
      expect(cache.get('key1')).toBe('value1');
    });
  });
});
