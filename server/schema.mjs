import { z } from 'zod';
import { componentTypes, modes } from '../shared/catalog.mjs';
const short = z.string().trim().min(1).max(100),
  key = z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,39}$/)
    .refine((s) => !['constructor', 'prototype', '__proto__'].includes(s));
export const component = z.object({
  id: z.string().regex(/^[\w-]{1,70}$/),
  type: z.enum(componentTypes),
  title: z.string().max(160),
  text: z.string().max(1000).default(''),
  color: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6})?$/)
    .default(''),
  spacing: z.number().int().min(0).max(64).default(16),
});
export const specSchema = z.object({
  name: short,
  summary: z.string().min(1).max(4000),
  kind: z.enum(['crm', 'inventory', 'analytics', 'learning', 'workflow', 'commerce', 'custom']),
  category: short,
  accent: z.string().regex(/^#[a-f\d]{6}$/i),
  theme: z.enum(['dark', 'light']),
  layout: z.enum(['sidebar', 'top']),
  density: z.enum(['compact', 'comfortable']),
  audience: short,
  roles: z.array(short).min(1).max(8),
  features: z.array(z.string().min(1).max(240)).min(1).max(20),
  pages: z
    .array(
      z.object({
        id: key,
        title: short,
        fields: z
          .array(z.object({ key, label: short, type: z.enum(['text', 'email', 'number', 'date']) }))
          .min(1)
          .max(20)
          .refine(
            (a) => new Set(a.map((f) => f.key)).size === a.length,
            'Field keys must be unique',
          ),
        components: z
          .array(component)
          .max(30)
          .refine(
            (a) => new Set(a.map((c) => c.id)).size === a.length,
            'Component IDs must be unique',
          ),
      }),
    )
    .min(1)
    .max(12)
    .refine((a) => new Set(a.map((p) => p.id)).size === a.length, 'Page IDs must be unique'),
});
export const promptSchema = z.object({
  prompt: z.string().trim().min(6, 'Describe your application in at least 6 characters.').max(8000),
  mode: z.enum(modes).default('Automatic'),
  template: z
    .enum(['crm', 'inventory', 'analytics', 'learning', 'workflow', 'commerce'])
    .optional(),
  provider: z.string().max(30).optional(),
});
export const filePath = z
  .string()
  .max(100)
  .regex(
    /^(?:[\w-]+\/)*[\w-]+(?:\.[\w-]+)*\.(?:html|css|js|mjs|jsx|ts|tsx|json|sql|md|txt)$/,
    'Use a relative source filename such as components/card.js.',
  );
export const workflowSchema = z.object({
  name: short,
  trigger: z.enum(['manual', 'record.created']),
  enabled: z.boolean(),
  steps: z
    .array(
      z.object({
        type: z.enum(['log', 'variable', 'condition', 'record', 'ai', 'request']),
        value: z.string().trim().min(1).max(2000),
        key: key.default('result'),
      }),
    )
    .min(1)
    .max(12),
});
