/** Local Supabase endpoints (Mailpit is the local test inbox, formerly Inbucket). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Polls the local inbox for the confirmation email and returns its link. */
export async function confirmationLink(email: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const list = (await res.json()) as { messages?: Array<{ ID: string }> };
    if (list.messages?.length) {
      const msg = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`)
      ).json()) as {
        HTML: string;
      };
      const href = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No confirmation email for ${email}`);
}

/**
 * Creates an anonymous (diner) session through the Auth API and returns it in
 * the cookie format @supabase/ssr reads, chunked the same way.
 */
export async function anonymousSessionCookies(): Promise<Array<{ name: string; value: string }>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`anonymous sign-in failed: ${res.status} ${await res.text()}`);
  const session = await res.json();
  if (session.user?.is_anonymous !== true) throw new Error("expected an anonymous user");

  const name = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  const CHUNK = 3180;
  if (value.length <= CHUNK) return [{ name, value }];
  const chunks = [];
  for (let i = 0; i * CHUNK < value.length; i++) {
    chunks.push({ name: `${name}.${i}`, value: value.slice(i * CHUNK, (i + 1) * CHUNK) });
  }
  return chunks;
}
