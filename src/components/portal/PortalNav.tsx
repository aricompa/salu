"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const ITEMS = [
  { label: "Dashboard", href: "/restaurant/dashboard" },
  { label: "Orders", href: "/restaurant/orders" },
  { label: "Menu", href: "/restaurant/menu" },
  { label: "Tables", href: "/restaurant/tables" },
  { label: "Settings", href: "/restaurant/settings" },
] as const;

/** A section stays highlighted on its sub-pages (e.g. /restaurant/menu/items/new). */
const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal">
      <ul className="flex flex-wrap gap-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-card px-3 text-lg font-medium",
                isCurrent(pathname, item.href)
                  ? "bg-surface-raised text-text"
                  : "text-muted hover:text-text",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
