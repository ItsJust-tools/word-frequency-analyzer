import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig, { templateBaseVersion } from './tool.config';
import type { ToolState, SortMode, WordStats, WordCount } from './types';

export type { ToolState, SortMode, WordStats, WordCount };

export { templateBaseVersion };

const SORT_MODES: SortMode[] = ['count', 'alphabetical', 'first-appearance'];

export const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'he',
  'her',
  'his',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'not',
  'of',
  'on',
  'or',
  'our',
  'she',
  'so',
  'that',
  'the',
  'their',
  'there',
  'they',
  'this',
  'to',
  'was',
  'we',
  'were',
  'what',
  'when',
  'which',
  'who',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

/** Normalize accents (é -> e, ü -> u) using NFD decomposition. */
export function stripAccents(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Tokenize text: strip punctuation, lowercase when not case-sensitive.
 * Numbers are kept as tokens.
 */
export function tokenize(
  text: string,
  state: Pick<ToolState, 'caseSensitive' | 'normalizeAccents'>
): string[] {
  const normalized = (text ?? '')
    // separate punctuation/symbols from words, but keep hyphens and apostrophes
    .replace(/[^\p{L}\p{N}'-]/gu, (ch) => (ch === "'" || ch === '\u2019' ? "'" : ' '));
  let tokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  if (state.normalizeAccents) tokens = tokens.map(stripAccents);
  if (!state.caseSensitive) tokens = tokens.map((t) => t.toLowerCase());
  return tokens;
}

/**
 * Count word frequencies and compute stats.
 * Stopwords are excluded when state.excludeStopwords is true.
 */
export function analyzeWords(state: ToolState): WordStats {
  const tokens = tokenize(state.input, state);
  const filtered = state.excludeStopwords
    ? tokens.filter((t) => !STOPWORDS.has(state.caseSensitive ? t : t.toLowerCase()))
    : tokens;

  const counts = new Map<string, { count: number; firstIndex: number }>();
  filtered.forEach((token, index) => {
    const existing = counts.get(token);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(token, { count: 1, firstIndex: index });
    }
  });

  const totalWords = filtered.length;
  const totalLength = filtered.reduce((sum, t) => sum + t.length, 0);

  const entries: WordCount[] = Array.from(counts.entries()).map(([word, info]) => ({
    word,
    count: info.count,
    percentage: totalWords === 0 ? 0 : (info.count / totalWords) * 100,
    firstIndex: info.firstIndex,
  }));

  sortEntries(entries, state.sortMode);

  return {
    totalWords,
    uniqueWords: counts.size,
    averageWordLength: totalWords === 0 ? 0 : totalLength / totalWords,
    entries,
  };
}

export function sortEntries(entries: WordCount[], mode: SortMode): void {
  switch (mode) {
    case 'alphabetical':
      entries.sort((a, b) => a.word.localeCompare(b.word) || a.firstIndex - b.firstIndex);
      break;
    case 'first-appearance':
      entries.sort((a, b) => a.firstIndex - b.firstIndex);
      break;
    case 'count':
    default:
      entries.sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex);
      break;
  }
}

/** Compute a stable rank (1-based, ties share count order after sorting). */
export function rankEntries(entries: WordCount[]): WordCount[] {
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function filterEntries(
  entries: WordCount[],
  filter: string,
  caseSensitive: boolean
): WordCount[] {
  const query = caseSensitive ? filter : filter.toLowerCase();
  if (!query) return entries;
  return entries.filter((e) => (caseSensitive ? e.word : e.word.toLowerCase()).includes(query));
}

/** Export stats to CSV (rank,word,count,percentage). */
export function toCsv(entries: WordCount[]): string {
  const rows = entries.map(
    (e, i) => `${i + 1},${escapeCsvField(e.word)},${e.count},${e.percentage.toFixed(2)}`
  );
  return ['rank,word,count,percentage', ...rows].join('\n');
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Export stats to JSON. */
export function toJson(stats: WordStats): string {
  return JSON.stringify(
    {
      stats: {
        totalWords: stats.totalWords,
        uniqueWords: stats.uniqueWords,
        averageWordLength: Number(stats.averageWordLength.toFixed(2)),
      },
      words: stats.entries.map((e, i) => ({
        rank: i + 1,
        word: e.word,
        count: e.count,
        percentage: Number(e.percentage.toFixed(2)),
      })),
    },
    null,
    2
  );
}

function isSortMode(value: unknown): value is SortMode {
  return typeof value === 'string' && (SORT_MODES as string[]).includes(value);
}

function isToolState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    typeof v.input === 'string' &&
    typeof v.caseSensitive === 'boolean' &&
    typeof v.excludeStopwords === 'boolean' &&
    typeof v.normalizeAccents === 'boolean' &&
    isSortMode(v.sortMode) &&
    typeof v.filter === 'string'
  );
}

const DEFAULT_STATE: ToolState = {
  input: 'The quick brown fox jumps over the lazy dog. The dog barks and the fox runs.',
  caseSensitive: false,
  excludeStopwords: false,
  normalizeAccents: true,
  sortMode: 'count',
  filter: '',
};

export const wordFrequencyTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: DEFAULT_STATE,
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ToolState> => {
    try {
      if (isToolState(data)) {
        return { success: true, data };
      }
      return {
        success: false,
        error: 'Invalid data format: expected valid word frequency analyzer state',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

// Back-compat class-based wrapper for tests.
export class WordFrequencyToolDefinition {
  initialState: ToolState = wordFrequencyTool.initialState;

  serialize(state: ToolState): string {
    return wordFrequencyTool.serialize(state);
  }

  deserialize(serialized: unknown): DeserializeResult<ToolState> {
    try {
      const parsed: unknown = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      return wordFrequencyTool.deserialize(parsed);
    } catch {
      return {
        success: false,
        error: 'Invalid data format: expected valid word frequency analyzer state',
      };
    }
  }
}
