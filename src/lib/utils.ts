import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an integer UZS amount (no decimals) for display, e.g. 150000 -> "150 000".
 * Deterministic, ICU-independent grouping with a non-breaking space: `Intl` with a
 * locale can disagree between Node and the browser (Node "uz-UZ" grouped with a space,
 * Chrome with a comma), which produced a React hydration mismatch (#418) and an
 * inconsistent separator across the UI. Manual grouping is identical everywhere.
 */
export function formatUzs(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
