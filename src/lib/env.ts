import { z } from "zod";

/**
 * Server environment validation. Fail-fast: the app refuses to run with missing or
 * weak required config. `parseEnv` is pure (testable); `serverEnv()` validates
 * `process.env` lazily + memoized so it never runs during `next build`.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    // Public app origin. Prefer the runtime APP_ORIGIN; NEXT_PUBLIC_APP_URL kept for dev.
    APP_ORIGIN: z.string().url().optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    // Legacy (pre-Auth.js opaque sessions); no longer signs sessions. Kept optional.
    SESSION_SECRET: z.string().min(16).optional(),
    // Auth.js (NextAuth v5) — signs the JWT session.
    AUTH_SECRET: z.string().min(32).optional(),
    AUTH_URL: z.string().url().optional(),
    AUTH_TRUST_HOST: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    // Cloudflare R2 (S3-compatible) media storage
    S3_ENDPOINT: z.string().url().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_BASE_URL: z.string().url().optional(),
    // Email provider (Resend) — optional; email notifications no-op until set.
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    // Shared secret for the scheduled cron endpoint (auto-complete).
    CRON_SECRET: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    // Runtime bot username (public); used for the bot deep-link login.
    TELEGRAM_BOT_USERNAME: z.string().optional(),
    // Shared secret for verifying Telegram webhook calls (>=16 chars when set).
    TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
    // Comma-separated Telegram numeric IDs granted ADMIN on login (allowlist).
    ADMIN_TELEGRAM_IDS: z.string().optional(),
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().optional(),
    // Field-encryption key (AES-256 = 32 bytes). Required once we encrypt PII (P5/P8).
    DATA_ENC_KEY: z.string().min(32).optional(),
    PLATFORM_COMMISSION_PCT: z.coerce.number().min(0).max(100).default(20),
  })
  .superRefine((env, ctx) => {
    // In production the Telegram bot token is required (auth depends on it).
    if (env.NODE_ENV === "production" && !env.TELEGRAM_BOT_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TELEGRAM_BOT_TOKEN"],
        message: "TELEGRAM_BOT_TOKEN is required in production",
      });
    }
    // A public origin must be configured in production (for redirects/auth URL).
    if (env.NODE_ENV === "production" && !env.APP_ORIGIN && !env.NEXT_PUBLIC_APP_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_ORIGIN"],
        message: "APP_ORIGIN (or NEXT_PUBLIC_APP_URL) is required in production",
      });
    }
    // Auth.js needs its secret in production.
    if (env.NODE_ENV === "production" && !env.AUTH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required in production",
      });
    }
    // Bot deep-link login needs the username + webhook secret in production.
    if (env.NODE_ENV === "production") {
      if (!env.TELEGRAM_BOT_USERNAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_BOT_USERNAME"],
          message: "TELEGRAM_BOT_USERNAME is required in production",
        });
      }
      if (!env.TELEGRAM_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_WEBHOOK_SECRET"],
          message: "TELEGRAM_WEBHOOK_SECRET is required in production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Pure: parse a raw env object, throwing a readable error on failure. */
export function parseEnv(raw: NodeJS.ProcessEnv | Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated server env (memoized). Call from server code, not at module top-level. */
export function serverEnv(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
