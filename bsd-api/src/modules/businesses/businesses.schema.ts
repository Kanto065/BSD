import { z } from "zod";
import { filterQuery } from "../../common/public.js";

export const searchQuery = filterQuery;

export const featuredQuery = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(8),
  zone: filterQuery.shape.zone,
});

export const slugParams = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,120}$/),
});
