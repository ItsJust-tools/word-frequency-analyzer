'use client';

import { useMemo, useState } from 'react';
import type { ToolState, SortMode, WordCount } from '../types';
import { analyzeWords, filterEntries, toCsv, toJson } from '../tool-definition';

interface ToolSidebarProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
}

const SORT_LABELS: Record<SortMode, string> = {
  count: 'Count',
  alphabetical: 'Alphabetical',
  'first-appearance': 'First appearance',
};

export function ToolSidebar({ state, onChange }: ToolSidebarProps) {
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const stats = useMemo(() => analyzeWords(state), [state]);
  const rows = useMemo(
    () => filterEntries(stats.entries, state.filter, state.caseSensitive),
    [stats.entries, state.filter, state.caseSensitive]
  );

  const update = (patch: Partial<ToolState>) => onChange({ ...state, ...patch });

  const copyExport = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setExportMessage(`${label} copied to clipboard`);
    } catch {
      setExportMessage(`Failed to copy ${label}`);
    }
    window.setTimeout(() => setExportMessage(null), 2500);
  };

  return (
    <div className="notepad-sidebar wfa-sidebar">
      <div className="sidebar-section">
        <h3>Summary</h3>
        <dl className="stats-list">
          <div className="stat-row">
            <dt>Total words</dt>
            <dd>{stats.totalWords.toLocaleString()}</dd>
          </div>
          <div className="stat-row">
            <dt>Unique words</dt>
            <dd>{stats.uniqueWords.toLocaleString()}</dd>
          </div>
          <div className="stat-row">
            <dt>Average word length</dt>
            <dd>{stats.averageWordLength.toFixed(2)}</dd>
          </div>
        </dl>
      </div>

      <div className="sidebar-section">
        <h3>Options</h3>
        <div className="wfa-option">
          <label>
            <input
              type="checkbox"
              checked={state.excludeStopwords}
              onChange={(e) => update({ excludeStopwords: e.target.checked })}
              aria-label="Exclude stopwords"
            />
            Exclude stopwords
          </label>
        </div>
        <div className="wfa-option">
          <label>
            <input
              type="checkbox"
              checked={state.caseSensitive}
              onChange={(e) => update({ caseSensitive: e.target.checked })}
              aria-label="Case sensitive"
            />
            Case sensitive
          </label>
        </div>
        <div className="wfa-option">
          <label>
            <input
              type="checkbox"
              checked={state.normalizeAccents}
              onChange={(e) => update({ normalizeAccents: e.target.checked })}
              aria-label="Normalize accents"
            />
            Normalize accents
          </label>
        </div>
        <div className="wfa-option">
          <label htmlFor="wfa-sort">Sort by</label>
          <select
            id="wfa-sort"
            value={state.sortMode}
            onChange={(e) => update({ sortMode: e.target.value as SortMode })}
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
        </div>
        <div className="wfa-option">
          <label htmlFor="wfa-filter">Filter</label>
          <input
            id="wfa-filter"
            type="text"
            value={state.filter}
            onChange={(e) => update({ filter: e.target.value })}
            placeholder="Search words..."
            aria-label="Filter words"
          />
        </div>
      </div>

      <div className="sidebar-section">
        <div className="flex items-center justify-between mb-1">
          <h3>Words ({rows.length})</h3>
        </div>
        <table className="wfa-table" aria-label="Word frequency results">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Word</th>
              <th scope="col">Count</th>
              <th scope="col">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry: WordCount, index: number) => (
              <tr key={`${entry.word}-${entry.firstIndex}`}>
                <td>{index + 1}</td>
                <td>{entry.word}</td>
                <td>{entry.count}</td>
                <td>{entry.percentage.toFixed(1)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>No words match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="sidebar-section">
        <h3>Export</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => copyExport(toCsv([...rows]), 'CSV')}
            aria-label="Copy results as CSV"
          >
            Copy CSV
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => copyExport(toJson({ ...stats, entries: [...rows] }), 'JSON')}
            aria-label="Copy results as JSON"
          >
            Copy JSON
          </button>
        </div>
        {exportMessage && (
          <p className="wfa-export-message" role="status" aria-live="polite">
            {exportMessage}
          </p>
        )}
      </div>
    </div>
  );
}
