import { z } from "zod";

export const FieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  fields: z.array(FieldErrorSchema).optional(),
});

export type FieldError = z.infer<typeof FieldErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Map a ZodError's issues to the FieldError[] shape used in API
 * validation responses. Keeps the path-flattening rule in one place so
 * every route returns validation errors in the same shape.
 */
export function zodIssuesToFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
}

/** Standard error codes */
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
