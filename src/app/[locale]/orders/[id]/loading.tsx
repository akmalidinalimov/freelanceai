import { Skeleton } from "@/components/skeletons";

// Streaming boundary: this route is a Server Component doing DB work, so without one the
// whole navigation blocks on a blank screen. Skeleton mirrors the real layout to avoid a jump.
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-16 w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="h-40 w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="h-64 w-full rounded-[var(--radius-lg)]" />
    </div>
  );
}
