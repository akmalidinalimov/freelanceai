"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

const ConfirmCtx = createContext<((opts: ConfirmOpts) => Promise<boolean>) | null>(null);

/**
 * Returns `confirm(opts): Promise<boolean>`. Falls back to the native window.confirm
 * only if the provider isn't mounted, so call-sites never need window.confirm.
 */
export function useConfirm() {
  return (
    useContext(ConfirmCtx) ??
    (async (o: ConfirmOpts) => window.confirm(o.message ?? o.title))
  );
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    []
  );
  const settle = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && <Dialog opts={state.opts} onCancel={() => settle(false)} onConfirm={() => settle(true)} />}
    </ConfirmCtx.Provider>
  );
}

function Dialog({
  opts,
  onCancel,
  onConfirm,
}: {
  opts: ConfirmOpts;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first focusable (the cancel button) so keyboard users start inside.
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Tab") {
        const nodes = panelRef.current?.querySelectorAll<HTMLElement>("button");
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={opts.title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-overlay)]"
      >
        <h2 className="font-display text-lg font-bold">{opts.title}</h2>
        {opts.message && <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{opts.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {opts.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={opts.danger ? "destructive" : "default"} size="sm" onClick={onConfirm}>
            {opts.confirmLabel ?? "OK"}
          </Button>
        </div>
      </div>
    </div>
  );
}
