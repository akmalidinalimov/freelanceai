import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { reportError } from "./logger";

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
    public readonly fields?: Record<string, string>,
    public readonly retryAfterSec?: number
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
  rateLimited: (m = "Too many requests — please slow down and try again in a moment.", retryAfterSec?: number) =>
    new ApiError("RATE_LIMITED", m, undefined, retryAfterSec),
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
    const headers: Record<string, string> =
      err.code === "RATE_LIMITED" ? { "Retry-After": String(err.retryAfterSec ?? 60) } : {};
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, fields: err.fields } } satisfies ApiResult<never>,
      { status: err.status, headers }
    );
  }
  // Unhandled: log with a correlation id (full detail server-side) and return it to the
  // client so support can trace the exact event — the user-facing message stays generic.
  const correlationId = randomBytes(6).toString("hex");
  // reportError = log + throttled external alert (ERROR_ALERT_WEBHOOK) — an unexpected 500 is
  // the highest-signal thing to page on. No-op alerting until the webhook env is set.
  reportError("unhandled_error", {
    correlationId,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL", message: "Internal error", correlationId } },
    { status: 500 }
  );
}
