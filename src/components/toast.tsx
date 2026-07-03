"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "success" | "error" | "info";
type Toast = { id: number; message: string; variant: Variant };

const ToastCtx = createContext<((message: string, variant?: Variant) => void) | null>(null);

/** Returns a `toast(message, variant)` fn. No-op if the provider isn't mounted yet. */
export function useToast() {
  return useContext(ToastCtx) ?? (() => {});
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((message: string, variant: Variant = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }].slice(-3)); // max 3 stacked
  }, []);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-16 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-4 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

const EDGE: Record<Variant, string> = {
  success: "border-l-[hsl(var(--success))]",
  error: "border-l-[hsl(var(--danger))]",
  info: "border-l-[hsl(var(--info))]",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useCallback(() => {
    timer.current = setTimeout(onDismiss, 4000);
  }, [onDismiss]);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  return (
    <div
      role="status"
      onMouseEnter={stop}
      onMouseLeave={start}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-md)] border border-l-4 border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm shadow-[var(--shadow-overlay)] motion-safe:animate-[toastin_150ms_ease-out]",
        EDGE[toast.variant]
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
