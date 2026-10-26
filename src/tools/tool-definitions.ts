import type { ToolStyleDefaults, ToolType } from '@/types/editor';

export interface ToolDefinition {
  id: ToolType;
  label: string;
  shortcut: string;
  group: 'navigation' | 'shapes' | 'privacy';
  description: string;
  securityNote?: {
    level: 'info' | 'caution' | 'verified';
    text: string;
  };
}

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    id: 'select',
    label: 'Select & Move',
    shortcut: 'V',
    group: 'navigation',
    description: 'Select, move, resize, or marquee-select annotations',
  },
  {
    id: 'pan',
    label: 'Pan Workspace',
    shortcut: 'H',
    group: 'navigation',
    description: 'Drag to pan canvas (or hold Space + drag anytime)',
  },
  {
    id: 'arrow',
    label: 'Arrow',
    shortcut: 'A',
    group: 'shapes',
    description: 'Draw directional callout arrows (hold Shift to snap 45°)',
  },
  {
    id: 'rect',
    label: 'Rectangle',
    shortcut: 'R',
    group: 'shapes',
    description: 'Draw rectangle callouts (hold Shift for square)',
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    shortcut: 'O',
    group: 'shapes',
    description: 'Draw ellipse or circle callouts (hold Shift for circle)',
  },
  {
    id: 'line',
    label: 'Straight Line',
    shortcut: 'L',
    group: 'shapes',
    description: 'Draw straight divider or pointer lines (hold Shift to snap)',
  },
  {
    id: 'pen',
    label: 'Freehand Pen',
    shortcut: 'P',
    group: 'shapes',
    description: 'Sketch freehand ink strokes directly on the screenshot',
  },
  {
    id: 'highlighter',
    label: 'Highlighter',
    shortcut: 'M',
    group: 'shapes',
    description: 'Translucent marker emphasis (Shift for straight horizontal/vertical)',
    securityNote: {
      level: 'caution',
      text: 'Translucent emphasis only — never use Highlighter to hide sensitive text.',
    },
  },
  {
    id: 'text',
    label: 'Text Callout',
    shortcut: 'T',
    group: 'shapes',
    description: 'Click to place editable text callouts with optional background fill',
  },
  {
    id: 'step',
    label: 'Step Marker',
    shortcut: 'N',
    group: 'shapes',
    description: 'Stamp auto-incrementing numbered workflow badges (1, 2, 3…)',
  },
  {
    id: 'blur',
    label: 'Blur Region',
    shortcut: 'B',
    group: 'privacy',
    description: 'Soften visual clutter or non-critical UI areas',
    securityNote: {
      level: 'caution',
      text: 'Decorative blur only — blurred text can sometimes be reconstructed. Use Opaque Redact for secrets.',
    },
  },
  {
    id: 'pixelate',
    label: 'Pixelate Region',
    shortcut: 'X',
    group: 'privacy',
    description: 'Coarse mosaic pixelation for non-critical UI details',
    securityNote: {
      level: 'caution',
      text: 'Decorative mosaic only — not cryptographically irreversible. Use Opaque Redact for secrets.',
    },
  },
  {
    id: 'redact',
    label: 'Opaque Redact',
    shortcut: 'K',
    group: 'privacy',
    description: 'Permanent 100% solid redaction — destroys covered pixels on export',
    securityNote: {
      level: 'verified',
      text: 'Permanent Redaction — flattens at 100% opacity and overwrites underlying pixels in exported files.',
    },
  },
] as const;

export const DEFAULT_TOOL_STYLES: ToolStyleDefaults = {
  strokeColor: '#ef4444',
  strokeWidth: 3,
  fillColor: '#ef4444',
  fillOpacity: 0,
  opacity: 1,
  cornerRadius: 6,
  headStyle: 'filled',
  highlighterColor: '#facc15',
  highlighterWidth: 22,
  highlighterOpacity: 0.38,
  fontSize: 20,
  fontWeight: 'bold',
  textAlign: 'left',
  textBgOpacity: 0.9,
  stepRadius: 16,
  stepFillColor: '#ef4444',
  blurRadius: 16,
  blockSize: 14,
  redactColor: '#000000',
};

export const COLOR_SWATCHES = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#facc15', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#2563eb', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#0f172a', // Slate 900
  '#ffffff', // White
] as const;

export const REDACT_COLOR_SWATCHES = [
  '#000000', // Pure Black
  '#0f172a', // Deep Slate
  '#1e293b', // Slate Dark
  '#ffffff', // Solid White (for masking on white backgrounds)
] as const;
