import Link from "next/link";
import { EmptyState, buttonStyles } from "@/components/ui";

export default function PortalNotFound() {
  return (
    <EmptyState
      title="Nothing here"
      body="This page doesn't exist, or your role can't open it."
      action={
        <Link href="/restaurant/dashboard" className={buttonStyles("secondary")}>
          Back to the dashboard
        </Link>
      }
    />
  );
}
