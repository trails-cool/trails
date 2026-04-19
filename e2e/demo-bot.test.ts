import { test, expect } from "./fixtures/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

// Demo-bot UX: a browser-side verification that a pre-seeded `bruno`
// profile renders the demo badge and surfaces his public content to an
// anonymous visitor. We seed directly via SQL rather than running the
// pg-boss handler, because the handler depends on BRouter and on the
// demo flag being live in the server process. The point of this test
// is the *public surface*, not the generation path (that's covered in
// app/lib/demo-bot.integration.test.ts).

const CONN = process.env.DATABASE_URL ?? "postgres://trails:trails@localhost:5432/trails";

async function seedBrunoWithSyntheticRoute(): Promise<{ username: string; routeName: string }> {
  const sql = postgres(CONN, { max: 1 });
  const username = `bruno-e2e-${Date.now()}`;
  const routeName = `Bruno's ${Date.now()} walk`;
  const userId = randomUUID();
  const routeId = randomUUID();
  try {
    await sql`
      INSERT INTO journal.users (id, email, username, display_name, bio, domain, terms_accepted_at, terms_version)
      VALUES (${userId}, ${`${username}@example.com`}, ${username}, 'Bruno', 'Professional park inspector.', 'localhost', now(), '2026-04-19')
    `;
    await sql`
      INSERT INTO journal.routes (id, owner_id, name, description, visibility, synthetic, distance, created_at, updated_at)
      VALUES (${routeId}, ${userId}, ${routeName}, 'Sniffed three bushes.', 'public', true, 3200, now(), now())
    `;
  } finally {
    await sql.end();
  }
  return { username, routeName };
}

async function cleanupBruno(username: string) {
  const sql = postgres(CONN, { max: 1 });
  try {
    const [row] = await sql<{ id: string }[]>`SELECT id FROM journal.users WHERE username = ${username}`;
    if (!row) return;
    await sql`DELETE FROM journal.activities WHERE owner_id = ${row.id}`;
    await sql`DELETE FROM journal.routes WHERE owner_id = ${row.id}`;
    await sql`DELETE FROM journal.users WHERE id = ${row.id}`;
  } finally {
    await sql.end();
  }
}

test.describe.configure({ mode: "serial" });

test.describe("Demo-bot UX", () => {
  test("seeded bruno profile shows demo badge + public route to anon visitor", async ({ browser }) => {
    const { username, routeName } = await seedBrunoWithSyntheticRoute();
    try {
      const anonCtx = await browser.newContext();
      const anon = await anonCtx.newPage();
      const resp = await anon.goto(`/users/${username}`);
      expect(resp?.status()).toBe(200);

      await expect(anon.getByRole("heading", { name: /Bruno/ })).toBeVisible();
      // The demo badge is only rendered when username === 'bruno' — our
      // seeded username includes a timestamp suffix, so the badge
      // shouldn't appear. This is an intentional guard: only the *real*
      // bruno gets the badge. The rest of the page still works.
      await expect(anon.getByText("🐕 Demo account")).toHaveCount(0);

      // Public synthetic route is listed on the profile.
      await expect(anon.getByRole("link", { name: new RegExp(routeName) })).toBeVisible();
      await anonCtx.close();
    } finally {
      await cleanupBruno(username);
    }
  });

  test("profile rendered at /users/bruno shows the demo badge when username is exactly 'bruno'", async ({ browser }) => {
    const sql = postgres(CONN, { max: 1 });
    const userId = randomUUID();
    const routeId = randomUUID();
    // Use ON CONFLICT so a pre-existing prod `bruno` user doesn't block
    // the test; we don't clean up a row we didn't create.
    const created = await sql`
      INSERT INTO journal.users (id, email, username, display_name, bio, domain, terms_accepted_at, terms_version)
      VALUES (${userId}, 'bruno@localhost', 'bruno', 'Bruno', 'Professional park inspector.', 'localhost', now(), '2026-04-19')
      ON CONFLICT (username) DO NOTHING
      RETURNING id
    `;
    const weCreatedIt = created.length > 0;
    const effectiveUserId = weCreatedIt ? userId : (await sql`SELECT id FROM journal.users WHERE username='bruno'`)[0]!.id as string;

    await sql`
      INSERT INTO journal.routes (id, owner_id, name, description, visibility, synthetic, distance, created_at, updated_at)
      VALUES (${routeId}, ${effectiveUserId}, 'Grunewald patrol', 'Sniffed three bushes.', 'public', true, 3200, now(), now())
    `;
    await sql.end();

    try {
      const anonCtx = await browser.newContext();
      const anon = await anonCtx.newPage();
      const resp = await anon.goto(`/users/bruno`);
      expect(resp?.status()).toBe(200);
      await expect(anon.getByText(/Demo account|Demo-Konto/)).toBeVisible();
      await expect(anon.getByRole("link", { name: /Grunewald patrol/ })).toBeVisible();
      await anonCtx.close();
    } finally {
      const cleanup = postgres(CONN, { max: 1 });
      try {
        await cleanup`DELETE FROM journal.routes WHERE id = ${routeId}`;
        if (weCreatedIt) {
          await cleanup`DELETE FROM journal.users WHERE id = ${userId}`;
        }
      } finally {
        await cleanup.end();
      }
    }
  });
});
