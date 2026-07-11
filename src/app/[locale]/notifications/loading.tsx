import { Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
