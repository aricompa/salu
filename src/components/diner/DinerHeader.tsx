import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** The top of every diner page: the restaurant on the page itself, no coloured band ("4a"). */
export function DinerHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <header className={cn("-mx-4 -mt-4 border-b border-text/10 px-4 pt-5 pb-4", className)}>
      {children}
    </header>
  );
}
