import type { ToolConfig } from '@itsjust/core';
import packageJson from '../../package.json';

export const templateBaseVersion = packageJson.version;

const toolConfig = {
  id: 'word-frequency-analyzer',
  name: 'Word Frequency Analyzer',
  description:
    'Paste text and instantly see word frequencies, counts, and percentages with filtering and export.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#6366f1',
    accentHover: '#4f46e5',
    accentSubtle: 'rgba(99, 102, 241, 0.08)',
    brand: 'Word Frequency Analyzer',
    icon: '\u{1F4CA}',
  },
  shortcuts: [
    {
      title: 'Word Frequency Analyzer',
      shortcuts: [
        { keys: 'Ctrl+Shift+E', label: 'Export All', description: 'exports all formats at once' },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
