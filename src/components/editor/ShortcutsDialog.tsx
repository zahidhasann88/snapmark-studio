'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUT_SECTIONS = [
  {
    title: 'General & File',
    items: [
      { keys: 'Ctrl / Cmd + V', action: 'Paste screenshot from clipboard' },
      { keys: 'Ctrl / Cmd + S', action: 'Download .snapmark project file' },
      { keys: 'Ctrl / Cmd + Shift + E', action: 'Open Export dialog' },
      { keys: 'Ctrl / Cmd + Z', action: 'Undo' },
      { keys: 'Ctrl / Cmd + Shift + Z', action: 'Redo' },
      { keys: 'Escape', action: 'Cancel drawing / deselect' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { keys: 'V / H', action: 'Select & Move / Pan Workspace' },
      { keys: 'A / L', action: 'Arrow / Straight Line (Shift snaps 45°)' },
      { keys: 'R / O', action: 'Rectangle / Ellipse (Shift for 1:1)' },
      { keys: 'P / M', action: 'Freehand Pen / Highlighter' },
      { keys: 'T / N', action: 'Text Callout / Step Marker' },
      { keys: 'B / X / K', action: 'Blur / Pixelate / Opaque Redact' },
    ],
  },
  {
    title: 'Selection & View',
    items: [
      { keys: 'Delete / Backspace', action: 'Delete selected unlocked objects' },
      { keys: 'Ctrl / Cmd + D', action: 'Duplicate selected objects' },
      { keys: 'Ctrl / Cmd + A', action: 'Select all unlocked annotations' },
      { keys: '] / [', action: 'Bring forward / Send backward' },
      { keys: 'Space + Drag', action: 'Pan canvas from any tool' },
      { keys: 'Ctrl / Cmd + 0 / 1', action: 'Fit to screen / Actual size 100%' },
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="shortcuts-dialog" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Fast single-key tool switching and standard editing shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-y-auto pr-1 text-xs sm:grid-cols-2">
          {SHORTCUT_SECTIONS.map((sec) => (
            <div key={sec.title} className="space-y-2 rounded-lg border border-border p-3">
              <h3 className="font-semibold text-foreground">{sec.title}</h3>
              <div className="space-y-1.5">
                {sec.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-muted-foreground">{item.action}</span>
                    <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
