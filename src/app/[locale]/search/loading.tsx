import { Skeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Skeleton className="mb-6 h-11 w-full rounded-[var(--radius-md)]" />
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <Skeleton className="h-[52px] w-[52px] rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
