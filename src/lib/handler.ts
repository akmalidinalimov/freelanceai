import "server-only";
import type { NextResponse } from "next/server";
import type { z } from "zod";
import type { User, UserRole } from "@prisma/client";
import { Errors, errorResponse, parseInput } from "@/lib/api";
import { isSameOrigin } from "@/lib/http";
import { getCurrentUser } from "@/lib/session";
import { requireRole } from "@/lib/authz";

interface HandlerOptions<TBody> {
  /** Require an authenticated user (default: false). */
  auth?: boolean;
  /** Require one of these roles (implies auth). */
  roles?: UserRole[];
  /** Enforce same-origin (CSRF defense) — default true for non-GET. */
  sameOrigin?: boolean;
  /** zod schema to validate the JSON body. */
  schema?: z.ZodType<TBody>;
}

interface HandlerContext<TBody> {
  request: Request;
  user: User | null;
  body: TBody;
}

/**
 * Wrap a route handler with the standard pipeline:
 *   same-origin (CSRF) → authn → authz(role) → body validation → handler → error envelope.
 * Keeps handlers thin and prevents per-route authz/validation drift.
 */
export function defineHandler<TBody = unknown>(
  options: HandlerOptions<TBody>,
  fn: (ctx: HandlerContext<TBody>) => Promise<NextResponse> | NextResponse
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      const isMutation = request.method !== "GET" && request.method !== "HEAD";
      const needsSameOrigin = options.sameOrigin ?? isMutation;
      if (needsSameOrigin && !isSameOrigin(request)) {
        throw Errors.forbidden("Cross-origin request rejected");
      }

      let user: User | null = null;
      if (options.auth || options.roles?.length) {
        user = await getCurrentUser();
        if (!user) throw Errors.unauthenticated();
        if (options.roles?.length) requireRole(user, ...options.roles);
      }

      let body = undefined as TBody;
      if (options.schema) {
        const json = await request.json().catch(() => undefined);
        body = parseInput(options.schema, json);
      }

      return await fn({ request, user, body });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
