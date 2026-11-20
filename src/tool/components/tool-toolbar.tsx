'use client';

import Link from 'next/link';

interface ToolToolbarProps {
  caseSensitive?: boolean;
  onToggleCaseSensitive?: () => void;
}

export function ToolToolbar({ caseSensitive, onToggleCaseSensitive }: ToolToolbarProps) {
  return (
    <div className="notepad-toolbar">
      <label className="toolbar-toggle" title="Match exact letter case when counting words">
        <input
          type="checkbox"
          checked={caseSensitive ?? false}
          onChange={onToggleCaseSensitive}
          aria-label="Case-sensitive counting"
        />
        Case sensitive
      </label>
      <Link href="/help" className="toolbar-btn toolbar-help-link" aria-label="Open help page">
        Help
      </Link>
    </div>
  );
}
