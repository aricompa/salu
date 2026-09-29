"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const ITEMS = [
  { label: "Dashboard", href: "/restaurant/dashboard", ready: true },
  { label: "Orders", href: "/restaurant/orders", ready: false },
  { label: "Menu", href: "/restaurant/menu", ready: false },
  { label: "Tables", href: "/restaurant/tables", ready: false },
  { label: "Settings", href: "/restaurant/settings", ready: false },
] as const;

export function PortalNav() {
  const current = usePathname();
  return (
    <nav aria-label="Portal">
      <ul className="flex flex-wrap gap-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            {item.ready ? (
              <Link
                href={item.href}
                aria-current={current === item.href ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-card px-3 text-lg font-medium",
                  current === item.href
                    ? "bg-surface-raised text-text"
                    : "text-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 items-center gap-2 rounded-card px-3 text-lg text-muted"
              >
                {item.label}
                <span className="text-xs">soon</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
