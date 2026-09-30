import { DIETARY_TAGS } from "@/lib/dietary";

/**
 * Short chips ("GF") with the full word for screen readers ("Gluten-free"). Inline spans,
 * because on the menu they sit inside the item's button, where a list isn't allowed.
 */
export function DietaryChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const known = DIETARY_TAGS.find((t) => t.value === tag);
        return (
          <span key={tag} className="rounded-chip border border-border px-2 text-sm">
            <span aria-hidden="true">{known?.short ?? tag}</span>
            <span className="sr-only">{known?.label ?? tag}</span>
          </span>
        );
      })}
    </span>
  );
}
