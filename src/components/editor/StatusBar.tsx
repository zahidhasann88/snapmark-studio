'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { Point } from '@/types/editor';
import { getAnnotationBounds } from '@/lib/geometry';

export function StatusBar({ cursorCoords }: { cursorCoords: Point | null }) {
  const backgroundAssetId = useEditorStore(
    (s) => s.history.present.backgroundAssetId
  );
  const getBackgroundAsset = useEditorStore((s) => s.getBackgroundAsset);
  const annotations = useEditorStore((s) => s.history.present.annotations);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const zoom = useEditorStore((s) => s.viewport.zoom);

  const image = backgroundAssetId ? getBackgroundAsset() : null;
  const selectedObjects = annotations.filter((a) => selectedIds.includes(a.id));
  const redactCount = annotations.filter(
    (a) => a.visible && a.type === 'redact'
  ).length;

  const singleBounds =
    selectedObjects.length === 1
      ? getAnnotationBounds(selectedObjects[0]!)
      : null;

  return (
    <footer
      aria-label="Editor status bar"
      data-testid="status-bar"
      className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-3 text-[11px] text-muted-foreground"
    >
      <div className="flex min-w-0 items-center gap-3">
        {image ? (
          <span data-testid="status-dimensions" className="font-mono">
            {image.width} × {image.height} px ·{' '}
            {image.mimeType.replace('image/', '').toUpperCase()}
            {image.hasTransparency ? ' (Alpha)' : ''}
          </span>
        ) : (
          <span>No image loaded</span>
        )}

        {cursorCoords && image && (
          <span className="hidden font-mono sm:inline">
            X: {cursorCoords.x}, Y: {cursorCoords.y}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {redactCount > 0 && (
          <span className="hidden items-center gap-1 text-emerald-600 dark:text-emerald-400 md:inline-flex">
            <ShieldCheck className="h-3 w-3" />
            {redactCount} opaque redaction{redactCount === 1 ? '' : 's'}
          </span>
        )}

        <span data-testid="status-selection" className="truncate font-mono">
          {selectedObjects.length === 1 && singleBounds
            ? `Selected: ${selectedObjects[0]!.name} (${Math.round(singleBounds.width)} × ${Math.round(singleBounds.height)} px)`
            : selectedObjects.length > 1
              ? `${selectedObjects.length} annotations selected`
              : `${annotations.length} object${annotations.length === 1 ? '' : 's'}`}
        </span>

        <span data-testid="status-zoom" className="font-mono font-medium text-foreground">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </footer>
  );
}
