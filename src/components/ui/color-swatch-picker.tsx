'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { COLOR_SWATCHES } from '@/tools/tool-definitions';
import { cn } from '@/lib/utils';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  swatches?: readonly string[];
  allowTransparentHint?: boolean;
}

export function ColorSwatchPicker({
  value,
  onChange,
  label,
  swatches = COLOR_SWATCHES,
}: ColorSwatchPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="h-4 w-4 rounded-sm border border-slate-400/60 shadow-inner"
            style={{ backgroundColor: value }}
          />
          <span className="hidden font-mono uppercase sm:inline">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-foreground">{label}</div>
          <div className="grid grid-cols-5 gap-1.5">
            {swatches.map((hex) => {
              const selected = value.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={`Select color ${hex}`}
                  onClick={() => onChange(hex)}
                  className={cn(
                    'h-7 w-full rounded-md border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary ring-2 ring-primary/40'
                      : 'border-slate-300 dark:border-slate-700'
                  )}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <label className="text-xs text-muted-foreground" htmlFor={`hex-${label}`}>
              Custom
            </label>
            <input
              id={`hex-${label}`}
              type="color"
              aria-label={`Custom ${label}`}
              value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ef4444'}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {value}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
