export type SortMode = 'count' | 'alphabetical' | 'first-appearance';

export interface WordCount {
  /** Display form of the word (normalized unless case-sensitive). */
  word: string;
  /** Number of occurrences. */
  count: number;
  /** Percentage of total words (stopwords excluded when applicable). */
  percentage: number;
  /** Zero-based index of the first appearance in the token list. */
  firstIndex: number;
}

export interface ToolState {
  /** Raw input text. */
  input: string;
  /** Whether counting is case-sensitive. */
  caseSensitive: boolean;
  /** Whether common English stopwords are excluded from the results. */
  excludeStopwords: boolean;
  /** Whether accented characters are normalized (é -> e). */
  normalizeAccents: boolean;
  /** Current sort mode for the results table. */
  sortMode: SortMode;
  /** Filter box value applied to the results. */
  filter: string;
}

export interface WordStats {
  /** Total number of counted words (after stopword filtering). */
  totalWords: number;
  /** Number of unique words in the counted set. */
  uniqueWords: number;
  /** Average word length over the counted set. */
  averageWordLength: number;
  /** Frequency rows sorted per state.sortMode. */
  entries: WordCount[];
}
