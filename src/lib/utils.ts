import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an integer UZS amount (no decimals) for display, e.g. 150000 -> "150 000". */
export function formatUzs(amount: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(amount));
}
