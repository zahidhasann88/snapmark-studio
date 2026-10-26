'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { TextAnnotation, ViewportState } from '@/types/editor';
import { hexToRgba } from '@/lib/utils';

interface InlineTextEditorProps {
  annotation: TextAnnotation;
  viewport: ViewportState;
  onCommit: (nextText: string) => void;
  onCancel: () => void;
}

export function InlineTextEditor({
  annotation,
  viewport,
  onCommit,
  onCancel,
}: InlineTextEditorProps) {
  const [value, setValue] = useState(annotation.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const committedRef = useRef(false);
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    mountedAtRef.current = Date.now();
    const rafId = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  const left = viewport.panX + annotation.x * viewport.zoom;
  const top = viewport.panY + annotation.y * viewport.zoom;
  const scaledWidth = Math.max(80, annotation.width * viewport.zoom);
  const scaledFontSize = Math.max(10, annotation.fontSize * viewport.zoom);
  const pad = 8 * viewport.zoom;

  const commitOnce = (textToSave: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(textToSave);
  };

  return (
    <div
      className="pointer-events-auto absolute z-30"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${scaledWidth}px`,
      }}
    >
      <textarea
        ref={textareaRef}
        aria-label="Edit text annotation"
        data-testid="inline-text-editor"
        value={value}
        rows={Math.max(2, value.split('\n').length)}
        placeholder="Type annotation text…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            committedRef.current = true;
            onCancel();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commitOnce(value);
          }
        }}
        onBlur={() => {
          if (Date.now() - mountedAtRef.current < 160) {
            requestAnimationFrame(() => textareaRef.current?.focus());
            return;
          }
          commitOnce(value);
        }}
        className="w-full resize-none rounded-md outline-none ring-2 ring-violet-500 shadow-lg"
        style={{
          fontSize: `${scaledFontSize}px`,
          lineHeight: 1.32,
          padding: `${pad}px`,
          fontWeight:
            annotation.fontWeight === 'bold'
              ? 700
              : annotation.fontWeight === 'medium'
                ? 600
                : 400,
          textAlign: annotation.textAlign,
          color: annotation.strokeColor,
          backgroundColor:
            annotation.fillOpacity > 0
              ? hexToRgba(annotation.fillColor, Math.max(0.85, annotation.fillOpacity))
              : 'rgba(15, 23, 42, 0.88)',
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      />
      <div className="mt-1 flex items-center justify-between rounded bg-slate-900/90 px-2 py-0.5 text-[11px] text-slate-200 shadow">
        <span>Ctrl/Cmd+Enter to finish · Esc to cancel</span>
      </div>
    </div>
  );
}
