import { Skeleton } from "@/components/skeletons";

// Covers the inbox (/messages) and a thread (/messages/[id]) — a list of message rows.
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
