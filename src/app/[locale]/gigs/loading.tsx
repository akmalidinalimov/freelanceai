import { Skeleton, GigGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="mb-5 h-9 w-44" />
      <Skeleton className="mb-6 h-11 w-full rounded-[var(--radius-md)]" />
      <GigGridSkeleton />
    </div>
  );
}
