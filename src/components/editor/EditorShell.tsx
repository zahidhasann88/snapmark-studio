'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Point } from '@/types/editor';
import { useFileImporter } from '@/import/useFileImporter';
import { loadImageAssetFromDataUrl } from '@/import/image-loader';
import {
  downloadProjectFile,
  serializeProjectToJson,
} from '@/serialization/project-io';
import {
  isLocalAutosaveEnabled,
  loadLocalRecoveryDraft,
  saveLocalRecoveryDraft,
} from '@/serialization/optional-autosave';
import { copyFlattenedImageToClipboard } from '@/export/export-service';
import { useEditorShortcuts } from '@/shortcuts/useEditorShortcuts';
import {
  CanvasWorkspace,
  type CanvasWorkspaceHandle,
} from '@/canvas/CanvasWorkspace';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastRegion } from '@/components/ui/toast-region';
import { TopToolbar } from './TopToolbar';
import { ContextualBar } from './ContextualBar';
import { LeftToolbar } from './LeftToolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { StatusBar } from './StatusBar';
import { ExportDialog } from './ExportDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { PrivacyStorageDialog } from './PrivacyStorageDialog';

export function EditorShell() {
  const workspaceRef = useRef<CanvasWorkspaceHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);

  const [cursorCoords, setCursorCoords] = useState<Point | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'reset' | 'remove-bg' | null>(
    null
  );
  const [isDark, setIsDark] = useState(false);

  const { importFile, importSampleScreenshot } = useFileImporter();

  const projectName = useEditorStore((s) => s.history.present.projectName);
  const backgroundAssetId = useEditorStore(
    (s) => s.history.present.backgroundAssetId
  );
  const annotations = useEditorStore((s) => s.history.present.annotations);
  const isDirty = useEditorStore((s) => s.isDirty);
  const getBackgroundAsset = useEditorStore((s) => s.getBackgroundAsset);
  const resetProject = useEditorStore((s) => s.resetProject);
  const removeBackgroundImage = useEditorStore((s) => s.removeBackgroundImage);
  const markClean = useEditorStore((s) => s.markClean);
  const addToast = useEditorStore((s) => s.addToast);
  const loadOpenedProject = useEditorStore((s) => s.loadOpenedProject);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 1024) {
        setRightPanelOpen(false);
      }
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, []);

  useEffect(() => {
    if (backgroundAssetId) return;
    if (!isLocalAutosaveEnabled()) return;

    const draft = loadLocalRecoveryDraft();
    if (!draft || !draft.ok) return;

    void (async () => {
      const imgRes = await loadImageAssetFromDataUrl({
        dataUrl: draft.project.image.dataUrl,
        name: draft.project.image.name,
        mimeType: draft.project.image.mimeType,
      });
      if (imgRes.ok) {
        loadOpenedProject({
          projectName: draft.project.projectName,
          asset: imgRes.asset,
          annotations: draft.project.annotations,
        });
        addToast({
          variant: 'default',
          title: 'Restored Local Recovery Draft',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLocalAutosaveEnabled()) return;
    const asset = getBackgroundAsset();
    if (!asset) return;
    try {
      const json = serializeProjectToJson({
        projectName,
        image: asset,
        annotations,
      });
      saveLocalRecoveryDraft(json);
    } catch {
      // ignore
    }
  }, [annotations, backgroundAssetId, getBackgroundAsset, projectName]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && (backgroundAssetId || annotations.length > 0)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [annotations.length, backgroundAssetId, isDirty]);

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const handleSaveProject = useCallback(() => {
    const asset = getBackgroundAsset();
    if (!asset) {
      addToast({
        variant: 'warning',
        title: 'Nothing to Save',
        description: 'Import or paste a screenshot before saving a project file.',
      });
      return;
    }
    try {
      const savedName = downloadProjectFile({
        projectName,
        image: asset,
        annotations,
      });
      markClean();
      addToast({
        variant: 'success',
        title: 'Project Saved',
        description: `Downloaded ${savedName}`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Failed to Save Project',
        description: err instanceof Error ? err.message : 'Serialization error',
      });
    }
  }, [addToast, annotations, getBackgroundAsset, markClean, projectName]);

  const handleQuickCopy = useCallback(async () => {
    const asset = getBackgroundAsset();
    if (!asset) return;
    try {
      const res = await copyFlattenedImageToClipboard({
        image: asset,
        annotations,
        scale: 1,
      });
      addToast({
        variant: 'success',
        title: 'Copied to Clipboard',
        description: `${res.width} × ${res.height} px flattened PNG copied.`,
      });
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Clipboard Copy Unavailable',
        description:
          err instanceof Error
            ? err.message
            : 'Use Export -> Download PNG in this browser.',
      });
    }
  }, [addToast, annotations, getBackgroundAsset]);

  const handleRequestClearProject = () => {
    if (isDirty || backgroundAssetId || annotations.length > 0) {
      setConfirmMode('reset');
    } else {
      resetProject();
    }
  };

  const handleRequestRemoveBg = () => {
    if (annotations.length > 0 || isDirty) {
      setConfirmMode('remove-bg');
    } else {
      removeBackgroundImage();
    }
  };

  useEditorShortcuts({
    onSaveProject: handleSaveProject,
    onOpenExport: () => {
      if (getBackgroundAsset()) setExportOpen(true);
    },
    onOpenShortcutsHelp: () => setShortcutsOpen(true),
    onCancelCanvasGesture: () =>
      workspaceRef.current?.cancelInteraction() ?? false,
    onSpaceChange: (pressed) =>
      workspaceRef.current?.setSpacePressed(pressed),
    onPasteImageFile: (file) => {
      void importFile(file);
    },
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div
        data-testid="editor-shell"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground"
      >
        {/* Hidden Accessible File Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          data-testid="file-input-image"
          accept="image/png,image/jpeg,image/webp,.snapmark,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          data-testid="file-input-replace"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file, { keepAnnotations: true });
            e.target.value = '';
          }}
        />
        <input
          ref={projectInputRef}
          type="file"
          data-testid="file-input-project"
          accept=".snapmark,.json,application/json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file, { expectProject: true });
            e.target.value = '';
          }}
        />

        {/* Top Application Toolbar */}
        <TopToolbar
          onImportImage={() => imageInputRef.current?.click()}
          onReplaceImage={() => replaceInputRef.current?.click()}
          onRemoveImage={handleRequestRemoveBg}
          onOpenProject={() => projectInputRef.current?.click()}
          onSaveProject={handleSaveProject}
          onRequestClearProject={handleRequestClearProject}
          onQuickCopy={() => void handleQuickCopy()}
          onOpenExport={() => setExportOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenPrivacyStorage={() => setPrivacyOpen(true)}
          isRightPanelOpen={rightPanelOpen}
          onToggleRightPanel={() => setRightPanelOpen((v) => !v)}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
        />

        {/* Contextual Style & Privacy Sub-Toolbar */}
        <ContextualBar />

        {/* Central Studio Body */}
        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <LeftToolbar />

          <CanvasWorkspace
            ref={workspaceRef}
            onDropFile={(file) => void importFile(file)}
            onTriggerUpload={() => imageInputRef.current?.click()}
            onTriggerOpenProject={() => projectInputRef.current?.click()}
            onLoadSample={() => void importSampleScreenshot()}
            onCursorChange={setCursorCoords}
          />

          <PropertiesPanel
            open={rightPanelOpen}
            onCloseMobile={() => setRightPanelOpen(false)}
          />
        </div>

        {/* Bottom Status Bar */}
        <StatusBar cursorCoords={cursorCoords} />

        {/* Modals & Notifications */}
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

        <ConfirmDialog
          open={confirmMode !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmMode(null);
          }}
          title={
            confirmMode === 'remove-bg'
              ? 'Remove Background Screenshot?'
              : 'Clear Unsaved Project?'
          }
          description={
            confirmMode === 'remove-bg'
              ? 'Removing the background image will leave your canvas empty. You can undo this action or save a .snapmark project file first.'
              : 'Clearing the project will discard your current screenshot and annotations from memory. Would you like to save a .snapmark project file first?'
          }
          confirmLabel={
            confirmMode === 'remove-bg'
              ? 'Remove Background'
              : 'Discard & Reset'
          }
          onSaveFirst={backgroundAssetId ? handleSaveProject : undefined}
          onConfirm={() => {
            if (confirmMode === 'remove-bg') {
              removeBackgroundImage();
            } else {
              resetProject();
            }
          }}
        />

        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <PrivacyStorageDialog open={privacyOpen} onOpenChange={setPrivacyOpen} />
        <ToastRegion />
      </div>
    </TooltipProvider>
  );
}
