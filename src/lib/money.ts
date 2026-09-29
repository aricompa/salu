/** Formats integer cents. The only place money is turned into display text. */
export function formatCents(cents: number, currency = "usd", locale = "en-US"): string {
  if (!Number.isInteger(cents)) throw new Error("money must be integer cents");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
