import { Skeleton } from "@/components/ui/Skeleton";

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
      {/* The shape of the "4a" menu: a script title over one panel of rows. */}
      <Skeleton className="mt-2 h-12 w-40" />
      <Skeleton className="h-96 w-full" />
    </main>
  );
}
