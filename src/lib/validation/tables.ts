import { z } from "zod";
import { optionalIntField } from "./fields";

export const tableSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Give the table a name, like A4.")
    .max(40, "Use 40 characters or fewer."),
  capacity: optionalIntField(1, 100, "Seats must be a whole number from 1 to 100, or empty."),
});

export type TableInput = z.output<typeof tableSchema>;
