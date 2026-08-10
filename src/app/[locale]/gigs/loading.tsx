import { GigGridSkeleton } from "@/components/skeletons";

/**
 * Streaming boundary. Safe here because this route neither redirects nor calls notFound():
 * a loading.tsx makes Next stream a 200 shell immediately, which SWALLOWS the status code a
 * later redirect() or notFound() would have set — auth guards start answering 200 instead of
 * 307, and missing records become soft 404s. Only add one to a route that always renders.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <GigGridSkeleton count={9} />
    </div>
  );
}
