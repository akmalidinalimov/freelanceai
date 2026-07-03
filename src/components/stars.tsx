/** Read-only 5-star rating display. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`inline-flex ${className}`} aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= rounded ? "hsl(var(--star))" : "hsl(var(--border))" }}>
          ★
        </span>
      ))}
    </span>
  );
}
