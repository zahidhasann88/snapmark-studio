'use client';

import React from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import type { ImportErrorInfo } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';

interface ImportErrorBannerProps {
  error: ImportErrorInfo;
  onDismiss: () => void;
  onChooseAnotherFile: () => void;
}

export function ImportErrorBanner({
  error,
  onDismiss,
  onChooseAnotherFile,
}: ImportErrorBannerProps) {
  return (
    <div
      role="alert"
      data-testid="import-error-banner"
      className="mx-auto w-full max-w-xl rounded-xl border border-red-500/40 bg-red-950/90 p-4 text-red-50 shadow-xl backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-red-100">{error.title}</h3>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={onDismiss}
              className="rounded p-1 text-red-300 hover:bg-red-900/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-red-200">{error.message}</p>

          {(error.fileName || error.fileSizeBytes !== undefined) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 font-mono text-[11px] text-red-300/90">
              {error.fileName && <span>File: {error.fileName}</span>}
              {error.detectedType && <span>Type: {error.detectedType}</span>}
              {error.fileSizeBytes !== undefined && (
                <span>Size: {formatBytes(error.fileSizeBytes)}</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onChooseAnotherFile}
              className="bg-red-100 text-red-950 hover:bg-white"
            >
              <Upload className="h-3.5 w-3.5" />
              Choose Valid File
            </Button>
            <span className="text-[11px] text-red-300">
              Supported: PNG, JPEG, WebP (up to 50 MB / 12,000 px), or .snapmark.json
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
