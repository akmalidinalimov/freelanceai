import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card primitive — the one surface elevation used across the app.
 * `interactive` adds the shared hover/press/focus-within lift so every clickable
 * card (gigs, creators, dashboard tiles) behaves identically.
 */
export const cardBase =
  "rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-[var(--shadow-soft)]";

export const cardInteractive =
  "transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] hover:border-[hsl(var(--primary))]/30 focus-within:-translate-y-0.5 focus-within:shadow-[var(--shadow-hover)] active:translate-y-0 active:shadow-[var(--shadow-soft)]";

/** Class string for server components that render a <Link> or <div> as a card. */
export function cardClass(interactive = false, className?: string) {
  return cn(cardBase, interactive && cardInteractive, className);
}

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive = false, ...props }, ref) => (
  <div ref={ref} className={cardClass(interactive, className)} {...props} />
));
Card.displayName = "Card";
