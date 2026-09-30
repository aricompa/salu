import { z } from "zod";

/** A whole number typed into a form field. Empty text is an error, never 0. */
export function intField(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int().min(min, message).max(max, message));
}

/** An optional whole number: empty text becomes null. */
export function optionalIntField(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!/^\d+$/.test(v)) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      const n = Number(v);
      if (n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });
}

export const uuidField = z.uuid("That item no longer exists. Refresh and try again.");

/** Maps a zod error to one message per field, for FormResult.fieldErrors. */
export function fieldErrorsOf<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "") as F;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
