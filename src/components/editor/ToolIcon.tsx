import React from 'react';
import {
  MousePointer2,
  Hand,
  MoveUpRight,
  Square,
  Circle,
  Minus,
  Pencil,
  Highlighter,
  Type,
  Hash,
  Droplets,
  Grid2x2,
  ShieldAlert,
} from 'lucide-react';
import type { ToolType } from '@/types/editor';

export function ToolIcon({
  tool,
  className = 'h-4 w-4',
}: {
  tool: ToolType;
  className?: string;
}) {
  switch (tool) {
    case 'select':
      return <MousePointer2 className={className} />;
    case 'pan':
      return <Hand className={className} />;
    case 'arrow':
      return <MoveUpRight className={className} />;
    case 'rect':
      return <Square className={className} />;
    case 'ellipse':
      return <Circle className={className} />;
    case 'line':
      return <Minus className={className} />;
    case 'pen':
      return <Pencil className={className} />;
    case 'highlighter':
      return <Highlighter className={className} />;
    case 'text':
      return <Type className={className} />;
    case 'step':
      return <Hash className={className} />;
    case 'blur':
      return <Droplets className={className} />;
    case 'pixelate':
      return <Grid2x2 className={className} />;
    case 'redact':
      return <ShieldAlert className={className} />;
  }
}
