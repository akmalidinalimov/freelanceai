/** Small trust badge shown for KYC-verified sellers. Presentational; pass the localized label. */
export function VerifiedBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success-soft))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--success))]"
      title={label}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4l2.3 2.29 6.3-6.3a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}
