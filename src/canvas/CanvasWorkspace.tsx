'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { Point, TextAnnotation } from '@/types/editor';
import { KonvaCanvasEngine } from './konva-engine';
import type { CanvasEngineAdapter } from './canvas-adapter';
import { InlineTextEditor } from './InlineTextEditor';
import { EmptyWorkspace } from '@/components/editor/EmptyWorkspace';
import { ImportErrorBanner } from '@/components/editor/ImportErrorBanner';

export interface CanvasWorkspaceHandle {
  cancelInteraction: () => boolean;
  setSpacePressed: (pressed: boolean) => void;
}

interface CanvasWorkspaceProps {
  onDropFile: (file: File) => void;
  onTriggerUpload: () => void;
  onTriggerOpenProject: () => void;
  onLoadSample: () => void;
  onCursorChange: (coords: Point | null) => void;
}

export const CanvasWorkspace = forwardRef<CanvasWorkspaceHandle, CanvasWorkspaceProps>(
  function CanvasWorkspace(
    {
      onDropFile,
      onTriggerUpload,
      onTriggerOpenProject,
      onLoadSample,
      onCursorChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const stageMountRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<CanvasEngineAdapter | null>(null);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const backgroundAssetId = useEditorStore(
      (s) => s.history.present.backgroundAssetId
    );
    const annotations = useEditorStore((s) => s.history.present.annotations);
    const selectedIds = useEditorStore((s) => s.selectedIds);
    const editingTextId = useEditorStore((s) => s.editingTextId);
    const activeTool = useEditorStore((s) => s.activeTool);
    const styleDefaults = useEditorStore((s) => s.styleDefaults);
    const viewport = useEditorStore((s) => s.viewport);
    const backdrop = useEditorStore((s) => s.backdrop);
    const importError = useEditorStore((s) => s.importError);
    const loadingProgress = useEditorStore((s) => s.loadingProgress);

    const getBackgroundAsset = useEditorStore((s) => s.getBackgroundAsset);
    const setContainerSize = useEditorStore((s) => s.setContainerSize);
    const setImportError = useEditorStore((s) => s.setImportError);
    const setEditingTextId = useEditorStore((s) => s.setEditingTextId);
    const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
    const deleteAnnotationById = useEditorStore((s) => s.deleteAnnotationById);
    const setActiveTool = useEditorStore((s) => s.setActiveTool);

    const image = backgroundAssetId ? getBackgroundAsset() : null;

    useImperativeHandle(ref, () => ({
      cancelInteraction: () => engineRef.current?.cancelActiveInteraction() ?? false,
      setSpacePressed: (pressed: boolean) =>
        engineRef.current?.setSpacePressed(pressed),
    }));

    useEffect(() => {
      const mountEl = stageMountRef.current;
      if (!mountEl) return;

      const engine = new KonvaCanvasEngine({
        onSelectIds: (ids) => {
          useEditorStore.getState().setSelectedIds(ids);
        },
        onCreateAnnotation: (ann, autoEditText) => {
          const store = useEditorStore.getState();
          store.addAnnotation(ann, true);

          if (autoEditText && ann.type === 'text') {
            store.setEditingTextId(ann.id);
            return;
          }

          if (
            ann.type !== 'step' &&
            ann.type !== 'pen' &&
            ann.type !== 'highlighter'
          ) {
            store.setActiveTool('select');
          }
        },
        onCommitAnnotationsChange: (updates) => {
          const store = useEditorStore.getState();
          if (updates.length === 0) return;
          const map = new Map(updates.map((u) => [u.id, u.transform]));
          store.updateAnnotationsBatch(
            updates.map((u) => u.id),
            (prev) => {
              const fn = map.get(prev.id);
              return fn ? fn(prev) : prev;
            }
          );
        },
        onRequestEditText: (id) => {
          useEditorStore.getState().setEditingTextId(id);
        },
        onViewportChange: (vp) => {
          useEditorStore.getState().setViewport(vp);
        },
        onZoomAtPoint: (factor, sx, sy) => {
          useEditorStore.getState().zoomByFactor(factor, sx, sy);
        },
        onCursorCoordsChange: (coords) => {
          onCursorChange(coords);
        },
        onSwitchToSelectTool: () => {
          useEditorStore.getState().setActiveTool('select');
        },
      });

      engine.mount(mountEl);
      engineRef.current = engine;

      return () => {
        engine.destroy();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const applySize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w > 0 && h > 0) {
          setContainerSize(w, h);
          engineRef.current?.resize(w, h);
        }
      };

      applySize();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(applySize);
        observer.observe(el);
        return () => observer.disconnect();
      }
      window.addEventListener('resize', applySize);
      return () => window.removeEventListener('resize', applySize);
    }, [setContainerSize]);

    useEffect(() => {
      const nextStepNumber = useEditorStore.getState().getNextStepNumber();
      engineRef.current?.sync({
        image,
        annotations,
        selectedIds,
        editingTextId,
        activeTool,
        styleDefaults,
        viewport,
        backdrop,
        nextStepNumber,
      });
    }, [
      image,
      annotations,
      selectedIds,
      editingTextId,
      activeTool,
      styleDefaults,
      viewport,
      backdrop,
    ]);

    const editingTextAnnotation = editingTextId
      ? (annotations.find(
          (a): a is TextAnnotation => a.id === editingTextId && a.type === 'text'
        ) ?? null)
      : null;

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDraggingOver) setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        onDropFile(file);
      }
    };

    return (
      <div
        ref={containerRef}
        data-testid="canvas-workspace"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative flex-1 overflow-hidden bg-slate-200/80 dark:bg-slate-950 select-none"
      >
        <div
          ref={stageMountRef}
          data-testid="konva-stage-container"
          className="absolute inset-0"
        />

        {editingTextAnnotation && (
          <InlineTextEditor
            key={editingTextAnnotation.id}
            annotation={editingTextAnnotation}
            viewport={viewport}
            onCommit={(nextText) => {
              const trimmed = nextText.trim();
              if (trimmed.length === 0) {
                deleteAnnotationById(editingTextAnnotation.id);
              } else {
                const shortLabel =
                  trimmed.length > 22 ? `${trimmed.slice(0, 22)}…` : trimmed;
                updateAnnotation(editingTextAnnotation.id, (prev) =>
                  prev.type === 'text'
                    ? {
                        ...prev,
                        text: nextText,
                        name: `Text: "${shortLabel}"`,
                      }
                    : prev
                );
              }
              setEditingTextId(null);
              setActiveTool('select');
            }}
            onCancel={() => {
              if (!editingTextAnnotation.text.trim()) {
                deleteAnnotationById(editingTextAnnotation.id);
              }
              setEditingTextId(null);
              setActiveTool('select');
            }}
          />
        )}

        {!image && !loadingProgress.active && (
          <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 overflow-y-auto p-4 sm:p-8">
            {importError && (
              <ImportErrorBanner
                error={importError}
                onDismiss={() => setImportError(null)}
                onChooseAnotherFile={onTriggerUpload}
              />
            )}
            <EmptyWorkspace
              onTriggerUpload={onTriggerUpload}
              onTriggerOpenProject={onTriggerOpenProject}
              onLoadSample={onLoadSample}
            />
          </div>
        )}


        {image && importError && (
          <div className="pointer-events-auto absolute left-1/2 top-4 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
            <ImportErrorBanner
              error={importError}
              onDismiss={() => setImportError(null)}
              onChooseAnotherFile={onTriggerUpload}
            />
          </div>
        )}

        {loadingProgress.active && (
          <div
            role="status"
            aria-live="polite"
            data-testid="loading-progress-overlay"
            className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 backdrop-blur-[2px]"
          >
            <div className="w-72 rounded-xl border border-border bg-card p-5 text-center shadow-xl">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <div className="mt-2.5 text-sm font-medium text-foreground">
                {loadingProgress.label || 'Processing image…'}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-brand-gradient transition-all duration-150"
                  style={{ width: `${loadingProgress.percent}%` }}
                />
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {loadingProgress.percent}%
              </div>
            </div>
          </div>
        )}

        {/* Drag-and-Drop Visual Dropzone Overlay */}
        {isDraggingOver && (
          <div
            data-testid="dropzone-overlay"
            className="pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px]"
          >
            <div className="flex flex-col items-center rounded-xl bg-card/95 px-6 py-4 text-center shadow-lg">
              <UploadCloud className="h-8 w-8 text-primary" />
              <p className="mt-2 text-sm font-semibold text-foreground">
                Drop Screenshot or .snapmark Project to Open
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP · Processed 100% locally in your browser
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);
