/** The diner entry URL printed in a table's QR code: `<site>/t/<token>`. */
export function tableUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/t/${encodeURIComponent(token)}`;
}
