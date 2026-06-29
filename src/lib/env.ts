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
    NEXT_PUBLIC_APP_URL: z.string().url(),
    SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be >= 16 chars"),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
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
