'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Eye,
  EyeOff,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { ArrowHeadStyle, FontWeightOption, TextAlignOption } from '@/types/editor';
import { ToolIcon } from './ToolIcon';
import { ColorSwatchPicker } from '@/components/ui/color-swatch-picker';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { REDACT_COLOR_SWATCHES } from '@/tools/tool-definitions';
import { cn } from '@/lib/utils';

interface PropertiesPanelProps {
  open: boolean;
  onCloseMobile: () => void;
}

export function PropertiesPanel({ open, onCloseMobile }: PropertiesPanelProps) {
  const annotations = useEditorStore((s) => s.history.present.annotations);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const toggleSelection = useEditorStore((s) => s.toggleSelection);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const toggleLock = useEditorStore((s) => s.toggleLockAnnotation);
  const toggleVisibility = useEditorStore((s) => s.toggleVisibilityAnnotation);
  const bringForward = useEditorStore((s) => s.bringForward);
  const sendBackward = useEditorStore((s) => s.sendBackward);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelectedAnnotations);
  const deleteSelected = useEditorStore((s) => s.deleteSelectedAnnotations);
  const convertToOpaqueRedaction = useEditorStore((s) => s.convertToOpaqueRedaction);

  if (!open) return null;

  const selectedObjects = annotations.filter((a) => selectedIds.includes(a.id));
  const selected = selectedObjects.length === 1 ? selectedObjects[0]! : null;

  const reversedLayers = [...annotations].reverse();

  return (
    <aside
      aria-label="Object properties and layers"
      data-testid="properties-panel"
      className="fixed inset-y-0 right-0 z-30 flex w-72 flex-col border-l border-border bg-card shadow-xl lg:static lg:z-auto lg:shadow-none"
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 lg:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Inspector & Layers
        </span>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onCloseMobile}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto border-b border-border p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Properties
          </h2>
          {selected && (
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-secondary-foreground">
              {selected.type}
            </span>
          )}
        </div>

        {!selected && selectedObjects.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground">
            Select an annotation on the canvas or from the Layers list below to inspect and customize its styling, geometry, or redaction mode.
          </p>
        )}

        {selectedObjects.length > 1 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{selectedObjects.length}</strong> annotations selected.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={duplicateSelected}>
                <CopyPlus className="h-3.5 w-3.5" />
                Duplicate All
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete Unlocked
              </Button>
            </div>
          </div>
        )}

        {selected && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">
                {selected.name}
              </span>
              <Button
                variant={selected.locked ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => toggleLock(selected.id)}
                className="h-7 px-2 text-xs"
              >
                {selected.locked ? (
                  <>
                    <Lock className="h-3 w-3 text-amber-500" />
                    Locked
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3" />
                    Unlocked
                  </>
                )}
              </Button>
            </div>

            {'width' in selected && 'height' in selected && (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">X (px)</span>
                  <input
                    type="number"
                    disabled={selected.locked}
                    aria-label="X position"
                    value={Math.round(selected.x)}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      updateAnnotation(selected.id, (p) =>
                        'x' in p ? { ...p, x: val } : p
                      );
                    }}
                    className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs disabled:opacity-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Y (px)</span>
                  <input
                    type="number"
                    disabled={selected.locked}
                    aria-label="Y position"
                    value={Math.round(selected.y)}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      updateAnnotation(selected.id, (p) =>
                        'y' in p ? { ...p, y: val } : p
                      );
                    }}
                    className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs disabled:opacity-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Width</span>
                  <input
                    type="number"
                    min={8}
                    disabled={selected.locked}
                    aria-label="Width"
                    value={Math.round(selected.width)}
                    onChange={(e) => {
                      const val = Math.max(8, Number(e.target.value) || 8);
                      updateAnnotation(selected.id, (p) =>
                        'width' in p && 'height' in p ? { ...p, width: val } : p
                      );
                    }}
                    className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs disabled:opacity-50"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Height</span>
                  <input
                    type="number"
                    min={8}
                    disabled={selected.locked}
                    aria-label="Height"
                    value={Math.round(selected.height)}
                    onChange={(e) => {
                      const val = Math.max(8, Number(e.target.value) || 8);
                      updateAnnotation(selected.id, (p) =>
                        'height' in p ? { ...p, height: val } : p
                      );
                    }}
                    className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs disabled:opacity-50"
                  />
                </label>
              </div>
            )}

            {/* Stroke Color & Thickness */}
            {'strokeColor' in selected && selected.type !== 'step' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {selected.type === 'text' ? 'Text Color' : 'Stroke Color'}
                  </span>
                  <ColorSwatchPicker
                    label="Stroke Color"
                    value={selected.strokeColor}
                    onChange={(hex) =>
                      updateAnnotation(selected.id, (p) =>
                        'strokeColor' in p ? { ...p, strokeColor: hex } : p
                      )
                    }
                  />
                </div>

                {'strokeWidth' in selected && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Thickness</span>
                      <span className="font-mono text-foreground">
                        {selected.strokeWidth}px
                      </span>
                    </div>
                    <Slider
                      aria-label="Stroke thickness"
                      min={selected.type === 'rect' || selected.type === 'ellipse' ? 0 : 1}
                      max={selected.type === 'highlighter' ? 48 : 20}
                      step={1}
                      value={[selected.strokeWidth]}
                      onValueChange={([val]) => {
                        if (val === undefined) return;
                        updateAnnotation(selected.id, (p) =>
                          'strokeWidth' in p ? { ...p, strokeWidth: val } : p,
                          { coalesceKey: `${selected.id}:stroke-thickness` }
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Fill Color & Fill Opacity */}
            {(selected.type === 'rect' ||
              selected.type === 'ellipse' ||
              selected.type === 'text') && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {selected.type === 'text' ? 'Background Fill' : 'Fill Color'}
                  </span>
                  <ColorSwatchPicker
                    label="Fill Color"
                    value={selected.fillColor}
                    onChange={(hex) =>
                      updateAnnotation(selected.id, (p) =>
                        'fillColor' in p ? { ...p, fillColor: hex } : p
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Fill Opacity</span>
                    <span className="font-mono text-foreground">
                      {Math.round(selected.fillOpacity * 100)}%
                    </span>
                  </div>
                  <Slider
                    aria-label="Fill opacity"
                    min={0}
                    max={100}
                    step={5}
                    value={[Math.round(selected.fillOpacity * 100)]}
                    onValueChange={([val]) => {
                      if (val === undefined) return;
                      updateAnnotation(selected.id, (p) =>
                        'fillOpacity' in p ? { ...p, fillOpacity: val / 100 } : p,
                        { coalesceKey: `${selected.id}:fill-opacity` }
                      );
                    }}
                  />
                </div>
              </div>
            )}

            {/* Corner Radius for Rect */}
            {selected.type === 'rect' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Corner Radius</span>
                  <span className="font-mono text-foreground">
                    {selected.cornerRadius}px
                  </span>
                </div>
                <Slider
                  aria-label="Corner radius"
                  min={0}
                  max={32}
                  step={1}
                  value={[selected.cornerRadius]}
                  onValueChange={([val]) => {
                    if (val === undefined) return;
                    updateAnnotation(selected.id, (p) =>
                      p.type === 'rect' ? { ...p, cornerRadius: val } : p,
                      { coalesceKey: `${selected.id}:corner-radius` }
                    );
                  }}
                />
              </div>
            )}

            {/* Arrowhead Style */}
            {selected.type === 'arrow' && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <label className="block text-[11px] text-muted-foreground">
                  Arrowhead Style
                </label>
                <select
                  aria-label="Inspector arrowhead style"
                  value={selected.headStyle}
                  onChange={(e) => {
                    const style = e.target.value as ArrowHeadStyle;
                    updateAnnotation(selected.id, (p) =>
                      p.type === 'arrow' ? { ...p, headStyle: style } : p
                    );
                  }}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs"
                >
                  <option value="filled">Filled Triangle</option>
                  <option value="open">Open Chevron</option>
                  <option value="double">Double-Ended</option>
                  <option value="outline">Hollow Outline</option>
                </select>
              </div>
            )}

            {/* Text Content & Typography */}
            {selected.type === 'text' && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <label className="block space-y-1">
                  <span className="text-[11px] text-muted-foreground">Text Content</span>
                  <textarea
                    rows={3}
                    disabled={selected.locked}
                    aria-label="Annotation text content"
                    value={selected.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      const short =
                        val.trim().length > 22
                          ? `${val.trim().slice(0, 22)}…`
                          : val.trim() || 'Text';
                      updateAnnotation(selected.id, (p) =>
                        p.type === 'text'
                          ? { ...p, text: val, name: `Text: "${short}"` }
                          : p
                      );
                    }}
                    className="w-full rounded border border-border bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Size (px)</span>
                    <input
                      type="number"
                      min={10}
                      max={120}
                      aria-label="Font size"
                      value={selected.fontSize}
                      onChange={(e) => {
                        const sz = Math.max(10, Math.min(120, Number(e.target.value) || 16));
                        updateAnnotation(selected.id, (p) =>
                          p.type === 'text' ? { ...p, fontSize: sz } : p
                        );
                      }}
                      className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Weight</span>
                    <select
                      aria-label="Font weight"
                      value={selected.fontWeight}
                      onChange={(e) => {
                        const w = e.target.value as FontWeightOption;
                        updateAnnotation(selected.id, (p) =>
                          p.type === 'text' ? { ...p, fontWeight: w } : p
                        );
                      }}
                      className="h-7 w-full rounded border border-border bg-background px-1.5 text-xs"
                    >
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="bold">Bold</option>
                    </select>
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] text-muted-foreground">Alignment</span>
                  <select
                    aria-label="Text alignment"
                    value={selected.textAlign}
                    onChange={(e) => {
                      const align = e.target.value as TextAlignOption;
                      updateAnnotation(selected.id, (p) =>
                        p.type === 'text' ? { ...p, textAlign: align } : p
                      );
                    }}
                    className="h-7 w-full rounded border border-border bg-background px-1.5 text-xs"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
            )}

            {/* Step Marker Controls */}
            {selected.type === 'step' && (
              <div className="space-y-2.5 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Badge Color</span>
                  <ColorSwatchPicker
                    label="Step Badge Color"
                    value={selected.fillColor}
                    onChange={(hex) =>
                      updateAnnotation(selected.id, (p) =>
                        p.type === 'step' ? { ...p, fillColor: hex } : p
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Number</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      aria-label="Step badge number"
                      value={selected.stepNumber}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(999, Number(e.target.value) || 0));
                        updateAnnotation(selected.id, (p) =>
                          p.type === 'step'
                            ? { ...p, stepNumber: n, name: `Step #${n}` }
                            : p
                        );
                      }}
                      className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Radius</span>
                    <input
                      type="number"
                      min={10}
                      max={64}
                      aria-label="Step badge radius"
                      value={Math.round(selected.radius)}
                      onChange={(e) => {
                        const r = Math.max(10, Math.min(64, Number(e.target.value) || 16));
                        updateAnnotation(selected.id, (p) =>
                          p.type === 'step' ? { ...p, radius: r } : p
                        );
                      }}
                      className="h-7 w-full rounded border border-border bg-background px-2 font-mono text-xs"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Blur & Pixelate Controls + Clear Security Advisory */}
            {(selected.type === 'blur' || selected.type === 'pixelate') && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {selected.type === 'blur' ? 'Blur Intensity' : 'Mosaic Block Size'}
                    </span>
                    <span className="font-mono text-foreground">
                      {selected.type === 'blur' ? selected.blurRadius : selected.blockSize}px
                    </span>
                  </div>
                  <Slider
                    aria-label={selected.type === 'blur' ? 'Blur radius' : 'Block size'}
                    min={4}
                    max={40}
                    step={1}
                    value={[
                      selected.type === 'blur' ? selected.blurRadius : selected.blockSize,
                    ]}
                    onValueChange={([val]) => {
                      if (val === undefined) return;
                      updateAnnotation(selected.id, (p) => {
                        if (p.type === 'blur') return { ...p, blurRadius: val };
                        if (p.type === 'pixelate') return { ...p, blockSize: val };
                        return p;
                      },
                        { coalesceKey: `${selected.id}:effect-strength` }
                      );
                    }}
                  />
                </div>

                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                  <p className="font-semibold">Decorative Obfuscation Only</p>
                  <p className="mt-0.5">
                    Blur and mosaic effects can sometimes be reversed via deconvolution. Never rely on blur for passwords, keys, or PII.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => convertToOpaqueRedaction(selected.id)}
                    className="mt-2 w-full text-xs"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-emerald-600" />
                    Upgrade to Opaque Redact
                  </Button>
                </div>
              </div>
            )}

            {selected.type === 'redact' && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Redaction Fill</span>
                  <ColorSwatchPicker
                    label="Opaque Redaction Color"
                    swatches={REDACT_COLOR_SWATCHES}
                    value={selected.fillColor}
                    onChange={(hex) =>
                      updateAnnotation(selected.id, (p) =>
                        p.type === 'redact' ? { ...p, fillColor: hex, opacity: 1 } : p
                      )
                    }
                  />
                </div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    Permanent Pixel Destruction
                  </div>
                  <p className="mt-1">
                    Opacity is locked to <strong>100%</strong>. On export, covered image pixels are cleared and overwritten in a flattened bitmap.
                  </p>
                </div>
              </div>
            )}

            {'opacity' in selected &&
              selected.type !== 'redact' &&
              selected.type !== 'highlighter' && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Layer Opacity</span>
                    <span className="font-mono text-foreground">
                      {Math.round(selected.opacity * 100)}%
                    </span>
                  </div>
                  <Slider
                    aria-label="Annotation opacity"
                    min={15}
                    max={100}
                    step={5}
                    value={[Math.round(selected.opacity * 100)]}
                    onValueChange={([val]) => {
                      if (val === undefined) return;
                      updateAnnotation(selected.id, (p) =>
                        'opacity' in p && p.type !== 'redact'
                          ? { ...p, opacity: val / 100 }
                          : p,
                        { coalesceKey: `${selected.id}:annotation-opacity` }
                      );
                    }}
                  />
                </div>
              )}
          </div>
        )}
      </div>

      <div className="flex h-64 shrink-0 flex-col">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Layers ({annotations.length})
          </h2>
          {selected && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label="Move layer up"
                title="Bring Forward"
                onClick={() => bringForward(selected.id)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move layer down"
                title="Send Backward"
                onClick={() => sendBackward(selected.id)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div
          role="list"
          aria-label="Annotation layers"
          data-testid="layers-list"
          className="flex-1 overflow-y-auto p-1.5"
        >
          {reversedLayers.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No annotations yet
            </div>
          ) : (
            reversedLayers.map((ann) => {
              const isSelected = selectedIds.includes(ann.id);
              return (
                <div
                  key={ann.id}
                  role="listitem"
                  data-testid={`layer-item-${ann.type}`}
                  onClick={(e) => {
                    setActiveTool('select');
                    if (e.shiftKey) {
                      toggleSelection(ann.id);
                    } else {
                      setSelectedIds([ann.id]);
                    }
                  }}
                  className={cn(
                    'group flex cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors',
                    isSelected
                      ? 'bg-primary/12 text-foreground ring-1 ring-primary/35'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    !ann.visible && 'opacity-55'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <ToolIcon tool={ann.type} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-medium">{ann.name}</span>
                    {!ann.visible && (
                      <span className="shrink-0 text-[10px] italic text-muted-foreground">
                        (hidden)
                      </span>
                    )}
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={ann.locked ? `Unlock ${ann.name}` : `Lock ${ann.name}`}
                      onClick={() => toggleLock(ann.id)}
                      className="rounded p-1 hover:bg-background"
                    >
                      {ann.locked ? (
                        <Lock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Unlock className="h-3 w-3 opacity-45 group-hover:opacity-100" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={ann.visible ? `Hide ${ann.name}` : `Show ${ann.name}`}
                      onClick={() => toggleVisibility(ann.id)}
                      className="rounded p-1 hover:bg-background"
                    >
                      {ann.visible ? (
                        <Eye className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
