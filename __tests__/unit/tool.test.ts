import { describe, it, expect } from 'vitest';
import {
  analyzeWords,
  tokenize,
  stripAccents,
  sortEntries,
  filterEntries,
  toCsv,
  toJson,
  STOPWORDS,
  wordFrequencyTool,
  WordFrequencyToolDefinition,
} from '../../src/tool/tool-definition';
import type { ToolState, WordCount } from '../../src/tool/types';

const baseState: ToolState = {
  input: '',
  caseSensitive: false,
  excludeStopwords: false,
  normalizeAccents: true,
  sortMode: 'count',
  filter: '',
};

function makeState(patch: Partial<ToolState>): ToolState {
  return { ...baseState, ...patch };
}

describe('tokenize', () => {
  it('strips punctuation and folds case', () => {
    expect(tokenize('Hello, World! HELLO...', baseState)).toEqual(['hello', 'world', 'hello']);
  });

  it('keeps apostrophes inside words', () => {
    expect(tokenize("don't stop", baseState)).toEqual(["don't", 'stop']);
  });

  it('respects case sensitivity', () => {
    expect(tokenize('Hello hello HELLO', makeState({ caseSensitive: true }))).toEqual([
      'Hello',
      'hello',
      'HELLO',
    ]);
  });

  it('normalizes accents when enabled', () => {
    expect(tokenize('café naïve', makeState({ normalizeAccents: true }))).toEqual([
      'cafe',
      'naive',
    ]);
    expect(tokenize('café naïve', makeState({ normalizeAccents: false }))).toEqual([
      'café',
      'naïve',
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenize('', baseState)).toEqual([]);
    expect(tokenize('   \n\t ', baseState)).toEqual([]);
  });

  it('keeps numbers as tokens', () => {
    expect(tokenize('42 cows, 7 sheep', baseState)).toEqual(['42', 'cows', '7', 'sheep']);
  });
});

describe('stripAccents', () => {
  it('decomposes accented characters', () => {
    expect(stripAccents('é')).toBe('e');
    expect(stripAccents('ÜBER')).toBe('UBER');
    expect(stripAccents('plain')).toBe('plain');
  });
});

describe('analyzeWords counts', () => {
  it('counts words correctly with punctuation stripping and case folding', () => {
    const stats = analyzeWords(makeState({ input: 'The cat, the dog. THE dog!' }));
    expect(stats.entries.find((e) => e.word === 'the')?.count).toBe(3);
    expect(stats.entries.find((e) => e.word === 'dog')?.count).toBe(2);
    expect(stats.entries.find((e) => e.word === 'cat')?.count).toBe(1);
    expect(stats.totalWords).toBe(6);
    expect(stats.uniqueWords).toBe(3);
  });

  it('counts case-sensitively when enabled', () => {
    const stats = analyzeWords(makeState({ input: 'Apple apple APPLE', caseSensitive: true }));
    expect(stats.uniqueWords).toBe(3);
    const statsFolded = analyzeWords(makeState({ input: 'Apple apple APPLE' }));
    expect(statsFolded.uniqueWords).toBe(1);
    expect(statsFolded.entries[0]?.count).toBe(3);
  });

  it('handles hyphenated and numeric tokens', () => {
    const stats = analyzeWords(makeState({ input: 'well-known well-known 3' }));
    expect(stats.entries.find((e) => e.word === 'well-known')?.count).toBe(2);
    expect(stats.entries.find((e) => e.word === '3')?.count).toBe(1);
  });

  it('returns empty stats for empty input', () => {
    const stats = analyzeWords(makeState({ input: '' }));
    expect(stats.totalWords).toBe(0);
    expect(stats.uniqueWords).toBe(0);
    expect(stats.averageWordLength).toBe(0);
    expect(stats.entries).toEqual([]);
  });
});

describe('analyzeWords stats', () => {
  it('average word length is correct for mixed words', () => {
    const stats = analyzeWords(makeState({ input: 'a bb ccc' }));
    expect(stats.averageWordLength).toBeCloseTo(2, 10);
  });

  it('percentages sum to roughly 100', () => {
    const stats = analyzeWords(
      makeState({ input: 'one two two three three three four four four four' })
    );
    const sum = stats.entries.reduce((acc, e) => acc + e.percentage, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('recomputes on text change (new input, new stats)', () => {
    const before = analyzeWords(makeState({ input: 'alpha beta' }));
    const after = analyzeWords(makeState({ input: 'gamma gamma gamma' }));
    expect(before.uniqueWords).toBe(2);
    expect(after.uniqueWords).toBe(1);
    expect(after.entries[0]?.word).toBe('gamma');
  });
});

describe('stopword toggle', () => {
  it('excludes common stopwords when enabled', () => {
    const input = 'the cat and the dog and the bird';
    const withStop = analyzeWords(makeState({ input, excludeStopwords: false }));
    const noStop = analyzeWords(makeState({ input, excludeStopwords: true }));
    expect(withStop.entries.find((e) => e.word === 'the')?.count).toBe(3);
    expect(noStop.entries.find((e) => e.word === 'the')).toBeUndefined();
    expect(noStop.totalWords).toBe(3);
    expect(noStop.uniqueWords).toBe(3);
    // 'and' must be in the stopword list for this expectation
    expect(STOPWORDS.has('and')).toBe(true);
  });

  it('toggles back correctly (stopwords included again)', () => {
    const input = 'the cat sat';
    const off = analyzeWords(makeState({ input, excludeStopwords: false }));
    const on = analyzeWords(makeState({ input, excludeStopwords: true }));
    const restored = analyzeWords(
      makeState({ input, excludeStopwords: on.totalWords === 0 ? false : false })
    );
    expect(on.totalWords).toBe(2);
    expect(off.totalWords).toBe(3);
    expect(restored.totalWords).toBe(3);
  });

  it('stopword filtering respects case-sensitive mode', () => {
    const input = 'The the THE cat';
    const stats = analyzeWords(makeState({ input, excludeStopwords: true, caseSensitive: true }));
    // Only the exact lowercase 'the' matches the stopword list in case-sensitive mode.
    expect(stats.entries.find((e) => e.word === 'the')).toBeUndefined();
    expect(stats.entries.find((e) => e.word === 'The')?.count).toBe(1);
    expect(stats.entries.find((e) => e.word === 'THE')?.count).toBe(1);
    expect(stats.totalWords).toBe(3);
  });
});

describe('sorting modes', () => {
  const entries: WordCount[] = [
    { word: 'banana', count: 2, percentage: 20, firstIndex: 3 },
    { word: 'apple', count: 5, percentage: 50, firstIndex: 0 },
    { word: 'cherry', count: 3, percentage: 30, firstIndex: 1 },
  ];

  it('sorts by count descending with first-appearance tiebreak', () => {
    const sorted = [...entries];
    sortEntries(sorted, 'count');
    expect(sorted.map((e) => e.word)).toEqual(['apple', 'cherry', 'banana']);
  });

  it('sorts alphabetically', () => {
    const sorted = [...entries];
    sortEntries(sorted, 'alphabetical');
    expect(sorted.map((e) => e.word)).toEqual(['apple', 'banana', 'cherry']);
  });

  it('sorts by first appearance', () => {
    const sorted = [...entries].reverse();
    sortEntries(sorted, 'first-appearance');
    expect(sorted.map((e) => e.word)).toEqual(['apple', 'cherry', 'banana']);
  });

  it('analyzeWords applies sortMode from state', () => {
    const stats = analyzeWords(makeState({ input: 'b a a b b', sortMode: 'alphabetical' }));
    expect(stats.entries.map((e) => e.word)).toEqual(['a', 'b']);
  });
});

describe('filtering', () => {
  it('filters entries by substring', () => {
    const stats = analyzeWords(makeState({ input: 'cat catalogue dog category' }));
    const rows = filterEntries(stats.entries, 'cat', false);
    expect(rows.map((e) => e.word).sort()).toEqual(['cat', 'catalogue', 'category']);
  });

  it('empty filter returns all entries', () => {
    const stats = analyzeWords(makeState({ input: 'cat dog' }));
    expect(filterEntries(stats.entries, '', false)).toHaveLength(2);
  });

  it('case-sensitive filter matches exactly', () => {
    const entries: WordCount[] = [
      { word: 'Cat', count: 1, percentage: 50, firstIndex: 0 },
      { word: 'cat', count: 1, percentage: 50, firstIndex: 1 },
    ];
    expect(filterEntries(entries, 'cat', false)).toHaveLength(2);
    expect(filterEntries(entries, 'cat', true)).toHaveLength(1);
    expect(filterEntries(entries, 'cat', true)[0]?.word).toBe('cat');
  });
});

describe('export helpers', () => {
  it('toCsv produces header and data rows with escaped fields', () => {
    const stats = analyzeWords(makeState({ input: 'hello world hello' }));
    const csv = toCsv(stats.entries);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('rank,word,count,percentage');
    expect(lines[1]).toBe('1,hello,2,66.67');
    expect(lines[2]).toBe('2,world,1,33.33');
  });

  it('toCsv escapes commas and quotes in words', () => {
    const csv = toCsv([{ word: 'a"b,c', count: 1, percentage: 100, firstIndex: 0 }]);
    expect(csv.split('\n')[1]).toBe('1,"a""b,c",1,100.00');
  });

  it('toJson contains stats and words with ranks', () => {
    const stats = analyzeWords(makeState({ input: 'hello world hello' }));
    const parsed = JSON.parse(toJson(stats)) as {
      stats: { totalWords: number };
      words: Array<{ rank: number; word: string; count: number }>;
    };
    expect(parsed.stats.totalWords).toBe(3);
    expect(parsed.words[0]).toEqual({ rank: 1, word: 'hello', count: 2, percentage: 66.67 });
    expect(parsed.words[1]?.rank).toBe(2);
  });
});

describe('wordFrequencyTool state contract', () => {
  it('exposes config and initial state', () => {
    expect(wordFrequencyTool.id).toBe('word-frequency-analyzer');
    expect(wordFrequencyTool.name).toBe('Word Frequency Analyzer');
    expect(wordFrequencyTool.initialState.sortMode).toBe('count');
    expect(wordFrequencyTool.version).toBe('1.0.0');
  });

  it('serializes to JSON and round-trips', () => {
    const state = makeState({ input: 'round trip', sortMode: 'alphabetical' });
    const serialized = wordFrequencyTool.serialize(state);
    expect(JSON.parse(serialized)).toEqual(state);
    const result = wordFrequencyTool.deserialize(JSON.parse(serialized));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(state);
  });

  it('rejects invalid payloads', () => {
    expect(wordFrequencyTool.deserialize(null).success).toBe(false);
    expect(wordFrequencyTool.deserialize('string').success).toBe(false);
    expect(wordFrequencyTool.deserialize({ input: 42 }).success).toBe(false);
    expect(wordFrequencyTool.deserialize({ ...baseState, sortMode: 'bogus' }).success).toBe(false);
    expect(wordFrequencyTool.deserialize({ ...baseState, filter: 1 }).success).toBe(false);
    const bad = wordFrequencyTool.deserialize({});
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toContain('Invalid data format');
  });

  it('class wrapper deserializes strings and objects', () => {
    const def = new WordFrequencyToolDefinition();
    const state = makeState({ input: 'wrapped' });
    expect(def.deserialize(JSON.stringify(state))).toEqual({ success: true, data: state });
    expect(def.deserialize(state)).toEqual({ success: true, data: state });
    expect(def.deserialize('not json {').success).toBe(false);
    expect(def.initialState).toEqual(wordFrequencyTool.initialState);
    expect(def.serialize(state)).toBe(wordFrequencyTool.serialize(state));
  });

  it('registers four image exporters', () => {
    expect(wordFrequencyTool.exporters).toHaveLength(4);
    expect(wordFrequencyTool.exporters?.map((e) => e.format)).toEqual([
      'png',
      'jpeg',
      'webp',
      'pdf',
    ]);
  });
});
