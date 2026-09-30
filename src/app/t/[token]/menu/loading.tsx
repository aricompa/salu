import { Skeleton } from "@/components/ui";

export default function MenuLoading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <p role="status" className="sr-only">
        Loading the menu
      </p>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-11 w-24" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </main>
  );
}
