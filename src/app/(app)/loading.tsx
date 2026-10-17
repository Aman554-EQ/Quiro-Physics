import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="mt-6 h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}
