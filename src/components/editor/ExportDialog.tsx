'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ShieldCheck,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import type { ExportFormat, ExportScale } from '@/types/editor';
import {
  computeExportDimensions,
  validateExportScaleBounds,
} from '@/export/flatten-renderer';
import {
  copyFlattenedImageToClipboard,
  generateFlattenedExportBlob,
  isClipboardImageWriteSupported,
  triggerBlobDownload,
} from '@/export/export-service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { sanitizeFileName } from '@/lib/utils';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCALES: readonly ExportScale[] = [0.5, 1, 2, 3];

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const projectName = useEditorStore((s) => s.history.present.projectName);
  const annotations = useEditorStore((s) => s.history.present.annotations);
  const getBackgroundAsset = useEditorStore((s) => s.getBackgroundAsset);
  const addToast = useEditorStore((s) => s.addToast);

  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState<ExportScale>(1);
  const [bgFillEnabled, setBgFillEnabled] = useState(false);
  const [bgFillColor, setBgFillColor] = useState('#ffffff');
  const [fileName, setFileName] = useState(projectName);
  const [busy, setBusy] = useState(false);
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  const image = open ? getBackgroundAsset() : null;

  useEffect(() => {
    if (open) {
      setFileName(sanitizeFileName(projectName, 'annotated-screenshot'));
      setCopiedJustNow(false);
    }
  }, [open, projectName]);

  if (!image) return null;

  const dims = computeExportDimensions(image.width, image.height, scale);
  const scaleError = validateExportScaleBounds(image.width, image.height, scale);

  const visibleCount = annotations.filter((a) => a.visible).length;
  const hiddenCount = annotations.length - visibleCount;
  const redactCount = annotations.filter(
    (a) => a.visible && a.type === 'redact'
  ).length;
  const blurOrPixelateCount = annotations.filter(
    (a) => a.visible && (a.type === 'blur' || a.type === 'pixelate')
  ).length;

  const clipboardSupported = isClipboardImageWriteSupported();

  const handleDownload = async () => {
    if (scaleError) return;
    setBusy(true);
    try {
      const result = await generateFlattenedExportBlob({
        image,
        annotations,
        options: {
          format,
          quality,
          scale,
          backgroundFillEnabled: format === 'jpeg' ? true : bgFillEnabled,
          backgroundFillColor: bgFillColor,
          fileName,
        },
      });
      triggerBlobDownload(result.blob, result.fileName);
      addToast({
        variant: 'success',
        title: `Exported ${result.fileName}`,
        description: `${result.width} × ${result.height} px flattened ${format.toUpperCase()}`,
      });
      onOpenChange(false);
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Unable to export image.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    setBusy(true);
    try {
      const targetScale = scale === 2 ? 2 : 1;
      const res = await copyFlattenedImageToClipboard({
        image,
        annotations,
        scale: targetScale,
        backgroundFillEnabled: bgFillEnabled,
        backgroundFillColor: bgFillColor,
      });
      setCopiedJustNow(true);
      addToast({
        variant: 'success',
        title: 'Copied to Clipboard',
        description: `${res.width} × ${res.height} px flattened PNG ready to paste.`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Clipboard Copy Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Clipboard write permission denied by browser.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="export-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Flattened Image</DialogTitle>
          <DialogDescription>
            Renders the screenshot and visible annotations into a single clean bitmap with zero recoverable hidden layers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* File Name */}
          <div className="space-y-1.5">
            <label htmlFor="export-filename" className="font-medium text-foreground">
              Filename
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="export-filename"
                data-testid="export-filename-input"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="rounded-md bg-muted px-2.5 py-2 font-mono text-xs text-muted-foreground">
                .{format === 'jpeg' ? 'jpg' : 'png'}
              </span>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-1.5">
            <span className="font-medium text-foreground">Format</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="export-format-png"
                onClick={() => setFormat('png')}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  format === 'png'
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                <div className="font-semibold text-foreground">PNG (Lossless)</div>
                <div className="text-[11px]">Crisp UI text & alpha transparency</div>
              </button>
              <button
                type="button"
                data-testid="export-format-jpeg"
                onClick={() => setFormat('jpeg')}
                className={`rounded-lg border p-2.5 text-left transition-colors ${
                  format === 'jpeg'
                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/30'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                <div className="font-semibold text-foreground">JPEG</div>
                <div className="text-[11px]">Smaller file size, solid background</div>
              </button>
            </div>
          </div>

          {/* JPEG Quality */}
          {format === 'jpeg' && (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="font-medium text-foreground">JPEG Quality</span>
                <span className="font-mono text-foreground">
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <Slider
                aria-label="JPEG quality"
                min={20}
                max={100}
                step={2}
                value={[Math.round(quality * 100)]}
                onValueChange={([v]) => {
                  if (v !== undefined) setQuality(v / 100);
                }}
              />
            </div>
          )}

          {/* Output Scale */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Output Scale</span>
              <span
                data-testid="export-computed-dimensions"
                className="font-mono text-muted-foreground"
              >
                {dims.width.toLocaleString()} × {dims.height.toLocaleString()} px
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`export-scale-${s}x`}
                  onClick={() => setScale(s)}
                  className={`h-8 rounded-md border font-mono text-xs font-medium transition-colors ${
                    scale === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            {scaleError && (
              <p className="text-[11px] text-red-500">{scaleError}</p>
            )}
          </div>

          {/* Background Fill for Transparent PNGs / JPEG */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-2.5">
            <div className="space-y-0.5 pr-3">
              <div className="font-medium text-foreground">
                Solid Background Fill
              </div>
              <div className="text-[11px] text-muted-foreground">
                {format === 'jpeg'
                  ? 'Required for JPEG (no alpha channel)'
                  : image.hasTransparency
                    ? 'Fill transparent areas instead of keeping alpha'
                    : 'Optional matte fill behind image'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(format === 'jpeg' || bgFillEnabled) && (
                <input
                  type="color"
                  aria-label="Export background fill color"
                  value={bgFillColor}
                  onChange={(e) => setBgFillColor(e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
              )}
              <Switch
                aria-label="Enable solid background fill"
                data-testid="export-bg-fill-switch"
                checked={format === 'jpeg' ? true : bgFillEnabled}
                disabled={format === 'jpeg'}
                onCheckedChange={setBgFillEnabled}
              />
            </div>
          </div>

          {/* Redaction & Layer Flattening Notice */}
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-[11px]">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>
                Flattening {visibleCount} visible annotation{visibleCount === 1 ? '' : 's'}
                {hiddenCount > 0 ? ` (${hiddenCount} hidden excluded)` : ''}
              </span>
            </div>
            {redactCount > 0 && (
              <p className="text-emerald-700 dark:text-emerald-300">
                • {redactCount} Opaque Redaction region{redactCount === 1 ? '' : 's'} will permanently overwrite covered pixels at 100% opacity.
              </p>
            )}
            {blurOrPixelateCount > 0 && (
              <p className="flex items-start gap-1 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {blurOrPixelateCount} decorative Blur/Pixelate region{blurOrPixelateCount === 1 ? '' : 's'} present. Use Opaque Redact for sensitive credentials.
                </span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            disabled={busy || !clipboardSupported || Boolean(scaleError)}
            onClick={handleCopy}
            data-testid="export-copy-btn"
          >
            {copiedJustNow ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                Copied PNG
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy PNG
              </>
            )}
          </Button>
          <Button
            disabled={busy || Boolean(scaleError)}
            onClick={handleDownload}
            data-testid="export-download-btn"
          >
            <Download className="h-4 w-4" />
            Download {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
