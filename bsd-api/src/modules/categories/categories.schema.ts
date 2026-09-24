import { z } from "zod";
import { filterQuery } from "../../common/public.js";

// The category comes from the path, so it is not a query filter here.
export const categoryDetailQuery = filterQuery.omit({ category: true });

export const categoryParams = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,100}$/),
});
