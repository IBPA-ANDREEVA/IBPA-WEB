import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSale,
  safeExternalUrl,
  safeInternalPath,
  SaleError,
} from "./sale-validation";
import { saleAvailability } from "./sale.service";
import {
  checkoutReturnPath,
  sessionMatchesOrder,
} from "./sale-checkout.service";
import type { Sale, SaleOrder } from "../../../lib/schema";
import type Stripe from "stripe";
const input = {
  title: "Masterclass",
  shortDescription: "Learn",
  description: "Full details",
  price: 7900,
  currency: "usd",
  status: "PUBLISHED",
};
test("prices are integer minor units; invalid quantities and dates are rejected", () => {
  assert.equal(validateSale(input).price, 7900);
  for (const price of [0, -1, 49, 79.5, NaN, Infinity, 100000000, "7900", null])
    assert.throws(() => validateSale({ ...input, price }), SaleError);
  for (const quantityLimit of [0, -1, 1.5, "1", Infinity, 2147483648])
    assert.throws(() => validateSale({ ...input, quantityLimit }), SaleError);
  assert.throws(
    () => validateSale({ ...input, compareAtPrice: 7900 }),
    SaleError,
  );
  assert.throws(() => validateSale({ ...input, currency: "eur" }), SaleError);
  assert.throws(
    () =>
      validateSale({
        ...input,
        startsAt: "2026-11-10T00:00:00Z",
        expiresAt: "2026-11-09T00:00:00Z",
      }),
    SaleError,
  );
  assert.throws(
    () => validateSale({ ...input, startsAt: "yesterday" }),
    SaleError,
  );
  assert.throws(
    () => validateSale({ ...input, onePerAccount: "true" }),
    SaleError,
  );
  assert.equal(
    validateSale({ ...input, compareAtPrice: 9900, quantityLimit: 1 })
      .compareAtPrice,
    9900,
  );
});
test("localized authored fields are bounded and unknown locales rejected", () => {
  assert.equal(
    validateSale({ ...input, translations: { uk: { title: "Навчання" } } })
      .translations.uk?.title,
    "Навчання",
  );
  assert.throws(
    () => validateSale({ ...input, translations: { de: { title: "Test" } } }),
    SaleError,
  );
  assert.throws(
    () =>
      validateSale({
        ...input,
        translations: { ru: { description: "a".repeat(20001) } },
      }),
    SaleError,
  );
});
test("published windows, capacity and one-per-account eligibility are authoritative", () => {
  const sale = {
    ...validateSale(input),
    createdAt: new Date(),
    updatedAt: new Date(),
    id: "id",
    version: 1,
    imagePresentation: null,
  } as Sale;
  assert.equal(saleAvailability(sale, 0), null);
  assert.equal(
    saleAvailability({ ...sale, status: "DRAFT" }, 0),
    "SALE_UNAVAILABLE",
  );
  assert.equal(
    saleAvailability({ ...sale, status: "ARCHIVED" }, 0),
    "SALE_UNAVAILABLE",
  );
  assert.equal(
    saleAvailability({ ...sale, startsAt: new Date("2100-01-01") }, 0),
    "SALE_UNAVAILABLE",
  );
  assert.equal(
    saleAvailability({ ...sale, expiresAt: new Date("2000-01-01") }, 0),
    "SALE_UNAVAILABLE",
  );
  assert.equal(saleAvailability({ ...sale, quantityLimit: 1 }, 1), "SOLD_OUT");
  assert.equal(
    saleAvailability({ ...sale, onePerAccount: true }, 1, true),
    "ALREADY_PURCHASED",
  );
});
test("notification links and checkout return paths cannot redirect outside dashboard", () => {
  for (const link of [
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "/dashboard\\evil",
    "/dashboard/%2f%2fevil",
    "https://evil.test",
  ])
    assert.equal(safeInternalPath(link), false, link);
  for (const link of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.com",
    "https://example.com\n",
  ])
    assert.equal(safeExternalUrl(link), false, link);
  assert.equal(safeExternalUrl("https://example.com/event?x=1"), true);
  assert.equal(
    checkoutReturnPath(
      "/dashboard/notifications?notification=abc&payment=returned&order=old",
    ),
    "/dashboard/notifications?notification=abc",
  );
  assert.equal(checkoutReturnPath("https://evil.test"), "/dashboard/sales");
});
test("Stripe sessions must match immutable order identity, amount and currency", () => {
  const order = {
    id: "order",
    saleId: "sale",
    userId: "user",
    amount: 7900,
    currency: "usd",
    stripeSessionId: "cs_test_1",
  } as SaleOrder;
  const session = {
    id: "cs_test_1",
    metadata: {
      orderKind: "sale",
      saleOrderId: "order",
      saleId: "sale",
      userId: "user",
    },
    client_reference_id: "order",
    amount_total: 7900,
    currency: "usd",
  } as unknown as Stripe.Checkout.Session;
  assert.equal(sessionMatchesOrder(session, order), true);
  for (const changed of [
    { amount_total: 1 },
    { currency: "eur" },
    { id: "cs_test_2" },
    { client_reference_id: "another" },
    { metadata: { ...session.metadata, userId: "another" } },
  ])
    assert.equal(
      sessionMatchesOrder(
        { ...session, ...changed } as Stripe.Checkout.Session,
        order,
      ),
      false,
    );
});
