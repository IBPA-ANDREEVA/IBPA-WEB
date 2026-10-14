import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import { INDEXABLE_ROUTES, NOINDEX_PUBLIC_SEGMENTS, isPublicSearchPage } from "./routes";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalFetch = globalThis.fetch;
const originalBackendUrl = process.env.BACKEND_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
  else process.env.BACKEND_URL = originalBackendUrl;
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

function publicRouteSegments() {
  const publicDir = path.join(process.cwd(), "src", "app", "(public)");
  const hasPage = (dir: string): boolean => readdirSync(dir, { withFileTypes: true }).some((entry) =>
    entry.isDirectory() ? hasPage(path.join(dir, entry.name)) : entry.name === "page.tsx",
  );

  return readdirSync(publicDir).filter((entry) => {
    const entryPath = path.join(publicDir, entry);
    return statSync(entryPath).isDirectory() && entry !== "components" && hasPage(entryPath);
  });
}

test("every public route folder is either in the sitemap or marked noindex", () => {
  const indexableSegments = new Set(
    INDEXABLE_ROUTES.map((route) => route.path.split("/")[1]).filter(Boolean),
  );
  const noindexSegments = new Set(NOINDEX_PUBLIC_SEGMENTS);

  for (const segment of publicRouteSegments()) {
    assert.ok(
      indexableSegments.has(segment) || noindexSegments.has(segment),
      `app/(public)/${segment} is neither in INDEXABLE_ROUTES nor NOINDEX_PUBLIC_SEGMENTS`,
    );
    assert.ok(
      !(indexableSegments.has(segment) && noindexSegments.has(segment)),
      `app/(public)/${segment} is listed as both indexable and noindex`,
    );
  }
});

test("the public-rendering fast path never matches APIs, accounts, checkout or unknown routes", () => {
  for (const route of INDEXABLE_ROUTES) assert.equal(isPublicSearchPage(route.path), true);
  assert.equal(isPublicSearchPage("/news/story-1"), true);
  assert.equal(isPublicSearchPage("/events/event-1"), true);
  for (const path of ["/api/content", "/api/admin/content", "/api/orders", "/dashboard", "/dashboard/success",
    "/admin", "/sign-in", "/team-invite", "/success", "/payment-link/token", "/application/edit",
    "/profile-preview/id", "/news/id/edit", "/newsletters", "/unknown"]) {
    assert.equal(isPublicSearchPage(path), false, path);
  }
});

test("sitemap routes are unique, absolute paths that exist on disk", () => {
  const paths = INDEXABLE_ROUTES.map((route) => route.path);
  assert.equal(new Set(paths).size, paths.length);

  const publicDir = path.join(process.cwd(), "src", "app", "(public)");
  for (const routePath of paths) {
    assert.ok(routePath.startsWith("/"), `${routePath} must start with a slash`);
    const pageFile =
      routePath === "/"
        ? path.join(publicDir, "page.tsx")
        : path.join(publicDir, ...routePath.split("/").filter(Boolean), "page.tsx");
    assert.ok(statSync(pageFile).isFile(), `${routePath} has no page file at ${pageFile}`);
  }
});

test("sitemap URLs use the canonical origin even when the env points at vercel.app", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://ibpa-web.vercel.app";
  process.env.BACKEND_URL = "http://backend.test";
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [] }))) as typeof fetch;

  const entries = await sitemap();
  assert.equal(entries.length, INDEXABLE_ROUTES.length);

  for (const entry of entries) {
    assert.ok(
      entry.url.startsWith("https://ibpassociations.org"),
      `${entry.url} is not on the canonical origin`,
    );
    assert.equal("priority" in entry, false);
    assert.equal("changeFrequency" in entry, false);
  }
  assert.equal(entries[0].url, "https://ibpassociations.org/");
});

test("sitemap includes published content and fails on outages rather than dropping URLs", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://ibpassociations.org";
  process.env.BACKEND_URL = "http://backend.test";
  globalThis.fetch = (async (url: string) => new Response(JSON.stringify({ items: [
    { id: "public-1", type: url.includes("type=news") ? "news" : "events", title: "Public story" },
  ] }))) as typeof fetch;
  const entries = await sitemap();
  assert.ok(entries.some((entry) => entry.url === "https://ibpassociations.org/news/public-1"));
  assert.ok(entries.some((entry) => entry.url === "https://ibpassociations.org/events/public-1"));
  assert.ok(entries.slice(INDEXABLE_ROUTES.length).every((entry) => !("lastModified" in entry)));
  globalThis.fetch = (async () => new Response("Unavailable", { status: 503 })) as typeof fetch;
  await assert.rejects(sitemap(), /temporarily unavailable/);
});

test("robots.txt points at the canonical sitemap and does not block indexable routes", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://ibpa-web.vercel.app";

  const result = robots();
  assert.equal(result.sitemap, "https://ibpassociations.org/sitemap.xml");

  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const disallowed = rules.flatMap((rule) =>
    Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : [],
  );

  for (const route of INDEXABLE_ROUTES) {
    for (const blocked of disallowed) {
      assert.ok(
        !(route.path === blocked || route.path.startsWith(blocked.replace(/\/$/, "") + "/")),
        `${route.path} is blocked by Disallow: ${blocked}`,
      );
    }
  }
});
