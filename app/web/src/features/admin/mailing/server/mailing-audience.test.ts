import { test } from "node:test";
import assert from "node:assert/strict";
import { collectAudiencePages } from "./mailing.repository";

test("notification audiences preserve recipients beyond the first 500", async () => {
  const offsets: number[] = [];
  const result = await collectAudiencePages(async (offset) => {
    offsets.push(offset);
    return offset === 0
      ? {
          items: Array.from({ length: 500 }, (_, i) => ({
            email: `${i}@example.test`,
          })),
          hasMore: true,
        }
      : { items: [{ email: "last@example.test" }], hasMore: false };
  });
  assert.deepEqual(offsets, [0, 500]);
  assert.equal(result.items.length, 501);
  assert.equal(result.items[500].email, "last@example.test");
});
test("a broken audience cursor fails instead of returning a truncated audience", async () => {
  await assert.rejects(
    () => collectAudiencePages(async () => ({ items: [], hasMore: true })),
    /did not advance/,
  );
});
