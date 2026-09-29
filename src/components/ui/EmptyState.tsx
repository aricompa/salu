import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
