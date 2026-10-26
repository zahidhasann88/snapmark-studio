'use client';

import React from 'react';
import {
  ClipboardPaste,
  FileJson,
  ImagePlus,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyWorkspaceProps {
  onTriggerUpload: () => void;
  onTriggerOpenProject: () => void;
  onLoadSample: () => void;
}

export function EmptyWorkspace({
  onTriggerUpload,
  onTriggerOpenProject,
  onLoadSample,
}: EmptyWorkspaceProps) {
  return (
    <div
      data-testid="editor-empty-state"
      className="mx-auto flex w-full max-w-xl flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-card/95 p-8 text-center shadow-sm dark:border-slate-700"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UploadCloud className="h-6 w-6" />
      </div>

      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        Drop, Paste, or Upload a Screenshot
      </h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Press{' '}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
          Ctrl/Cmd + V
        </kbd>{' '}
        to paste directly from your clipboard, drag an image anywhere onto this workspace, or pick a file from your device.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Button onClick={onTriggerUpload} data-testid="empty-upload-btn">
          <ImagePlus className="h-4 w-4" />
          Upload Screenshot
        </Button>
        <Button
          variant="outline"
          onClick={onLoadSample}
          data-testid="empty-sample-btn"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          Try Sample Screenshot
        </Button>
        <Button
          variant="ghost"
          onClick={onTriggerOpenProject}
          data-testid="empty-open-project-btn"
        >
          <FileJson className="h-4 w-4" />
          Open .snapmark Project
        </Button>
      </div>

      <div className="mt-6 grid w-full grid-cols-1 gap-2.5 border-t border-border pt-5 text-left text-xs text-muted-foreground sm:grid-cols-3">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
          <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="font-medium text-foreground">Instant Paste</div>
            <div>Ctrl/Cmd+V from OS screenshot tools</div>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
          <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="font-medium text-foreground">PNG, JPEG, WebP</div>
            <div>Preserves dimensions & transparency</div>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="font-medium text-foreground">100% Client-Side</div>
            <div>Zero server uploads or external APIs</div>
          </div>
        </div>
      </div>
    </div>
  );
}
