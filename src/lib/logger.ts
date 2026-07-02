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
