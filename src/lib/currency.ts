/**
 * Approximate USD/RUB display for UZS prices. DISPLAY-ONLY — UZS is always the
 * transaction currency. Rates are coarse + configurable via NEXT_PUBLIC_ env so the
 * founder can refresh them without code changes. Not for any money math.
 */
const UZS_PER_USD = Number(process.env.NEXT_PUBLIC_UZS_PER_USD) || 12600;
const UZS_PER_RUB = Number(process.env.NEXT_PUBLIC_UZS_PER_RUB) || 135;

export function approxUsd(uzs: number): number {
  return Math.round(uzs / UZS_PER_USD);
}

export function approxRub(uzs: number): number {
  return Math.round(uzs / UZS_PER_RUB);
}

/** "≈ $12 · ≈ ₽1,120" — a compact dual-currency hint for a UZS amount. */
export function approxPrice(uzs: number): string {
  return `≈ $${approxUsd(uzs).toLocaleString()} · ≈ ₽${approxRub(uzs).toLocaleString()}`;
}
