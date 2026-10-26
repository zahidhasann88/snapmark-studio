'use client';

import React from 'react';
import { TOOL_DEFINITIONS } from '@/tools/tool-definitions';
import { useEditorStore } from '@/store/editor-store';
import { ToolIcon } from './ToolIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function LeftToolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const hasImage = useEditorStore(
    (s) => s.history.present.backgroundAssetId !== null
  );

  const navTools = TOOL_DEFINITIONS.filter((t) => t.group === 'navigation');
  const shapeTools = TOOL_DEFINITIONS.filter((t) => t.group === 'shapes');
  const privacyTools = TOOL_DEFINITIONS.filter((t) => t.group === 'privacy');

  const renderGroup = (
    items: typeof navTools,
    groupLabel: string,
    isPrivacy = false
  ) => (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex flex-row items-center gap-1 md:flex-col"
    >
      {items.map((tool) => {
        const isActive = activeTool === tool.id;
        const disabled =
          !hasImage && tool.id !== 'select' && tool.id !== 'pan';

        return (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${tool.label} (${tool.shortcut})`}
                aria-pressed={isActive}
                data-testid={`tool-btn-${tool.id}`}
                disabled={disabled}
                onClick={() => setActiveTool(tool.id)}
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35',
                  isActive
                    ? isPrivacy && tool.id === 'redact'
                      ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-700 dark:bg-white dark:text-slate-950'
                      : 'bg-brand-gradient shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <ToolIcon tool={tool.id} className="h-4 w-4" />
                {tool.id === 'redact' && !isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[230px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{tool.label}</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
                  {tool.shortcut}
                </kbd>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-300">
                {tool.description}
              </p>
              {tool.securityNote && (
                <p
                  className={cn(
                    'mt-1 border-t border-slate-700 pt-1 text-[10px]',
                    tool.securityNote.level === 'verified'
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  )}
                >
                  {tool.securityNote.text}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );

  return (
    <aside
      aria-label="Annotation tools"
      data-testid="left-toolbar"
      className="flex w-full shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-2.5 py-1.5 md:w-14 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r md:px-1.5 md:py-2.5"
    >
      {renderGroup(navTools, 'Navigation tools')}
      <div className="h-5 w-px shrink-0 bg-border md:my-1 md:h-px md:w-7" />
      {renderGroup(shapeTools, 'Annotation shapes')}
      <div className="h-5 w-px shrink-0 bg-border md:my-1 md:h-px md:w-7" />
      {renderGroup(privacyTools, 'Privacy and redaction tools', true)}
    </aside>
  );
}
