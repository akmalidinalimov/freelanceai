/**
 * Decorative ambient warm glows behind the whole app (see globals.css `.ambient`).
 * Pure CSS, transform-only animation; disabled automatically by the global
 * prefers-reduced-motion rule. Purely visual — hidden from assistive tech.
 */
export function AmbientGlow() {
  return (
    <div className="ambient" aria-hidden>
      <span className="glow-coral" />
      <span className="glow-gold" />
    </div>
  );
}
