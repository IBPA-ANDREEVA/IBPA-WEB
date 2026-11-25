import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATALOG_COLUMNS,
  catalogStats,
  cleanHandle,
  filterCatalog,
  parseCatalog,
  parseCsv,
  safeHttpsUrl,
} from "./catalog";
import { loadCatalog } from "./load-catalog";
import { SAMPLE_LISTINGS } from "./sample";
import { CAMPAIGN_MESSAGES } from "./messages";

const header = CATALOG_COLUMNS.join(",");
const csv = (values: Record<string, string> = {}) =>
  header +
  "\r\n" +
  CATALOG_COLUMNS.map(
    (key) =>
      `"${String({ ...SAMPLE_LISTINGS[0], ...values }[key]).replaceAll('"', '""')}"`,
  ).join(",");

test("header-only real catalog is empty and has zero statistics", () => {
  assert.deepEqual(parseCatalog(header), []);
  assert.deepEqual(catalogStats(parseCatalog(header)), [0, 0, 0, 0]);
});
test("CSV preserves Cyrillic, commas, quotes and multiline descriptions", () => {
  const description = 'Первая строка, «помощь»\r\nВторая "строка"';
  const items = parseCatalog("\uFEFF" + csv({ description, name: "" }));
  assert.equal(items[0].description, description);
  assert.equal(items[0].name, "");
  assert.equal(items[0].title, SAMPLE_LISTINGS[0].title);
  assert.deepEqual(parseCsv('a,b\n"",\n'), [
    ["a", "b"],
    ["", ""],
  ]);
});
test("rejects authentication HTML, private/extra columns, broken CSV, unknown moderation states and duplicate IDs", () => {
  for (const text of [
    "<html>Sign in</html>",
    header + ",email",
    header.replace("id", "title"),
    csv({ status: "draft" }),
    csv({ type: "unknown" }),
    header + '\n"unclosed',
    csv() + "\n" + csv().split("\r\n")[1],
  ])
    assert.throws(() => parseCatalog(text));
});
test("normalizes known types and statuses without treating unknown records as open", () => {
  assert.equal(
    parseCatalog(csv({ type: " Ищу помощь ", status: "В работе" }))[0].status,
    "in_progress",
  );
  assert.equal(
    parseCatalog(csv({ type: "REQUEST", status: "DONE" }))[0].type,
    "request",
  );
});
test("combined filters, hybrid formats, completed toggle and full-dataset statistics", () => {
  const items = [
    ...SAMPLE_LISTINGS,
    {
      ...SAMPLE_LISTINGS[0],
      id: "BG-004",
      format: "Онлайн или офлайн",
      status: "done" as const,
    },
  ];
  const defaults = {
    type: "all" as const,
    specialization: "",
    format: "",
    showDone: false,
  };
  assert.equal(filterCatalog(items, defaults).length, 3);
  assert.equal(
    filterCatalog(items, {
      ...defaults,
      type: "offer",
      specialization: "Ресницы",
      format: "online",
    }).length,
    1,
  );
  assert.equal(
    filterCatalog(items, {
      ...defaults,
      type: "offer",
      specialization: "Ресницы",
      format: "offline",
      showDone: true,
    }).length,
    1,
  );
  assert.equal(
    filterCatalog(items, { ...defaults, type: "request", format: "offline" })
      .length,
    0,
  );
  assert.deepEqual(catalogStats(items), [4, 3, 1, 1]);
});
test("contact normalization accepts handles and genuine profile URLs only", () => {
  for (const value of [
    "@example_user",
    "example_user",
    "https://t.me/example_user",
    "t.me/example_user",
  ])
    assert.equal(cleanHandle(value, "telegram"), "example_user");
  for (const value of [
    "@example.user",
    "https://www.instagram.com/example.user/",
    "instagram.com/example.user",
    "https://ig.me/m/example.user",
  ])
    assert.equal(cleanHandle(value, "instagram"), "example.user");
  for (const value of [
    "https://evil.test/t.me/example_user",
    "http://t.me/example_user",
    "https://t.me/example_user/123",
    "javascript:alert(1)",
    "https://x@t.me/example_user",
    "t.me/+12345678",
    "example_user more",
    "https://t.me/share",
  ])
    assert.equal(cleanHandle(value, "telegram"), "");
  for (const value of [
    "https://instagram.com/p/123",
    "https://instagram.com.evil.test/user",
    "bad..name",
    "https://www.instagram.com/accounts/",
  ])
    assert.equal(cleanHandle(value, "instagram"), "");
  assert.equal(safeHttpsUrl("javascript:alert(1)"), "");
  assert.equal(safeHttpsUrl("https://user:pass@example.com"), "");
});
test("loader omits authentication, uses a short cache, and returns the actual empty result", async () => {
  const fake: typeof fetch = async (_url, options) => {
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.next?.revalidate, 60);
    assert.ok(options?.signal);
    return new Response(header, {
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  };
  assert.deepEqual(await loadCatalog(undefined, fake), {
    state: "ready",
    items: [],
  });
  assert.deepEqual(
    await loadCatalog("", () => {
      throw new Error("must not fetch");
    }),
    { state: "unconfigured", items: [] },
  );
});
test("loading failures never return demonstration records and arbitrary/private URLs are rejected", async () => {
  await assert.rejects(
    loadCatalog(undefined, async () => new Response("denied", { status: 403 })),
  );
  await assert.rejects(
    loadCatalog(
      undefined,
      async () =>
        new Response("<html>login</html>", {
          headers: { "content-type": "text/html" },
        }),
    ),
  );
  await assert.rejects(loadCatalog("https://example.com/private.csv"));
  await assert.rejects(loadCatalog("http://docs.google.com/"));
});
test("all locales retain every instruction and rule; samples cannot become live records", () => {
  for (const copy of Object.values(CAMPAIGN_MESSAGES)) {
    assert.equal(copy.steps.length, 4);
    assert.equal(copy.rules.length, 6);
    assert.equal(copy.ideas.length, 8);
  }
  assert.ok(SAMPLE_LISTINGS.every((item) => item.sample));
  assert.equal(SAMPLE_LISTINGS[1].name, "");
  assert.equal(parseCatalog(csv())[0].sample, undefined);
});

test("catalog request timeout aborts the upstream fetch", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const pending = loadCatalog(
      undefined,
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );
    const rejected = assert.rejects(pending, /aborted/);
    context.mock.timers.tick(10_000);
    await rejected;
  } finally {
    context.mock.timers.reset();
  }
});
