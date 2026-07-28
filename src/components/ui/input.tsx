import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Form primitives — consistent height, focus bloom and error state across both
 * themes. Placeholders inherit muted-foreground (contrast-checked). Error state
 * is expressed via `aria-invalid` and shown as a message BELOW the control
 * (never a tooltip) by the surrounding <Field>.
 */
const controlBase =
  "w-full rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm text-[hsl(var(--foreground))] " +
  "placeholder:text-[hsl(var(--muted-foreground))] " +
  "transition-[border-color,box-shadow] duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:border-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/35 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-[invalid=true]:border-[hsl(var(--danger))] aria-[invalid=true]:focus-visible:ring-[hsl(var(--danger))]/30";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(controlBase, "min-h-24 py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(controlBase, "h-10", className)} {...props} />
));
Select.displayName = "Select";

/** Label + control + below-control error message. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-[hsl(var(--foreground))]">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-[hsl(var(--danger))]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
