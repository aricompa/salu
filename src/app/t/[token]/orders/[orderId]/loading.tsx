import { Skeleton } from "@/components/ui/Skeleton";

export default function OrderLoading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        Loading your order status
      </p>
      <Skeleton className="h-10 w-3/4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </main>
  );
}
