import assert from "node:assert/strict";
import { test } from "node:test";
import type { PublicContentItem } from "@/lib/public-content";
import { canonicalizePublicNews } from "@/lib/public-content";
import { contentDescription, contentJsonLd, contentMetadata, contentPath, publicHttpUrl } from "./content";
import { serializeJsonLd } from "./json-ld";

const story: PublicContentItem = {
  id: "story-1", type: "news", title: "A public story", body: "An announcement from IBPA.",
  createdAt: "2026-10-01T00:00:00Z", coverImage: "/news/beauty-forum-2025.webp",
};

test("detail URLs survive title edits and metadata uses the actual image", () => {
  assert.equal(contentPath(story), "/news/story-1");
  assert.equal(contentPath({ ...story, id: "id/unsafe" }), "/news/id%2Funsafe");
  const metadata = contentMetadata(story);
  assert.equal(metadata.alternates?.canonical, "/news/story-1");
  assert.equal(metadata.openGraph.type, "article");
  assert.ok(JSON.stringify(metadata.openGraph.images).includes("beauty-forum-2025.webp"));
  assert.equal(contentDescription({ title: "Fallback", body: "" }), "Fallback");
  assert.ok(contentDescription({ ...story, body: "word ".repeat(100) }).length <= 160);
});

test("identical cross-published announcements use one event URL without merging different stories", () => {
  const event = { ...story, type: "events" as const, id: "event-1" };
  const [duplicate] = canonicalizePublicNews([story], [event]);
  assert.equal(contentPath(duplicate), "/events/event-1");
  const [different] = canonicalizePublicNews([{ ...story, body: "A different article" }], [event]);
  assert.equal(contentPath(different), "/news/story-1");
  const [empty] = canonicalizePublicNews([{ ...story, body: "" }], [{ ...event, body: "" }]);
  assert.equal(contentPath(empty), "/news/story-1");
});

test("JSON-LD uses published copy without inventing author, dates, ratings or event details", () => {
  const blocks = contentJsonLd(story);
  assert.deepEqual(blocks.map((block) => block["@type"]), ["WebPage", "Article"]);
  for (const key of ["author", "datePublished", "dateModified", "aggregateRating"]) assert.equal(key in blocks[1], false);
  const event = { ...story, type: "events" as const };
  assert.equal(contentJsonLd(event).length, 1);
  assert.equal(contentJsonLd({ ...event, eventDate: "invalid", eventAddress: "Venue" }).length, 1);
  assert.equal(contentJsonLd({ ...event, eventDate: "2026-11-01", eventAddress: "Online" }).length, 1);
  // Even populated schedule fields have not been editorially verified.
  assert.equal(contentJsonLd({ ...event, eventDate: "2026-11-01T18:00:00-08:00", eventAddress: "Example venue, California" }).length, 1);
});

test("untrusted published strings and optional URLs cannot inject scripts", () => {
  const output = serializeJsonLd(contentJsonLd({ ...story, title: "</script><script>bad()</script>" }));
  assert.ok(!output.includes("<"));
  assert.equal(publicHttpUrl("javascript:alert(1)"), undefined);
  assert.equal(publicHttpUrl("//evil.test/path"), undefined);
  assert.equal(publicHttpUrl("https://user:pass@example.com"), undefined);
  assert.equal(publicHttpUrl("https://example.com/path"), "https://example.com/path");
});
