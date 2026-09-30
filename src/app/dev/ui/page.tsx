import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui";

export const metadata = { title: "UI primitives · Salu (dev)" };

function Showcase({ theme }: { theme: "light" | "dark" }) {
  return (
    <section data-theme={theme} className="flex flex-col gap-6 bg-surface p-6 text-text">
      <h2 className="text-xl font-semibold">{theme === "light" ? "Light" : "Dark"}</h2>

      <div className="flex flex-wrap gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button loading>Saving</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div className="grid max-w-sm gap-4">
        <Input label="Email" type="email" placeholder="you@restaurant.com" />
        <Input
          label="Link"
          hint="Lowercase letters, numbers and dashes"
          defaultValue="casa-grande"
        />
        <Input label="Password" type="password" error="Use at least 10 characters." />
        <Select label="Category" hint="Items without a category don't show on the diner menu.">
          <option>Mains</option>
          <option>Drinks (hidden)</option>
        </Select>
        <Textarea label="Description" hint="Optional." defaultValue="Butter-toasted bun." />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>Submitted</Badge>
        <Badge tone="success">Ready</Badge>
        <Badge tone="warning">10 min</Badge>
        <Badge tone="danger">Sold out</Badge>
      </div>

      <Card className="max-w-sm">
        <p className="font-semibold">Table A4</p>
        <p className="text-muted">2 × Grilled Salmon</p>
      </Card>

      <div className="flex max-w-sm flex-col gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      <EmptyState
        title="No menu items yet"
        body="Add your first dish to start taking orders."
        action={<Button variant="secondary">Add item</Button>}
      />
    </section>
  );
}

export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="grid md:grid-cols-2">
      <Showcase theme="light" />
      <Showcase theme="dark" />
    </main>
  );
}
