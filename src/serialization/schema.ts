import { z } from 'zod';

export const SNAPMARK_PROJECT_VERSION = 1 as const;
export const SNAPMARK_FORMAT_ID = 'snapmark-project' as const;

const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Expected hex color (#RGB or #RRGGBB)');

const finiteNumber = z.number().finite();
const positiveFinite = z.number().finite().min(0);
const unitInterval = z.number().finite().min(0).max(1);

const baseAnnotationSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  visible: z.boolean(),
  locked: z.boolean(),
});

const rectAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('rect'),
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFinite,
  height: positiveFinite,
  strokeColor: hexColorSchema,
  strokeWidth: z.number().finite().min(0).max(100),
  fillColor: hexColorSchema,
  fillOpacity: unitInterval,
  opacity: unitInterval,
  cornerRadius: z.number().finite().min(0).max(500),
});

const ellipseAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('ellipse'),
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFinite,
  height: positiveFinite,
  strokeColor: hexColorSchema,
  strokeWidth: z.number().finite().min(0).max(100),
  fillColor: hexColorSchema,
  fillOpacity: unitInterval,
  opacity: unitInterval,
});

const lineAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('line'),
  x1: finiteNumber,
  y1: finiteNumber,
  x2: finiteNumber,
  y2: finiteNumber,
  strokeColor: hexColorSchema,
  strokeWidth: z.number().finite().min(1).max(100),
  opacity: unitInterval,
});

const arrowAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('arrow'),
  x1: finiteNumber,
  y1: finiteNumber,
  x2: finiteNumber,
  y2: finiteNumber,
  strokeColor: hexColorSchema,
  strokeWidth: z.number().finite().min(1).max(100),
  opacity: unitInterval,
  headStyle: z.enum(['filled', 'open', 'double', 'outline']),
});

const penAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('pen'),
  points: z
    .array(finiteNumber)
    .min(4)
    .refine((pts) => pts.length % 2 === 0, 'Points array must have even coordinate count'),
  strokeColor: hexColorSchema,
  strokeWidth: z.number().finite().min(1).max(100),
  opacity: unitInterval,
});

const highlighterAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('highlighter'),
  points: z
    .array(finiteNumber)
    .min(4)
    .refine((pts) => pts.length % 2 === 0, 'Points array must have even coordinate count'),
  strokeColor: hexColorSchema,
  strokeWidth: z.number().finite().min(4).max(120),
  opacity: z.number().finite().min(0.05).max(0.65),
});

const textAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('text'),
  x: finiteNumber,
  y: finiteNumber,
  width: z.number().finite().min(20).max(10000),
  text: z.string().max(10000),
  fontSize: z.number().finite().min(8).max(240),
  fontWeight: z.enum(['normal', 'medium', 'bold']),
  textAlign: z.enum(['left', 'center', 'right']),
  strokeColor: hexColorSchema,
  fillColor: hexColorSchema,
  fillOpacity: unitInterval,
  opacity: unitInterval,
});

const stepAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('step'),
  x: finiteNumber,
  y: finiteNumber,
  radius: z.number().finite().min(8).max(120),
  stepNumber: z.number().int().min(0).max(999),
  fillColor: hexColorSchema,
  strokeColor: hexColorSchema,
  textColor: hexColorSchema,
  opacity: unitInterval,
});

const blurAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('blur'),
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFinite,
  height: positiveFinite,
  blurRadius: z.number().finite().min(1).max(80),
});

const pixelateAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('pixelate'),
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFinite,
  height: positiveFinite,
  blockSize: z.number().finite().min(2).max(80),
});

const redactAnnotationSchema = baseAnnotationSchema.extend({
  type: z.literal('redact'),
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFinite,
  height: positiveFinite,
  fillColor: hexColorSchema,
  opacity: z.literal(1),
});

export const annotationObjectSchema = z.discriminatedUnion('type', [
  rectAnnotationSchema,
  ellipseAnnotationSchema,
  lineAnnotationSchema,
  arrowAnnotationSchema,
  penAnnotationSchema,
  highlighterAnnotationSchema,
  textAnnotationSchema,
  stepAnnotationSchema,
  blurAnnotationSchema,
  pixelateAnnotationSchema,
  redactAnnotationSchema,
]);

export const embeddedImageSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  width: z.number().int().min(1).max(12000),
  height: z.number().int().min(1).max(12000),
  dataUrl: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
      'Invalid embedded base64 image data URL'
    ),
});

export const snapmarkProjectSchema = z.object({
  format: z.literal(SNAPMARK_FORMAT_ID),
  version: z.literal(SNAPMARK_PROJECT_VERSION),
  projectName: z.string().min(1).max(160),
  savedAt: z.string(),
  image: embeddedImageSchema,
  annotations: z.array(annotationObjectSchema).max(2000),
});

export type SnapmarkProjectFile = z.infer<typeof snapmarkProjectSchema>;
