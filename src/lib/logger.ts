/**
 * Lightweight structured (JSON) logger — one line per event with level/time/fields, so logs
 * are greppable and machine-parseable. A drop-in for pino at this scale; swap to pino + a
 * transport when log volume warrants it.
 */
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

/**
 * External error alerting. Deliberately DB-independent (no prisma/notification import): errors
 * spike exactly when the DB is down, so the alert path must not depend on it. Posts a generic
 * `{ text }` payload to ERROR_ALERT_WEBHOOK (Slack / Discord / Telegram-bot / self-host — no
 * vendor lock-in); no-op when unset. Throttled to ≤1 alert per distinct message per 5 min so a
 * failure storm can't flood the channel, and fully fire-and-forget so it never blocks or throws.
 */
const ALERT_WINDOW_MS = 5 * 60_000;
const alertedAt = new Map<string, number>();

function alertExternal(msg: string, fields?: Record<string, unknown>): void {
  const url = process.env.ERROR_ALERT_WEBHOOK;
  if (!url) return;
  const now = Date.now();
  if (now - (alertedAt.get(msg) ?? 0) < ALERT_WINDOW_MS) return; // throttle per message
  alertedAt.set(msg, now);
  if (alertedAt.size > 500) for (const [k, t] of alertedAt) if (now - t > ALERT_WINDOW_MS) alertedAt.delete(k);
  const detail = fields ? `\n${JSON.stringify(fields).slice(0, 800)}` : "";
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `🚨 ${msg}${detail}` }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {}); // never let a broken alert channel affect the request
}

/** logger.error PLUS a throttled external alert. Use for unexpected failures worth paging on. */
export function reportError(msg: string, fields?: Record<string, unknown>): void {
  emit("error", msg, fields);
  alertExternal(msg, fields);
}
