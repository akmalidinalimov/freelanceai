import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Uniform API result envelope + error model. Pure (no server-only / DB imports) so it
 * is fully unit-testable and usable from route handlers and server actions alike.
 */

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; fields?: Record<string, string> } };

/** Typed error carrying an HTTP status; thrown by services/handlers. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
  get status() {
    return STATUS[this.code];
  }
}

export const Errors = {
  unauthenticated: (m = "Authentication required") => new ApiError("UNAUTHENTICATED", m),
  forbidden: (m = "Not allowed") => new ApiError("FORBIDDEN", m),
  notFound: (m = "Not found") => new ApiError("NOT_FOUND", m),
  validation: (fields: Record<string, string>, m = "Validation failed") =>
    new ApiError("VALIDATION", m, fields),
  conflict: (m = "Conflict") => new ApiError("CONFLICT", m),
  rateLimited: (m = "Too many requests") => new ApiError("RATE_LIMITED", m),
  internal: (m = "Internal error") => new ApiError("INTERNAL", m),
};

/** Map a zod error to field-keyed messages. */
export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "(root)";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Validate input against a schema, throwing a VALIDATION ApiError on failure. */
export function parseInput<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw Errors.validation(zodFieldErrors(r.error));
  return r.data;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data } satisfies ApiResult<T>, init);
}

/**
 * Convert any thrown value into a safe error envelope. ApiError → its code/status;
 * anything else → 500 INTERNAL with NO leaked details.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, fields: err.fields } } satisfies ApiResult<never>,
      { status: err.status }
    );
  }
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL", message: "Internal error" } } satisfies ApiResult<never>,
    { status: 500 }
  );
}
