'use client';

import React from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { ArrowHeadStyle, FontWeightOption, TextAlignOption } from '@/types/editor';
import { REDACT_COLOR_SWATCHES, TOOL_DEFINITIONS } from '@/tools/tool-definitions';
import { ColorSwatchPicker } from '@/components/ui/color-swatch-picker';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ContextualBar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const styleDefaults = useEditorStore((s) => s.styleDefaults);
  const updateStyleDefaults = useEditorStore((s) => s.updateStyleDefaults);
  const annotations = useEditorStore((s) => s.history.present.annotations);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const hasImage = useEditorStore((s) => s.history.present.backgroundAssetId !== null);

  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelectedAnnotations);
  const deleteSelected = useEditorStore((s) => s.deleteSelectedAnnotations);
  const bringForward = useEditorStore((s) => s.bringForward);
  const sendBackward = useEditorStore((s) => s.sendBackward);
  const toggleLock = useEditorStore((s) => s.toggleLockAnnotation);
  const convertToOpaqueRedaction = useEditorStore((s) => s.convertToOpaqueRedaction);

  if (!hasImage) return null;

  const selectedObjects = annotations.filter((a) => selectedIds.includes(a.id));
  const primary = selectedObjects.length === 1 ? selectedObjects[0]! : null;
  const activeToolDef = TOOL_DEFINITIONS.find((t) => t.id === activeTool);

  const modeType = primary ? primary.type : activeTool;

  const renderShapeStrokeControls = () => {
    const strokeColor =
      primary && 'strokeColor' in primary
        ? primary.strokeColor
        : styleDefaults.strokeColor;
    const strokeWidth =
      primary && 'strokeWidth' in primary
        ? primary.strokeWidth
        : styleDefaults.strokeWidth;

    return (
      <>
        <ColorSwatchPicker
          label="Stroke Color"
          value={strokeColor}
          onChange={(hex) => {
            if (primary) {
              updateAnnotation(primary.id, (prev) =>
                'strokeColor' in prev ? { ...prev, strokeColor: hex } : prev
              );
            } else {
              updateStyleDefaults({ strokeColor: hex });
            }
          }}
        />
        <div className="flex items-center gap-1" role="group" aria-label="Stroke thickness">
          {[2, 3, 5, 8].map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Stroke width ${w}px`}
              onClick={() => {
                if (primary) {
                  updateAnnotation(primary.id, (prev) =>
                    'strokeWidth' in prev ? { ...prev, strokeWidth: w } : prev
                  );
                } else {
                  updateStyleDefaults({ strokeWidth: w });
                }
              }}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded border text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                strokeWidth === w
                  ? 'border-primary bg-primary/10 font-semibold text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent'
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </>
    );
  };

  return (
    <div
      data-testid="contextual-bar"
      className="flex h-11 shrink-0 items-center justify-between gap-2 overflow-x-auto whitespace-nowrap border-b border-border bg-muted/40 px-3 py-1 text-xs"
    >
      {/* Left: Tool / Object Contextual Controls (single row so the canvas never shifts on selection) */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
          {primary
            ? primary.name
            : selectedObjects.length > 1
              ? `${selectedObjects.length} Selected`
              : activeToolDef?.label ?? 'Workspace'}
        </span>

        {/* Rectangle / Ellipse controls */}
        {(modeType === 'rect' || modeType === 'ellipse') && (
          <>
            {renderShapeStrokeControls()}
            <div className="h-4 w-px bg-border" />
            <ColorSwatchPicker
              label="Fill Color"
              value={
                primary && 'fillColor' in primary
                  ? primary.fillColor
                  : styleDefaults.fillColor
              }
              onChange={(hex) => {
                if (primary) {
                  updateAnnotation(primary.id, (prev) =>
                    'fillColor' in prev ? { ...prev, fillColor: hex } : prev
                  );
                } else {
                  updateStyleDefaults({ fillColor: hex });
                }
              }}
            />
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <span>Fill</span>
              <select
                aria-label="Fill opacity"
                value={String(
                  Math.round(
                    ((primary && 'fillOpacity' in primary
                      ? primary.fillOpacity
                      : styleDefaults.fillOpacity) ?? 0) * 100
                  )
                )}
                onChange={(e) => {
                  const val = Number(e.target.value) / 100;
                  if (primary) {
                    updateAnnotation(primary.id, (prev) =>
                      'fillOpacity' in prev ? { ...prev, fillOpacity: val } : prev
                    );
                  } else {
                    updateStyleDefaults({ fillOpacity: val });
                  }
                }}
                className="h-7 rounded border border-border bg-background px-1.5 text-xs text-foreground"
              >
                <option value="0">None (0%)</option>
                <option value="15">15%</option>
                <option value="30">30%</option>
                <option value="60">60%</option>
                <option value="100">Solid (100%)</option>
              </select>
            </label>
          </>
        )}

        {/* Line / Arrow / Pen controls */}
        {(modeType === 'line' || modeType === 'arrow' || modeType === 'pen') && (
          <>
            {renderShapeStrokeControls()}
            {modeType === 'arrow' && (
              <>
                <div className="h-4 w-px bg-border" />
                <label className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Head</span>
                  <select
                    aria-label="Arrowhead style"
                    data-testid="arrowhead-select"
                    value={
                      primary?.type === 'arrow'
                        ? primary.headStyle
                        : styleDefaults.headStyle
                    }
                    onChange={(e) => {
                      const style = e.target.value as ArrowHeadStyle;
                      if (primary?.type === 'arrow') {
                        updateAnnotation(primary.id, (prev) =>
                          prev.type === 'arrow' ? { ...prev, headStyle: style } : prev
                        );
                      } else {
                        updateStyleDefaults({ headStyle: style });
                      }
                    }}
                    className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="filled">Filled Triangle</option>
                    <option value="open">Open Chevron</option>
                    <option value="double">Double Ended</option>
                    <option value="outline">Hollow Outline</option>
                  </select>
                </label>
              </>
            )}
          </>
        )}

        {/* Highlighter controls */}
        {modeType === 'highlighter' && (
          <>
            <ColorSwatchPicker
              label="Highlighter Color"
              value={
                primary?.type === 'highlighter'
                  ? primary.strokeColor
                  : styleDefaults.highlighterColor
              }
              onChange={(hex) => {
                if (primary?.type === 'highlighter') {
                  updateAnnotation(primary.id, (prev) =>
                    prev.type === 'highlighter' ? { ...prev, strokeColor: hex } : prev
                  );
                } else {
                  updateStyleDefaults({ highlighterColor: hex });
                }
              }}
            />
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              Translucent emphasis — not for redacting sensitive text
            </span>
          </>
        )}

        {/* Text Callout controls */}
        {modeType === 'text' && (
          <>
            <ColorSwatchPicker
              label="Text Color"
              value={
                primary?.type === 'text'
                  ? primary.strokeColor
                  : styleDefaults.strokeColor
              }
              onChange={(hex) => {
                if (primary?.type === 'text') {
                  updateAnnotation(primary.id, (prev) =>
                    prev.type === 'text' ? { ...prev, strokeColor: hex } : prev
                  );
                } else {
                  updateStyleDefaults({ strokeColor: hex });
                }
              }}
            />
            <label className="flex items-center gap-1">
              <span className="text-muted-foreground">Size</span>
              <select
                aria-label="Text size"
                value={String(
                  primary?.type === 'text' ? primary.fontSize : styleDefaults.fontSize
                )}
                onChange={(e) => {
                  const sz = Number(e.target.value);
                  if (primary?.type === 'text') {
                    updateAnnotation(primary.id, (prev) =>
                      prev.type === 'text' ? { ...prev, fontSize: sz } : prev
                    );
                  } else {
                    updateStyleDefaults({ fontSize: sz });
                  }
                }}
                className="h-7 rounded border border-border bg-background px-1.5 text-xs"
              >
                {[14, 16, 20, 24, 32, 42].map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="Text weight"
              value={
                primary?.type === 'text'
                  ? primary.fontWeight
                  : styleDefaults.fontWeight
              }
              onChange={(e) => {
                const fw = e.target.value as FontWeightOption;
                if (primary?.type === 'text') {
                  updateAnnotation(primary.id, (prev) =>
                    prev.type === 'text' ? { ...prev, fontWeight: fw } : prev
                  );
                } else {
                  updateStyleDefaults({ fontWeight: fw });
                }
              }}
              className="h-7 rounded border border-border bg-background px-1.5 text-xs"
            >
              <option value="normal">Regular</option>
              <option value="medium">Medium</option>
              <option value="bold">Bold</option>
            </select>
            <div className="flex items-center rounded border border-border bg-background p-0.5">
              {(
                [
                  { id: 'left', icon: AlignLeft },
                  { id: 'center', icon: AlignCenter },
                  { id: 'right', icon: AlignRight },
                ] as const
              ).map(({ id, icon: Icon }) => {
                const currentAlign =
                  primary?.type === 'text'
                    ? primary.textAlign
                    : styleDefaults.textAlign;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Align ${id}`}
                    onClick={() => {
                      const align = id as TextAlignOption;
                      if (primary?.type === 'text') {
                        updateAnnotation(primary.id, (prev) =>
                          prev.type === 'text' ? { ...prev, textAlign: align } : prev
                        );
                      } else {
                        updateStyleDefaults({ textAlign: align });
                      }
                    }}
                    className={cn(
                      'rounded p-1',
                      currentAlign === id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Step Marker controls */}
        {modeType === 'step' && (
          <>
            <ColorSwatchPicker
              label="Badge Color"
              value={
                primary?.type === 'step'
                  ? primary.fillColor
                  : styleDefaults.stepFillColor
              }
              onChange={(hex) => {
                if (primary?.type === 'step') {
                  updateAnnotation(primary.id, (prev) =>
                    prev.type === 'step' ? { ...prev, fillColor: hex } : prev
                  );
                } else {
                  updateStyleDefaults({ stepFillColor: hex });
                }
              }}
            />
            {primary?.type === 'step' && (
              <label className="flex items-center gap-1">
                <span className="text-muted-foreground">Step #</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  aria-label="Step number"
                  value={primary.stepNumber}
                  onChange={(e) => {
                    const num = Math.max(0, Math.min(999, Number(e.target.value) || 0));
                    updateAnnotation(primary.id, (prev) =>
                      prev.type === 'step'
                        ? { ...prev, stepNumber: num, name: `Step #${num}` }
                        : prev
                    );
                  }}
                  className="h-7 w-16 rounded border border-border bg-background px-2 font-mono text-xs"
                />
              </label>
            )}
          </>
        )}

        {/* Blur / Pixelate controls + Decorative Warning + 1-click upgrade to Opaque Redact */}
        {(modeType === 'blur' || modeType === 'pixelate') && (
          <>
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {modeType === 'blur' ? 'Blur Radius' : 'Block Size'}
              </span>
              <input
                type="range"
                min={4}
                max={36}
                aria-label={modeType === 'blur' ? 'Blur intensity' : 'Pixel block size'}
                value={
                  primary?.type === 'blur'
                    ? primary.blurRadius
                    : primary?.type === 'pixelate'
                      ? primary.blockSize
                      : modeType === 'blur'
                        ? styleDefaults.blurRadius
                        : styleDefaults.blockSize
                }
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (primary?.type === 'blur') {
                    updateAnnotation(
                      primary.id,
                      (prev) => (prev.type === 'blur' ? { ...prev, blurRadius: v } : prev),
                      { coalesceKey: `${primary.id}:effect-strength` }
                    );
                  } else if (primary?.type === 'pixelate') {
                    updateAnnotation(
                      primary.id,
                      (prev) => (prev.type === 'pixelate' ? { ...prev, blockSize: v } : prev),
                      { coalesceKey: `${primary.id}:effect-strength` }
                    );
                  } else if (modeType === 'blur') {
                    updateStyleDefaults({ blurRadius: v });
                  } else {
                    updateStyleDefaults({ blockSize: v });
                  }
                }}
                className="w-24 accent-primary"
              />
            </label>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Decorative only — use Opaque Redact for secrets
            </span>
            {primary && (primary.type === 'blur' || primary.type === 'pixelate') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => convertToOpaqueRedaction(primary.id)}
                data-testid="convert-to-redact-btn"
                className="h-7 px-2 text-xs"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-emerald-600" />
                Convert to Opaque Redact
              </Button>
            )}
          </>
        )}

        {/* Opaque Redaction controls */}
        {modeType === 'redact' && (
          <>
            <ColorSwatchPicker
              label="Solid Redaction Color"
              swatches={REDACT_COLOR_SWATCHES}
              value={
                primary?.type === 'redact'
                  ? primary.fillColor
                  : styleDefaults.redactColor
              }
              onChange={(hex) => {
                if (primary?.type === 'redact') {
                  updateAnnotation(primary.id, (prev) =>
                    prev.type === 'redact'
                      ? { ...prev, fillColor: hex, opacity: 1 }
                      : prev
                  );
                } else {
                  updateStyleDefaults({ redactColor: hex });
                }
              }}
            />
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              100% Opaque · Permanently destroys covered pixels on export
            </span>
          </>
        )}
      </div>

      {selectedObjects.length > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Bring forward"
            title="Bring Forward (])"
            onClick={() => bringForward()}
            className="h-7 w-7"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Send backward"
            title="Send Backward ([)"
            onClick={() => sendBackward()}
            className="h-7 w-7"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Duplicate selected"
            data-testid="duplicate-selected-btn"
            title="Duplicate (Ctrl/Cmd+D)"
            onClick={duplicateSelected}
            className="h-7 w-7"
          >
            <CopyPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={primary?.locked ? 'Unlock annotation' : 'Lock annotation'}
            data-testid="lock-selected-btn"
            title="Lock / Unlock (Ctrl/Cmd+Shift+L)"
            onClick={() => toggleLock()}
            className="h-7 w-7"
          >
            {primary?.locked ? (
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label="Delete selected"
            data-testid="delete-selected-btn"
            title="Delete (Del / Backspace)"
            disabled={selectedObjects.every((o) => o.locked)}
            onClick={deleteSelected}
            className="h-7 w-7 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
