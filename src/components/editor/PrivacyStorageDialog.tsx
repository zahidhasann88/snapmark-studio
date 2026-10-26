'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Trash2 } from 'lucide-react';
import {
  clearAllLocalSavedData,
  hasLocalRecoveryDraft,
  isLocalAutosaveEnabled,
  setLocalAutosaveEnabled,
} from '@/serialization/optional-autosave';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/editor-store';

export function PrivacyStorageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [autosave, setAutosave] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const addToast = useEditorStore((s) => s.addToast);

  useEffect(() => {
    if (open) {
      setAutosave(isLocalAutosaveEnabled());
      setHasDraft(hasLocalRecoveryDraft());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="privacy-storage-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Privacy & Local Browser Storage
          </DialogTitle>
          <DialogDescription>
            SnapMark processes screenshots strictly inside your browser tab with zero server uploads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs leading-relaxed">
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <div className="font-semibold text-foreground">In-Memory by Default</div>
            <p className="text-muted-foreground">
              By default, your active screenshot and annotations live solely in volatile browser memory and are cleared as soon as you close or refresh the tab.
            </p>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="space-y-1">
              <div className="font-semibold text-foreground">
                Optional Local Recovery Draft
              </div>
              <p className="text-muted-foreground">
                Save the active project in local browser storage so you can recover from accidental tab refreshes.
              </p>
            </div>
            <Switch
              aria-label="Enable optional local browser autosave"
              checked={autosave}
              onCheckedChange={(checked) => {
                setLocalAutosaveEnabled(checked);
                setAutosave(checked);
                setHasDraft(hasLocalRecoveryDraft());
                addToast({
                  variant: 'default',
                  title: checked
                    ? 'Local Recovery Autosave Enabled'
                    : 'Local Recovery Autosave Disabled',
                });
              }}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong>Security Note:</strong> Browser local storage is <em>not</em> encrypted storage. Keep local autosave turned off when redacting sensitive credentials on shared machines.
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={!autosave && !hasDraft}
            onClick={() => {
              clearAllLocalSavedData();
              setAutosave(false);
              setHasDraft(false);
              addToast({
                variant: 'success',
                title: 'Local Browser Data Cleared',
              });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Reset & Clear Local Storage
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
