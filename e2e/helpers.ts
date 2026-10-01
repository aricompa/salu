import { expect, type Page } from "@playwright/test";

/** Local Supabase endpoints (Mailpit is the local test inbox, formerly Inbucket). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Polls the local inbox for an email to this address whose /auth/confirm link has the
 * given type (`email` for sign-up confirmation, `recovery` for password reset), newest
 * first, and returns the link.
 */
export async function emailLink(
  email: string,
  type: "email" | "recovery",
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const list = (await res.json()) as { messages?: Array<{ ID: string }> };
    for (const { ID } of list.messages ?? []) {
      const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${ID}`)).json()) as {
        HTML: string;
      };
      const href = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1]?.replaceAll(
        "&amp;",
        "&",
      );
      if (href && new URL(href).searchParams.get("type") === type) return href;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No ${type} email for ${email}`);
}

/** The sign-up confirmation link for this address. */
export function confirmationLink(email: string, timeoutMs = 15_000): Promise<string> {
  return emailLink(email, "email", timeoutMs);
}

/** Encodes a session the way @supabase/ssr stores it: base64 cookie, chunked at 3180 chars. */
function sessionCookies(session: unknown): Array<{ name: string; value: string }> {
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

/** Cloudflare's dummy token; local and CI Auth use the matching always-pass test secret. */
export const TEST_CAPTCHA_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ ...body, gotrue_meta_security: { captcha_token: TEST_CAPTCHA_TOKEN } }),
  });
  if (!res.ok) throw new Error(`auth ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** A fresh anonymous (diner) session, as browser cookies. */
export async function anonymousSessionCookies() {
  const session = await authPost("signup", {});
  if (session.user?.is_anonymous !== true) throw new Error("expected an anonymous user");
  return sessionCookies(session);
}

/** A password session for an already-confirmed staff user, as browser cookies. */
export async function staffSessionCookies(email: string, password: string) {
  const session = await authPost("token?grant_type=password", { email, password });
  if (session.user?.is_anonymous !== false) throw new Error("expected a permanent user");
  return sessionCookies(session);
}

/** Creates a staff user through the Auth API and confirms it via the app's /auth/confirm link. */
export async function createConfirmedStaff(
  confirm: (link: string) => Promise<void>,
): Promise<{ email: string; password: string }> {
  const email = uniqueEmail("staff");
  const password = "correct-horse-battery";
  await authPost("signup", { email, password });
  await confirm(await confirmationLink(email));
  return { email, password };
}

// ---------------------------------------------------------------- REST setup for diner tests

/** Signs up a staff user and confirms them through the Auth API; returns credentials and a token. */
export async function confirmedStaff(): Promise<{ email: string; password: string; jwt: string }> {
  const email = uniqueEmail("owner");
  const password = "correct-horse-battery";
  await authPost("signup", { email, password });
  const link = new URL(await confirmationLink(email));
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ type: "email", token_hash: link.searchParams.get("token_hash") }),
  });
  if (!res.ok) throw new Error(`verify failed: ${res.status} ${await res.text()}`);
  return { email, password, jwt: ((await res.json()) as { access_token: string }).access_token };
}

/** PostgREST call as the given user (RLS applies exactly as in the app). */
export async function rest<T = unknown>(
  jwt: string,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
      ...(init.prefer ? { prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

export type DinerFixture = {
  ownerJwt: string;
  ownerEmail: string;
  ownerPassword: string;
  restaurantId: string;
  restaurantName: string;
  tables: Record<string, { id: string; token: string }>;
  items: Record<string, string>;
};

/** A restaurant with a small menu (one item sold out, one hidden category) and seated tables. */
export async function createDinerFixture(): Promise<DinerFixture> {
  const owner = await confirmedStaff();
  const ownerJwt = owner.jwt;
  const restaurantName = "Casa Grande";
  const restaurantId = await rest<string>(ownerJwt, "rpc/create_restaurant", {
    method: "POST",
    body: {
      p_name: restaurantName,
      // Spec files start fixtures in parallel workers; the time alone can collide.
      p_slug: `casa-grande-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    },
  });
  const categories = await rest<Array<{ id: string; name: string }>>(ownerJwt, "menu_categories", {
    method: "POST",
    prefer: "return=representation",
    body: [
      { restaurant_id: restaurantId, name: "Starters", sort_order: 0, is_active: true },
      { restaurant_id: restaurantId, name: "Mains", sort_order: 1, is_active: true },
      { restaurant_id: restaurantId, name: "Staff meal", sort_order: 2, is_active: false },
    ],
  });
  const cat = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const rows = [
    ["Starters", "Burrata", 1400, true, ["vegetarian"], "Heirloom tomato, basil oil."],
    ["Starters", "Tuna Crudo", 1650, true, ["gluten-free", "spicy"], "Citrus, chili."],
    ["Mains", "Grilled Salmon", 2400, true, ["gluten-free"], "Salsa verde."],
    ["Mains", "Lobster Roll", 3200, false, [], "Butter-toasted bun."],
    ["Staff meal", "Secret Burger", 900, true, [], "Not on the menu."],
  ] as const;
  const items = await rest<Array<{ id: string; name: string }>>(ownerJwt, "menu_items", {
    method: "POST",
    prefer: "return=representation",
    body: rows.map(([category, name, price_cents, is_available, dietary_tags, description], i) => ({
      restaurant_id: restaurantId,
      category_id: cat[category],
      name,
      price_cents,
      is_available,
      dietary_tags,
      description,
      sort_order: i,
    })),
  });
  const tables = await rest<Array<{ id: string; label: string; qr_token: string }>>(
    ownerJwt,
    "dining_tables?select=id,label,qr_token",
    {
      method: "POST",
      prefer: "return=representation",
      body: ["A1", "A2", "B1", "C1", "C2", "D1"].map((label) => ({
        restaurant_id: restaurantId,
        label,
      })),
    },
  );
  // Staff seat every table, so diners can join (prank protection is on by default).
  for (const table of tables) {
    await rest(ownerJwt, "rpc/open_table_session", {
      method: "POST",
      body: { p_table_id: table.id },
    });
  }
  return {
    ownerJwt,
    ownerEmail: owner.email,
    ownerPassword: owner.password,
    restaurantId,
    restaurantName,
    tables: Object.fromEntries(tables.map((t) => [t.label, { id: t.id, token: t.qr_token }])),
    items: Object.fromEntries(items.map((i) => [i.name, i.id])),
  };
}

const ownerSessions = new WeakMap<DinerFixture, ReturnType<typeof staffSessionCookies>>();

/**
 * The fixture owner's session as cookies for a browser context (the staff portal). One
 * sign-in per fixture: local Auth allows 30 sign-ins per 5 minutes per IP, and access
 * tokens outlive any single test, so contexts can share the session.
 */
export async function ownerCookies(fx: DinerFixture) {
  if (!ownerSessions.has(fx))
    ownerSessions.set(fx, staffSessionCookies(fx.ownerEmail, fx.ownerPassword));
  return (await ownerSessions.get(fx)!).map((c) => ({ ...c, domain: "localhost", path: "/" }));
}

/**
 * A diner on their own phone, through the API: anonymous sign-in, join_table (with a
 * name if given) and place_order. The one place e2e diners get seated and order.
 */
export async function dinerPlacesOrder(
  fx: DinerFixture,
  tableLabel: string,
  lines: Array<{ item: string; quantity?: number; notes?: string }>,
  options: { name?: string; notes?: string } = {},
): Promise<{ jwt: string; sessionId: string; orderId: string }> {
  const session = (await authPost("signup", {})) as { access_token: string };
  const jwt = session.access_token;
  const [joined] = await rest<Array<{ session_id: string }>>(jwt, "rpc/join_table", {
    method: "POST",
    body: { p_qr_token: fx.tables[tableLabel].token, p_display_name: options.name ?? null },
  });
  const orderId = await rest<string>(jwt, "rpc/place_order", {
    method: "POST",
    body: {
      p_session_id: joined.session_id,
      p_items: lines.map((l) => ({
        menu_item_id: fx.items[l.item],
        quantity: l.quantity ?? 1,
        notes: l.notes ?? null,
      })),
      p_notes: options.notes ?? null,
    },
  });
  return { jwt, sessionId: joined.session_id, orderId };
}

/** A new table staff haven't seated yet. Added to the fixture so diner helpers can use it. */
export async function addUnseatedTable(fx: DinerFixture, label: string) {
  const [table] = await rest<Array<{ id: string; qr_token: string }>>(
    fx.ownerJwt,
    "dining_tables?select=id,qr_token",
    {
      method: "POST",
      prefer: "return=representation",
      body: { restaurant_id: fx.restaurantId, label },
    },
  );
  fx.tables[label] = { id: table.id, token: table.qr_token };
  return fx.tables[label];
}

/** Staff seat a table through the RPC (what the board's Seat button calls). */
export async function seatTable(fx: DinerFixture, label: string): Promise<string> {
  return rest<string>(fx.ownerJwt, "rpc/open_table_session", {
    method: "POST",
    body: { p_table_id: fx.tables[label].id },
  });
}

/** The first menu visit in a table session asks for a name (PRD D2); most tests skip it. */
export async function skipNameSheet(page: Page) {
  const sheet = page.getByRole("dialog", { name: "What should we call you?" });
  await sheet.getByRole("button", { name: "Skip" }).click();
  await expect(sheet).toBeHidden();
}
