import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** The Marigold band at the top of every diner page (charcoal text, 9.85:1). */
export function DinerHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <header
      className={cn(
        "-mx-4 -mt-4 rounded-b-[1.25rem] bg-header px-4 pt-5 pb-4 text-header-text",
        className,
      )}
    >
      {children}
    </header>
  );
}
