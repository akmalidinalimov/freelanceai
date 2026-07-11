import { Skeleton } from "@/components/skeletons";

// Gig detail — gallery + title on the left, the order/package panel on the right.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full rounded-[var(--radius-lg)]" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-2 h-11 w-full rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}
