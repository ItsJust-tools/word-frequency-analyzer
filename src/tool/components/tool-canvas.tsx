'use client';

import { useCallback } from 'react';
import type { ToolState } from '../types';

interface ToolCanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
}

export function ToolCanvas({ state, onChange, canvasRef }: ToolCanvasProps) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.({ ...state, input: e.target.value });
    },
    [onChange, state]
  );

  return (
    <div
      ref={canvasRef}
      className="wfa-canvas"
      role="application"
      aria-label="Word frequency analyzer canvas"
    >
      <div className="notepad-canvas h-full">
        <textarea
          className="notepad-textarea h-48"
          value={state.input}
          onChange={handleInputChange}
          placeholder="Paste or type your text here..."
          aria-label="Input text"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
