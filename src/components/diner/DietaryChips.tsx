import { DIETARY_TAGS } from "@/lib/validation/menu";

/** Short chips ("GF") with the full word for screen readers ("Gluten-free"). */
export function DietaryChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Dietary">
      {tags.map((tag) => {
        const known = DIETARY_TAGS.find((t) => t.value === tag);
        return (
          <li key={tag} className="rounded-chip border border-border px-2 text-sm">
            <span aria-hidden="true">{known?.short ?? tag}</span>
            <span className="sr-only">{known?.label ?? tag}</span>
          </li>
        );
      })}
    </ul>
  );
}
