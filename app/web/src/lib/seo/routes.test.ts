import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import robots from "../../app/robots";
import sitemap, { buildSitemapEntries } from "../../app/sitemap";
import type { PublicContentItem } from "../public-content";
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
      entry.url.startsWith("https://www.ibpassociations.org"),
      `${entry.url} is not on the canonical origin`,
    );
    assert.equal("priority" in entry, false);
    assert.equal("changeFrequency" in entry, false);
  }
  assert.equal(entries[0].url, "https://www.ibpassociations.org/");
});

test("sitemap includes published content and fails on outages rather than dropping URLs", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://ibpassociations.org";
  process.env.BACKEND_URL = "http://backend.test";
  globalThis.fetch = (async (url: string) => {
    const type = url.includes("type=news") ? "news" : "events";
    return new Response(JSON.stringify({ items: [
      {
        id: "public-1",
        type,
        title: `Public ${type}`,
        body: `Published ${type} body`,
        publishToSite: true,
        createdAt: "2026-09-30T10:00:00.000Z",
        updatedAt: "2026-10-01T12:34:56.000Z",
      },
    ] }));
  }) as typeof fetch;
  const entries = await sitemap();
  assert.ok(entries.some((entry) => entry.url === "https://www.ibpassociations.org/news/public-1"));
  assert.ok(entries.some((entry) => entry.url === "https://www.ibpassociations.org/events/public-1"));
  assert.ok(entries.slice(INDEXABLE_ROUTES.length).every((entry) =>
    entry.lastModified === "2026-10-01T12:34:56.000Z"));
  globalThis.fetch = (async () => new Response("Unavailable", { status: 503 })) as typeof fetch;
  await assert.rejects(sitemap(), /temporarily unavailable/);
});

test("sitemap includes only canonical site-published records and never member previews", () => {
  const event: PublicContentItem = {
    id: "event-1",
    type: "events",
    title: "Shared announcement",
    body: "The same published event copy.",
    publishToSite: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-10-02T03:04:05.000Z",
  };
  const news: PublicContentItem[] = [
    ...Array.from({ length: 7 }, (_, index) => ({
      id: `news-${index + 1}`,
      type: "news" as const,
      title: `Published story ${index + 1}`,
      body: `Published body ${index + 1}`,
      publishToSite: true,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: index === 0 ? "invalid" : "2026-10-03T04:05:06.000Z",
    })),
    { ...event, id: "duplicate-news", type: "news" },
    { ...event, id: "draft-news", type: "news", title: "Draft", body: "Draft", publishToSite: false },
    { ...event, id: "wrong-type", type: "events" },
    { ...event, id: "invalid/id", type: "news" },
  ];

  const entries = buildSitemapEntries(news, [event, event]);
  const urls = entries.map((entry) => entry.url);

  assert.equal(entries.length, 24, "16 static + 7 canonical news + 1 event");
  assert.equal(new Set(urls).size, urls.length, "sitemap URLs must be unique");
  assert.ok(urls.every((url) => url.startsWith("https://www.ibpassociations.org/")));
  assert.ok(!urls.some((url) => url.includes("duplicate-news") || url.includes("draft-news")));
  assert.ok(!urls.some((url) => url.includes("wrong-type") || url.includes("invalid%2Fid")));
  assert.ok(!urls.some((url) => url.includes("/profile-preview/") || url.includes("/admin") || url.includes("/dashboard")));
  assert.equal(entries.find((entry) => entry.url.endsWith("/news/news-1"))?.lastModified, undefined);
  assert.equal(
    entries.find((entry) => entry.url.endsWith("/news/news-2"))?.lastModified,
    "2026-10-03T04:05:06.000Z",
  );
  assert.equal(
    entries.find((entry) => entry.url.endsWith("/events/event-1"))?.lastModified,
    "2026-10-02T03:04:05.000Z",
  );
});

test("robots.txt points at the canonical sitemap and does not block indexable routes", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://ibpa-web.vercel.app";

  const result = robots();
  assert.equal(result.sitemap, "https://www.ibpassociations.org/sitemap.xml");

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
