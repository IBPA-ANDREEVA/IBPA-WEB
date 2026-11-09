import { after, before, test, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import * as schema from "../../../lib/schema";
import { saveSale, listSales, getSale } from "./sale.service";
import {
  createSaleCheckout,
  handleSaleStripeEvent,
  findOrder,
  cancelSaleCheckout,
} from "./sale-checkout.service";
import {
  sendDashboardNotification,
  listDashboardNotifications,
  updateNotificationReceipts,
  type NotificationViewer,
} from "../../notifications/server/dashboard-notifications";
import {
  createOrUpdateEvent,
  registerDashboardEvent,
} from "../../events/server/event.service";
import { stripe } from "../../../services/stripe";
const pg = new PGlite();
const db = drizzle(pg, { schema });
const users: string[] = [
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
];
const viewers: NotificationViewer[] = users.map((id, i) => ({
  clerkId: `test-clerk-${i}`,
  userId: id,
  email: `member${i}@example.test`,
  role: i === 1 ? "PARTNER" : "MEMBER",
}));
const sessions = new Map<string, Stripe.Checkout.Session>();
const idempotency = new Map<string, string>();
let createCalls = 0;
const saleInput = {
  title: "Test masterclass",
  shortDescription: "Member offer",
  description: "Full test description",
  price: 7900,
  status: "PUBLISHED",
  currency: "usd",
};
before(async () => {
  for (const tag of [
    "0007_domain_refactor_foundation",
    "0011_expand_event_registrations",
    "0013_change_event_price_to_text",
    "0014_add_content_image_presentation",
    "0021_sales_and_notification_actions",
    "0022_sale_inventory_guards",
  ]) {
    await pg.exec(
      await fs.readFile(
        new URL(`../../../../drizzle/${tag}.sql`, import.meta.url),
        "utf8",
      ),
    );
  }
  await db.insert(schema.coreUsers).values(
    viewers.map((v) => ({
      id: v.userId!,
      email: v.email,
      clerkId: v.clerkId,
      role: v.role as "MEMBER" | "PARTNER",
    })),
  );
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_fixture";
  process.env.DASHBOARD_URL = "http://localhost:3002";
  mock.method(
    stripe.checkout.sessions,
    "create",
    async (
      params: Stripe.Checkout.SessionCreateParams,
      options: { idempotencyKey: string },
    ) => {
      createCalls++;
      const previous = idempotency.get(options.idempotencyKey);
      if (previous) return sessions.get(previous)!;
      const id = `cs_test_${crypto.randomUUID()}`;
      const session = {
        id,
        metadata: params.metadata,
        client_reference_id: params.client_reference_id,
        currency: params.line_items![0].price_data!.currency,
        amount_total: params.line_items![0].price_data!.unit_amount,
        payment_status: "unpaid",
        status: "open",
        payment_intent: `pi_test_${crypto.randomUUID()}`,
        url: `https://checkout.stripe.com/c/pay/${id}`,
        expires_at: params.expires_at,
      } as Stripe.Checkout.Session;
      sessions.set(id, session);
      idempotency.set(options.idempotencyKey, id);
      return session;
    },
  );
  mock.method(
    stripe.checkout.sessions,
    "retrieve",
    async (id: string) => sessions.get(id)!,
  );
  mock.method(stripe.checkout.sessions, "expire", async (id: string) => {
    const s = sessions.get(id)!;
    s.status = "expired";
    s.url = null;
    return s;
  });
});
after(async () => {
  mock.restoreAll();
  await pg.close();
});
const checkout = (
  saleId: string,
  user = 0,
  key = crypto.randomUUID(),
  path = "/dashboard/sales",
) =>
  createSaleCheckout(db, {
    saleId,
    userId: users[user],
    email: viewers[user].email,
    requestKey: key,
    returnPath: path,
    locale: "en",
  });
function event(type: string, session: Stripe.Checkout.Session): Stripe.Event {
  return {
    id: `evt_test_${crypto.randomUUID()}`,
    type,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: { object: session },
  } as Stripe.Event;
}
async function pay(id: string) {
  const session = sessions.get(id)!;
  session.status = "complete";
  session.payment_status = "paid";
  session.url = null;
  const e = event("checkout.session.completed", session);
  await handleSaleStripeEvent(db, e);
  return e;
}
test("migrations support draft → publish → edit → archive without losing historical order snapshots", async () => {
  const draft = await saveSale(db, { ...saleInput, status: "DRAFT" });
  assert.equal(
    (await listSales(db, {}, users[0])).items.some((i) => i.id === draft.id),
    false,
  );
  await assert.rejects(() => checkout(draft.id), /SALE_UNAVAILABLE/);
  const sale = await saveSale(db, { ...draft, status: "PUBLISHED" }, draft.id);
  const result = await checkout(sale.id);
  const order = await findOrder(db, result.orderId);
  await pay(order.stripeSessionId!);
  const updated = await saveSale(
    db,
    { ...sale, title: "Changed", price: 9900 },
    sale.id,
  );
  await saveSale(db, { ...updated, status: "ARCHIVED" }, sale.id);
  const historical = await findOrder(db, order.id);
  assert.equal(historical.amount, 7900);
  assert.equal(historical.itemTitle, "Test masterclass");
  assert.equal(historical.status, "PAID");
  assert.equal(
    (await getSale(db, sale.id, users[0])).availability,
    "SALE_UNAVAILABLE",
  );
  await assert.rejects(() => checkout(sale.id, 1), /SALE_UNAVAILABLE/);
  await assert.rejects(
    () => findOrder(db, order.id, users[1]),
    /ORDER_NOT_FOUND/,
  );
});
test("concurrent attempts share one order and one Stripe session; account and quantity limits hold", async () => {
  const sale = await saveSale(db, {
    ...saleInput,
    quantityLimit: 1,
    onePerAccount: true,
  });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) => checkout(sale.id, i % 2)),
  );
  const successes = results.filter(
    (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof checkout>>> =>
      r.status === "fulfilled",
  );
  assert.ok(successes.length >= 1);
  assert.equal(new Set(successes.map((r) => r.value.orderId)).size, 1);
  const rows = await db
    .select()
    .from(schema.coreSaleOrders)
    .where(eq(schema.coreSaleOrders.saleId, sale.id));
  assert.equal(rows.length, 1);
  const order = rows[0];
  const paidEvent = await pay(order.stripeSessionId!);
  await Promise.all([
    handleSaleStripeEvent(db, paidEvent),
    handleSaleStripeEvent(db, paidEvent),
  ]);
  await handleSaleStripeEvent(
    db,
    event("checkout.session.expired", sessions.get(order.stripeSessionId!)!),
  );
  assert.equal((await findOrder(db, order.id)).status, "PAID");
  const buyer = users.indexOf(order.userId);
  await assert.rejects(() => checkout(sale.id, buyer), /ALREADY_PURCHASED/);
  await assert.rejects(() => checkout(sale.id, 2), /SOLD_OUT/);
  assert.ok(createCalls >= 1);
});
test("canceling expires Stripe first, releases the slot, and keeps failure attempts durable", async () => {
  const sale = await saveSale(db, { ...saleInput, quantityLimit: 1 });
  const a = await checkout(sale.id);
  await cancelSaleCheckout(db, a.orderId, users[0]);
  assert.equal((await findOrder(db, a.orderId)).status, "CANCELED");
  const b = await checkout(sale.id, 1);
  const order = await findOrder(db, b.orderId);
  await handleSaleStripeEvent(
    db,
    event(
      "checkout.session.async_payment_failed",
      sessions.get(order.stripeSessionId!)!,
    ),
  );
  assert.equal((await findOrder(db, order.id)).status, "FAILED");
  const c = await checkout(sale.id, 2);
  assert.notEqual(c.orderId, b.orderId);
});
test("sale, notification and event entry points reserve identical orders; payment registers the linked event", async () => {
  const sale = await saveSale(db, saleInput);
  const linkedEvent = await createOrUpdateEvent(db, {
    title: "Linked event",
    body: "Details",
    publishToDashboard: true,
    linkedSaleId: sale.id,
  });
  const notification = await sendDashboardNotification(db, {
    title: "Member offer",
    description: "Details",
    emails: [viewers[0].email],
    actionType: "SALE",
    linkedSaleId: sale.id,
  });
  await assert.rejects(
    () =>
      registerDashboardEvent(db, {
        eventId: linkedEvent.id,
        userId: users[0],
        email: viewers[0].email,
      }),
    /PAYMENT_REQUIRED/,
  );
  const a = await checkout(sale.id, 0, crypto.randomUUID(), "/dashboard/sales");
  const b = await checkout(
    sale.id,
    0,
    crypto.randomUUID(),
    `/dashboard/notifications?notification=${notification.id}`,
  );
  const c = await checkout(
    sale.id,
    0,
    crypto.randomUUID(),
    `/dashboard?tab=events&event=${linkedEvent.id}`,
  );
  assert.equal(a.orderId, b.orderId);
  assert.equal(b.orderId, c.orderId);
  const order = await findOrder(db, a.orderId);
  const e = await pay(order.stripeSessionId!);
  await handleSaleStripeEvent(db, e);
  const registrations = await db
    .select()
    .from(schema.coreEventRegistrations)
    .where(eq(schema.coreEventRegistrations.eventId, linkedEvent.id));
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].userId, users[0]);
  assert.equal(registrations[0].source, `sale:${order.id}`);
  await db
    .update(schema.coreSaleOrders)
    .set({ status: "REFUNDED", refundedAmount: order.amount })
    .where(eq(schema.coreSaleOrders.id, order.id));
  await handleSaleStripeEvent(db, e);
  assert.equal((await findOrder(db, order.id)).status, "REFUNDED");
  assert.equal(
    (
      await db
        .select()
        .from(schema.coreEventRegistrations)
        .where(eq(schema.coreEventRegistrations.eventId, linkedEvent.id))
    )[0].status,
    "CANCELLED",
  );
});
test("database receipts preserve recipient isolation, read state, legacy reads and toast deduplication", async () => {
  const key = crypto.randomUUID();
  const payload = {
    requestKey: key,
    title: "Notice",
    description: "Only two recipients",
    emails: [viewers[0].email, viewers[1].email],
  };
  const n = await sendDashboardNotification(db, payload);
  assert.equal((await sendDashboardNotification(db, payload)).id, n.id);
  assert.equal(
    (await listDashboardNotifications(db, viewers[2], { id: n.id })).total,
    0,
  );
  assert.deepEqual(
    (await updateNotificationReceipts(db, viewers[2], { ids: [n.id] }))
      .updatedIds,
    [],
  );
  await Promise.all([
    updateNotificationReceipts(db, viewers[0], { ids: [n.id] }),
    updateNotificationReceipts(db, viewers[1], { ids: [n.id] }),
  ]);
  assert.equal(
    (await listDashboardNotifications(db, viewers[0], { id: n.id }))
      .notifications[0].unread,
    false,
  );
  assert.equal(
    (await listDashboardNotifications(db, viewers[1], { id: n.id }))
      .notifications[0].unread,
    false,
  );
  const claimed = await Promise.all([
    updateNotificationReceipts(db, viewers[0], { ids: [n.id], mode: "toast" }),
    updateNotificationReceipts(db, viewers[0], { ids: [n.id], mode: "toast" }),
  ]);
  assert.equal(
    claimed.reduce((sum, r) => sum + r.updatedIds.length, 0),
    1,
  );
  const legacy = crypto.randomUUID();
  await db.insert(schema.coreNotifications).values({
    id: legacy,
    title: "Legacy",
    message: "Old read",
    type: "DASHBOARD",
    recipients: { emails: [viewers[0].email] },
    metadata: { readBy: [viewers[0].email] },
  });
  assert.equal(
    (await listDashboardNotifications(db, viewers[0], { id: legacy }))
      .notifications[0].unread,
    false,
  );
  await db.insert(schema.coreNotifications).values({
    title: "Email campaign",
    message: "Private HTML",
    type: "EMAIL",
    visibility: "ALL",
  });
  assert.ok(
    (await listDashboardNotifications(db, viewers[0], {})).notifications.every(
      (n: { title: string }) => n.title !== "Email campaign",
    ),
  );
  await updateNotificationReceipts(db, viewers[0], { all: true });
  assert.equal(
    (await listDashboardNotifications(db, viewers[0], {})).unreadCount,
    0,
  );
});
test("database guards reject invalid amounts, limits, and stale editor versions", async () => {
  const sale = await saveSale(db, { ...saleInput, quantityLimit: 2 });
  await checkout(sale.id, 0);
  await checkout(sale.id, 1);
  await assert.rejects(() =>
    db.execute(sql`UPDATE ibpa.sales SET quantity_limit=1 WHERE id=${sale.id}`),
  );
  await assert.rejects(() =>
    db.execute(sql`UPDATE ibpa.sales SET price=-1 WHERE id=${sale.id}`),
  );
  await assert.rejects(
    () => saveSale(db, { ...sale, version: 0 }, sale.id),
    /SALE_CONFLICT/,
  );
});

// A pending buyer owns the reserved slot and must be able to resume checkout.
test("limited inventory stays purchasable for its pending buyer", async () => {
  const sale = await saveSale(db, { ...saleInput, quantityLimit: 1 });
  const result = await checkout(sale.id);
  assert.equal((await getSale(db, sale.id, users[0])).availability, null);
  assert.equal((await getSale(db, sale.id, users[1])).availability, "SOLD_OUT");
  const listed = await listSales(db, { q: sale.title }, users[0]);
  assert.equal(listed.items.find((i) => i.id === sale.id)?.availability, null);
  await cancelSaleCheckout(db, result.orderId, users[0]);
});
test("payment mismatch and mode mismatch cannot fulfill orders", async () => {
  const sale = await saveSale(db, saleInput);
  const result = await checkout(sale.id);
  const order = await findOrder(db, result.orderId);
  const session = sessions.get(order.stripeSessionId!)!;
  await assert.rejects(
    () =>
      handleSaleStripeEvent(
        db,
        event("checkout.session.completed", {
          ...session,
          payment_status: "paid",
          amount_total: 1,
        }),
      ),
    /PAYMENT_MISMATCH/,
  );
  const live = event("checkout.session.completed", session);
  live.livemode = true;
  await assert.rejects(
    () => handleSaleStripeEvent(db, live),
    /PAYMENT_MODE_MISMATCH/,
  );
  assert.equal((await findOrder(db, order.id)).status, "PENDING");
});
test("out-of-order refunds are monotonic and preserve access with another paid purchase", async () => {
  const sale = await saveSale(db, saleInput);
  const linked = await createOrUpdateEvent(db, {
    title: "Refund test",
    body: "Details",
    publishToDashboard: true,
    linkedSaleId: sale.id,
  });
  const a = await checkout(sale.id);
  const first = await findOrder(db, a.orderId);
  const paid = await pay(first.stripeSessionId!);
  const b = await checkout(sale.id);
  const second = await findOrder(db, b.orderId);
  await pay(second.stripeSessionId!);
  mock.method(stripe.paymentIntents, "retrieve", async (id: string) => ({
    id,
    metadata: sessions.get(
      id === first.stripePaymentIntentId
        ? first.stripeSessionId!
        : second.stripeSessionId!,
    )!.metadata,
  }));
  const refund = (order: typeof first, amount: number) =>
    ({
      ...event("charge.refunded", sessions.get(order.stripeSessionId!)!),
      data: {
        object: {
          payment_intent: order.stripePaymentIntentId,
          amount: order.amount,
          currency: "usd",
          amount_refunded: amount,
          created: Math.floor(Date.now() / 1000),
        },
      },
    }) as Stripe.Event;
  await handleSaleStripeEvent(db, refund(first, first.amount));
  let [registration] = await db
    .select()
    .from(schema.coreEventRegistrations)
    .where(eq(schema.coreEventRegistrations.eventId, linked.id));
  assert.equal(registration.status, "REGISTERED");
  await handleSaleStripeEvent(db, refund(second, 100));
  assert.equal((await findOrder(db, second.id)).status, "PAID");
  await handleSaleStripeEvent(db, refund(second, second.amount));
  await handleSaleStripeEvent(db, refund(second, 100));
  await handleSaleStripeEvent(db, paid);
  assert.equal((await findOrder(db, second.id)).refundedAmount, second.amount);
  assert.equal((await findOrder(db, first.id)).status, "REFUNDED");
  [registration] = await db
    .select()
    .from(schema.coreEventRegistrations)
    .where(eq(schema.coreEventRegistrations.eventId, linked.id));
  assert.equal(registration.status, "CANCELLED");
});
