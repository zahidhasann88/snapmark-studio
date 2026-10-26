'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { ToolType } from '@/types/editor';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  if (target.closest('[role="dialog"]')) return true;
  return false;
}

function isKeyboardInteractiveControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  const role = target.getAttribute('role');
  if (tag === 'button' || tag === 'a' || tag === 'summary' || role === 'button') {
    try {
      return target.matches(':focus-visible');
    } catch {
      return false;
    }
  }
  return (
    role === 'slider' ||
    role === 'switch' ||
    role === 'checkbox' ||
    role === 'radio' ||
    role === 'tab' ||
    role === 'menuitem' ||
    role === 'option'
  );
}

const NATIVE_CONTROL_KEYS = new Set([
  ' ',
  'Enter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

const SINGLE_KEY_TOOLS: Record<string, ToolType> = {
  v: 'select',
  h: 'pan',
  a: 'arrow',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  p: 'pen',
  m: 'highlighter',
  t: 'text',
  n: 'step',
  b: 'blur',
  x: 'pixelate',
  k: 'redact',
};

interface UseEditorShortcutsParams {
  onSaveProject: () => void;
  onOpenExport: () => void;
  onOpenShortcutsHelp: () => void;
  onCancelCanvasGesture: () => boolean;
  onSpaceChange: (pressed: boolean) => void;
  onPasteImageFile: (file: File) => void;
}

export function useEditorShortcuts({
  onSaveProject,
  onOpenExport,
  onOpenShortcutsHelp,
  onCancelCanvasGesture,
  onSpaceChange,
  onPasteImageFile,
}: UseEditorShortcutsParams) {
  useEffect(() => {
    const handlePaste = (evt: ClipboardEvent) => {
      const items = evt.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            evt.preventDefault();
            const ext = item.type.split('/')[1] || 'png';
            const namedFile = new File([blob], blob.name || `clipboard-paste.${ext}`, {
              type: item.type,
            });
            onPasteImageFile(namedFile);
            return;
          }
        }
      }

      const files = evt.clipboardData?.files;
      if (files && files.length > 0 && !isEditableElement(evt.target)) {
        const first = files[0];
        if (first) {
          evt.preventDefault();
          onPasteImageFile(first);
        }
      }
    };

    const handleKeyDown = (evt: KeyboardEvent) => {
      if (isEditableElement(evt.target)) return;
      if (
        isKeyboardInteractiveControl(evt.target) &&
        NATIVE_CONTROL_KEYS.has(evt.key) &&
        !evt.metaKey &&
        !evt.ctrlKey
      ) {
        return;
      }

      const store = useEditorStore.getState();
      const mod = evt.metaKey || evt.ctrlKey;
      const keyLower = evt.key.toLowerCase();

      if (evt.code === 'Space' && !mod) {
        evt.preventDefault();
        onSpaceChange(true);
        return;
      }

      if (mod && keyLower === 'z') {
        evt.preventDefault();
        if (evt.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
        return;
      }

      if (mod && keyLower === 'y') {
        evt.preventDefault();
        store.redo();
        return;
      }

      // Save Project (Ctrl/Cmd + S)
      if (mod && !evt.shiftKey && keyLower === 's') {
        evt.preventDefault();
        onSaveProject();
        return;
      }

      // Export Modal (Ctrl/Cmd + Shift + E)
      if (mod && evt.shiftKey && keyLower === 'e') {
        evt.preventDefault();
        onOpenExport();
        return;
      }

      // Duplicate (Ctrl/Cmd + D)
      if (mod && !evt.shiftKey && keyLower === 'd') {
        if (store.selectedIds.length > 0) {
          evt.preventDefault();
          store.duplicateSelectedAnnotations();
        }
        return;
      }

      // Select all annotations (Ctrl/Cmd + A)
      if (mod && !evt.shiftKey && keyLower === 'a') {
        if (store.getBackgroundAsset()) {
          evt.preventDefault();
          store.selectAllAnnotations();
        }
        return;
      }

      // Lock / Unlock selected (Ctrl/Cmd + Shift + L)
      if (mod && evt.shiftKey && keyLower === 'l') {
        if (store.selectedIds.length > 0) {
          evt.preventDefault();
          store.toggleLockAnnotation();
        }
        return;
      }

      // Zoom shortcuts
      if (mod && (evt.key === '=' || evt.key === '+')) {
        evt.preventDefault();
        store.zoomByFactor(1.2);
        return;
      }
      if (mod && evt.key === '-') {
        evt.preventDefault();
        store.zoomByFactor(1 / 1.2);
        return;
      }
      if (mod && evt.key === '0') {
        evt.preventDefault();
        store.zoomToFit();
        return;
      }
      if (mod && evt.key === '1') {
        evt.preventDefault();
        store.resetZoom100();
        return;
      }

      // Layer ordering shortcuts
      if (evt.key === ']' && store.selectedIds.length > 0) {
        evt.preventDefault();
        if (mod) store.bringToFront();
        else store.bringForward();
        return;
      }
      if (evt.key === '[' && store.selectedIds.length > 0) {
        evt.preventDefault();
        if (mod) store.sendToBack();
        else store.sendBackward();
        return;
      }

      if (mod || evt.altKey) return;

      // Escape: cancel gesture -> clear selection -> switch to select
      if (evt.key === 'Escape') {
        evt.preventDefault();
        const cancelled = onCancelCanvasGesture();
        if (cancelled) return;
        if (store.editingTextId) {
          store.setEditingTextId(null);
          return;
        }
        if (store.selectedIds.length > 0) {
          store.clearSelection();
          return;
        }
        if (store.activeTool !== 'select') {
          store.setActiveTool('select');
        }
        return;
      }

      // Delete / Backspace
      if (evt.key === 'Delete' || evt.key === 'Backspace') {
        if (store.selectedIds.length > 0) {
          evt.preventDefault();
          store.deleteSelectedAnnotations();
        }
        return;
      }

      // Arrow key nudging
      if (
        store.selectedIds.length > 0 &&
        (evt.key === 'ArrowUp' ||
          evt.key === 'ArrowDown' ||
          evt.key === 'ArrowLeft' ||
          evt.key === 'ArrowRight')
      ) {
        evt.preventDefault();
        const step = evt.shiftKey ? 10 : 1;
        if (evt.key === 'ArrowUp') store.nudgeSelectedAnnotations(0, -step);
        if (evt.key === 'ArrowDown') store.nudgeSelectedAnnotations(0, step);
        if (evt.key === 'ArrowLeft') store.nudgeSelectedAnnotations(-step, 0);
        if (evt.key === 'ArrowRight') store.nudgeSelectedAnnotations(step, 0);
        return;
      }

      // Shortcuts help (?)
      if (evt.key === '?') {
        evt.preventDefault();
        onOpenShortcutsHelp();
        return;
      }

      // Single-letter tool switching
      const mappedTool = SINGLE_KEY_TOOLS[keyLower];
      if (mappedTool) {
        evt.preventDefault();
        store.setActiveTool(mappedTool);
      }
    };

    const handleKeyUp = (evt: KeyboardEvent) => {
      if (evt.code === 'Space') {
        onSpaceChange(false);
      }
    };

    const handleWindowBlur = () => {
      onSpaceChange(false);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    onCancelCanvasGesture,
    onOpenExport,
    onOpenShortcutsHelp,
    onPasteImageFile,
    onSaveProject,
    onSpaceChange,
  ]);
}
