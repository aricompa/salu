"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Sticky, horizontally scrollable section tabs with scroll-spy: the tab for the section
 * nearest the top is marked current and kept in view. No library; IntersectionObserver.
 */
export function CategoryTabs({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const [current, setCurrent] = useState(categories[0]?.id);
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]?.[0];
        if (top) setCurrent(top.replace(/^section-/, ""));
      },
      { rootMargin: "-120px 0px -50% 0px" },
    );
    for (const c of categories) {
      const el = document.getElementById(`section-${c.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (!current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tabRefs.current.get(current)?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [current]);

  return (
    <nav
      aria-label="Menu sections"
      className="sticky top-0 z-10 -mx-4 border-b border-border bg-surface/95 px-4 backdrop-blur"
    >
      <ul className="flex [scrollbar-width:none] gap-2 overflow-x-auto py-2">
        {categories.map((c) => (
          <li key={c.id} className="shrink-0">
            <a
              ref={(el) => {
                if (el) tabRefs.current.set(c.id, el);
                else tabRefs.current.delete(c.id);
              }}
              href={`#section-${c.id}`}
              aria-current={current === c.id ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-chip border px-4 font-medium whitespace-nowrap",
                current === c.id
                  ? "border-brand bg-brand text-brand-contrast"
                  : "border-border text-text",
              )}
            >
              {c.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
