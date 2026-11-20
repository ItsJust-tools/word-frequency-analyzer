import { describe, it, expect } from 'vitest';
import { wordFrequencyTool } from '@/tool/tool-definition';
import { analyzeWords, filterEntries } from '@/tool/tool-definition';
import type { ToolState, WordStats } from '@/tool/types';

describe('Word frequency logic', () => {
  it('initializes with default state', () => {
    expect(wordFrequencyTool.initialState.input).not.toBe('');
    expect(wordFrequencyTool.initialState.excludeStopwords).toBe(false);
  });

  it('updates text content immutably', () => {
    const state: ToolState = { ...wordFrequencyTool.initialState, input: 'Hello world' };
    expect(state.input).toBe('Hello world');
    expect(wordFrequencyTool.initialState.input).not.toBe('Hello world');
  });
});

describe('Word frequency deserialize', () => {
  it('accepts valid state object', () => {
    const result = wordFrequencyTool.deserialize({
      input: 'Valid',
      caseSensitive: false,
      excludeStopwords: true,
      normalizeAccents: true,
      sortMode: 'count',
      filter: 'a',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input).toBe('Valid');
      expect(result.data.excludeStopwords).toBe(true);
    }
  });

  it('rejects null data', () => {
    const result = wordFrequencyTool.deserialize(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid data');
    }
  });

  it('rejects non-object data', () => {
    const result = wordFrequencyTool.deserialize('string');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid data');
    }
  });

  it('rejects object with missing fields', () => {
    const result = wordFrequencyTool.deserialize({ input: 'partial' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid data');
    }
  });

  it('rejects object with wrong field types', () => {
    const result = wordFrequencyTool.deserialize({
      ...wordFrequencyTool.initialState,
      filter: 123,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid data');
    }
  });

  it('round-trips state through serialize/deserialize', () => {
    const state: ToolState = {
      input: 'Test words here',
      caseSensitive: true,
      excludeStopwords: false,
      normalizeAccents: false,
      sortMode: 'alphabetical',
      filter: 'test',
    };
    const json = wordFrequencyTool.serialize(state);
    expect(() => JSON.parse(json)).not.toThrow();
    const result = wordFrequencyTool.deserialize(JSON.parse(json));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(state);
    }
  });
});

describe('analyze + filter integration', () => {
  it('produces stats usable by the sidebar table', () => {
    const state: ToolState = {
      ...wordFrequencyTool.initialState,
      input: 'red fish blue fish red fish',
      sortMode: 'count',
    };
    const stats: WordStats = analyzeWords(state);
    expect(stats.entries[0]?.word).toBe('fish');
    expect(stats.entries[0]?.count).toBe(3);
    const filtered = filterEntries(stats.entries, 'fish', false);
    expect(filtered).toHaveLength(1);
    const sum = stats.entries.reduce((acc, e) => acc + e.percentage, 0);
    expect(sum).toBeCloseTo(100, 6);
  });
});
