import { Skeleton } from "@/components/ui/Skeleton";

export default function CartLoading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        Loading your order
      </p>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </main>
  );
}
