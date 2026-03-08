// Derived from inline types in src/app/(admin)/admin/analytics/page.tsx
import { z } from "zod";

// ── Admin Analytics Schemas ─────────────────────────────────────────────
// These match the inline types used in the analytics page queries.

// Models with category breakdown query
export const ModelCatSchema = z.object({
  category: z.string(),
  provider: z.string(),
  is_open_weights: z.boolean(),
});

export type ModelCatType = z.infer<typeof ModelCatSchema>;

// Top downloaded models query
export const ModelDlSchema = z.object({
  name: z.string(),
  provider: z.string(),
  hf_downloads: z.number().nullable(),
});

export type ModelDlType = z.infer<typeof ModelDlSchema>;

// Top rated models query
export const ModelRatedSchema = z.object({
  name: z.string(),
  provider: z.string(),
  quality_score: z.number().nullable(),
});

export type ModelRatedType = z.infer<typeof ModelRatedSchema>;
