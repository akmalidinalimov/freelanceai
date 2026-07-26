"use client";

/**
 * The always-visible strip shown while an admin is impersonating a user. Rendered by
 * a server wrapper only when the signed cookie is active, so this client part is
 * pure UI: identify who you appear as + one-tap exit.
 */
export function ImpersonationBanner({ targetName }: { targetName: string }) {
  async function exit() {
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] flex items-center justify-center gap-3 bg-[hsl(var(--danger))] px-4 py-1.5 text-sm font-semibold text-white"
    >
      <span aria-hidden>👁</span>
      <span>{targetName}</span>
      <button
        type="button"
        onClick={exit}
        className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold hover:bg-white/30"
      >
        ✕ Exit
      </button>
    </div>
  );
}
