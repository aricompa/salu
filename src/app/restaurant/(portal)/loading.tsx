import { Skeleton } from "@/components/ui";

export default function PortalLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-24" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-22" />
        <Skeleton className="h-22" />
        <Skeleton className="h-22" />
      </div>
    </div>
  );
}
