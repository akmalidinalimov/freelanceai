import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "every button" contract, defined once.
 * States: default · hover (slight rise + shade) · active (scale 0.98, instant) ·
 * focus-visible (2px ring, both themes) · disabled (dim + not-allowed) · loading
 * (spinner in a width-preserving slot — no layout jump).
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)]",
    "text-sm font-semibold select-none",
    "transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
    "active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-soft)] hover:-translate-y-px hover:shadow-[var(--shadow-hover)] hover:brightness-[1.05]",
        outline:
          "border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:-translate-y-px hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--muted))]",
        ghost: "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
        destructive:
          "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))] shadow-[var(--shadow-soft)] hover:-translate-y-px hover:shadow-[var(--shadow-hover)] hover:brightness-[1.05]",
        /* Legacy alias so existing variant="accent" callers keep working. */
        accent:
          "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[var(--shadow-soft)] hover:-translate-y-px hover:shadow-[var(--shadow-hover)] hover:brightness-[1.05]",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-3",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a centered spinner and block interaction without changing width. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* Content stays laid out (visibility:hidden) so the button keeps its width. */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        {children}
      </span>
      {loading && <Loader2 className="absolute h-4 w-4 animate-spin" aria-hidden />}
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
