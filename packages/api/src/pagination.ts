import { z } from "zod";

/** Cursor-based pagination query params */
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Paginated response wrapper — extend with your items */
export const PaginatedResponseSchema = z.object({
  nextCursor: z.string().nullable(),
});

export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;
