import { cn } from "@/lib/utils";

/**
 * Avatar with a graceful fallback: renders the photo when present, otherwise the person's
 * initial on a color deterministically derived from their name/id — so every user has a
 * stable visual identity even with no uploaded photo (the ui-avatars pattern). Never a blank
 * circle. Server-safe (no client hooks), so it works in RSC lists.
 */
function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

const SIZES: Record<string, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  /** Display name / username / id — drives the initial + fallback color. */
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const clean = (name ?? "").replace(/^@/, "").trim();
  const initial = (clean.charAt(0) || "•").toUpperCase();
  const box = cn("relative shrink-0 overflow-hidden rounded-full", SIZES[size], className);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={clean || "avatar"} className={cn(box, "object-cover")} />;
  }
  const h = hue(clean || "?");
  return (
    <span
      aria-hidden
      className={cn(box, "flex items-center justify-center font-bold text-white")}
      style={{ backgroundColor: `hsl(${h} 55% 45%)` }}
    >
      {initial}
    </span>
  );
}
