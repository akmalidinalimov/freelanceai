import { CreatorGridSkeleton } from "@/components/skeletons";

// Streaming boundary. Safe here: this route never redirects or calls notFound() — see
// gigs/loading.tsx for why that matters.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <CreatorGridSkeleton count={8} />
    </div>
  );
}
