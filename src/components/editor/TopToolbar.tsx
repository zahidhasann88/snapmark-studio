'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Copy,
  Download,
  Eraser,
  FileJson,
  FilePlus2,
  FolderOpen,
  Grid,
  HelpCircle,
  ImageMinus,
  ImagePlus,
  Layers,
  Maximize2,
  Moon,
  Redo2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/LogoMark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TopToolbarProps {
  onImportImage: () => void;
  onReplaceImage: () => void;
  onRemoveImage: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onRequestClearProject: () => void;
  onQuickCopy: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
  onOpenPrivacyStorage: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function TopToolbar({
  onImportImage,
  onReplaceImage,
  onRemoveImage,
  onOpenProject,
  onSaveProject,
  onRequestClearProject,
  onQuickCopy,
  onOpenExport,
  onOpenShortcuts,
  onOpenPrivacyStorage,
  isRightPanelOpen,
  onToggleRightPanel,
  isDark,
  onToggleTheme,
}: TopToolbarProps) {
  const projectName = useEditorStore((s) => s.history.present.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const pastCount = useEditorStore((s) => s.history.past.length);
  const futureCount = useEditorStore((s) => s.history.future.length);
  const hasImage = useEditorStore(
    (s) => s.history.present.backgroundAssetId !== null
  );
  const annotationCount = useEditorStore(
    (s) => s.history.present.annotations.length
  );
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const backdrop = useEditorStore((s) => s.backdrop);
  const setBackdrop = useEditorStore((s) => s.setBackdrop);

  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const zoomByFactor = useEditorStore((s) => s.zoomByFactor);
  const zoomToFit = useEditorStore((s) => s.zoomToFit);
  const resetZoom100 = useEditorStore((s) => s.resetZoom100);
  const clearAnnotationsOnly = useEditorStore((s) => s.clearAnnotationsOnly);

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(projectName);

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
    } else {
      setDraftTitle(projectName);
    }
  };

  return (
    <header
      data-testid="top-toolbar"
      className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/"
          aria-label="SnapMark Studio Home"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm font-bold tracking-tight text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogoMark className="h-6 w-6" />
          <span className="hidden lg:inline">SnapMark</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="file-menu-trigger"
              className="gap-1"
            >
              File
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuItem onSelect={onImportImage}>
              <span className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Import Screenshot…
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasImage}
              onSelect={onReplaceImage}
            >
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Replace Background Image…
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasImage}
              onSelect={onRemoveImage}
            >
              <span className="flex items-center gap-2">
                <ImageMinus className="h-4 w-4" />
                Remove Background Image
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenProject}>
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Open .snapmark Project…
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasImage}
              onSelect={onSaveProject}
            >
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Save Project File
              </span>
              <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={annotationCount === 0}
              onSelect={clearAnnotationsOnly}
            >
              <span className="flex items-center gap-2">
                <Eraser className="h-4 w-4" />
                Clear Annotations Only
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasImage && annotationCount === 0}
              onSelect={onRequestClearProject}
              className="text-red-600 focus:text-red-600 dark:text-red-400"
            >
              <span className="flex items-center gap-2">
                <FilePlus2 className="h-4 w-4" />
                New / Reset Project…
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenPrivacyStorage}>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Privacy & Local Storage…
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasImage && (
          <div className="hidden min-w-0 sm:block">
            {editingTitle ? (
              <input
                type="text"
                aria-label="Project name"
                value={draftTitle}
                autoFocus
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle();
                  if (e.key === 'Escape') {
                    setDraftTitle(projectName);
                    setEditingTitle(false);
                  }
                }}
                className="h-7 w-40 rounded border border-ring bg-background px-2 text-xs font-medium text-foreground focus:outline-none"
              />
            ) : (
              <button
                type="button"
                title="Click to rename project"
                onClick={() => {
                  setDraftTitle(projectName);
                  setEditingTitle(true);
                }}
                className="max-w-[160px] truncate rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {projectName}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Undo"
              data-testid="undo-btn"
              disabled={pastCount === 0}
              onClick={undo}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl/Cmd+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Redo"
              data-testid="redo-btn"
              disabled={futureCount === 0}
              onClick={redo}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl/Cmd+Shift+Z)</TooltipContent>
        </Tooltip>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <div className="hidden items-center gap-0.5 sm:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Zoom out"
                data-testid="zoom-out-btn"
                disabled={!hasImage}
                onClick={() => zoomByFactor(1 / 1.2)}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out (Ctrl/Cmd -)</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Zoom options"
                data-testid="zoom-Indicator-btn"
                disabled={!hasImage}
                className="h-8 min-w-[3.75rem] rounded-md px-1.5 font-mono text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45"
              >
                {Math.round(zoom * 100)}%
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              <DropdownMenuItem onSelect={zoomToFit}>
                <span className="flex items-center gap-2">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Fit to Screen
                </span>
                <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={resetZoom100}>
                <span>Actual Size (100%)</span>
                <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  useEditorStore.getState().setViewport({ zoom: 0.5 })
                }
              >
                <span>Zoom to 50%</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  useEditorStore.getState().setViewport({ zoom: 2 })
                }
              >
                <span>Zoom to 200%</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  setBackdrop(
                    backdrop === 'checkerboard'
                      ? 'dark'
                      : backdrop === 'dark'
                        ? 'light'
                        : 'checkerboard'
                  )
                }
              >
                <span className="flex items-center gap-2">
                  <Grid className="h-3.5 w-3.5" />
                  Backdrop: {backdrop}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Zoom in"
                data-testid="zoom-in-btn"
                disabled={!hasImage}
                onClick={() => zoomByFactor(1.2)}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In (Ctrl/Cmd +)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                aria-label="Fit to screen"
                data-testid="zoom-fit-btn"
                disabled={!hasImage}
                onClick={zoomToFit}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to Screen (Ctrl/Cmd+0)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Keyboard shortcuts"
              onClick={onOpenShortcuts}
              className="hidden md:inline-flex"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keyboard Shortcuts (?)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={onToggleTheme}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isRightPanelOpen ? 'secondary' : 'ghost'}
              size="iconSm"
              aria-label="Toggle properties and layers panel"
              aria-expanded={isRightPanelOpen}
              onClick={onToggleRightPanel}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Properties & Layers</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasImage}
              onClick={onSaveProject}
              data-testid="save-project-btn"
              className="hidden lg:inline-flex"
            >
              <FileJson className="h-3.5 w-3.5" />
              Save
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download .snapmark Project (Ctrl/Cmd+S)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasImage}
              onClick={onQuickCopy}
              data-testid="quick-copy-btn"
              className="hidden sm:inline-flex"
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Copy</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy Flattened PNG to Clipboard</TooltipContent>
        </Tooltip>

        <Button
          size="sm"
          disabled={!hasImage}
          onClick={onOpenExport}
          data-testid="open-export-btn"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </header>
  );
}
