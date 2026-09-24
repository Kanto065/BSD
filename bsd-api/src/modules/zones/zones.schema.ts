import { z } from "zod";
import { filterQuery } from "../../common/public.js";

// The zone comes from the path, so it is not a query filter here.
export const zoneDetailQuery = filterQuery.omit({ zone: true });

export const zoneParams = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,100}$/),
});
