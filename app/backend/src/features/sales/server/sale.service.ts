import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireDb } from "../../../lib/db";
import {
  coreEvents,
  coreSales,
  coreSaleOrders,
  type Sale,
  type SaleOrder,
} from "../../../lib/schema";
import { SaleError, validateSale, requireUuid } from "./sale-validation";

type Db = ReturnType<typeof requireDb>;
export function saleAvailability(
  sale: Sale,
  used: number,
  purchased = false,
  now = new Date(),
  reserved = false,
) {
  if (
    sale.status !== "PUBLISHED" ||
    (sale.startsAt && sale.startsAt > now) ||
    (sale.expiresAt && sale.expiresAt <= now)
  )
    return "SALE_UNAVAILABLE";
  if (sale.onePerAccount && purchased) return "ALREADY_PURCHASED";
  if (sale.quantityLimit != null && used >= sale.quantityLimit && !reserved)
    return "SOLD_OUT";
  return null;
}
export async function getSale(
  db: Db,
  id: string,
  userId?: string,
  admin = false,
) {
  requireUuid(id);
  const [sale]: Sale[] = await db
    .select()
    .from(coreSales)
    .where(eq(coreSales.id, id))
    .limit(1);
  if (!sale) throw new SaleError("SALE_NOT_FOUND", 404);
  // Historical links retain a compact unavailable item, never an unpublished description.
  if (!admin && sale.status !== "PUBLISHED")
    return {
      id: sale.id,
      title: sale.title,
      status: sale.status,
      availability: "SALE_UNAVAILABLE",
      price: null,
      currency: sale.currency,
    };
  const [counts] = await db
    .select({
      used: sql<number>`count(*)::int`,
      reserved: sql<boolean>`coalesce(bool_or(${coreSaleOrders.userId} = ${userId ?? null} AND ${coreSaleOrders.status}='PENDING'),false)`,
      purchased: sql<boolean>`coalesce(bool_or(${coreSaleOrders.userId} = ${userId ?? null} AND ${coreSaleOrders.status} IN ('PAID','REFUNDED')),false)`,
    })
    .from(coreSaleOrders)
    .where(
      and(
        eq(coreSaleOrders.saleId, id),
        sql`${coreSaleOrders.status} IN ('PENDING','PAID','REFUNDED')`,
      ),
    );
  const events = await db
    .select({
      id: coreEvents.id,
      title: coreEvents.title,
      eventDate: coreEvents.startDate,
      eventEndDate: coreEvents.endDate,
      eventAddress: coreEvents.location,
    })
    .from(coreEvents)
    .where(
      and(
        eq(coreEvents.linkedSaleId, id),
        eq(coreEvents.publishToDashboard, true),
      ),
    );
  return {
    ...sale,
    availability: saleAvailability(
      sale,
      counts.used,
      counts.purchased,
      new Date(),
      counts.reserved,
    ),
    remaining:
      sale.quantityLimit == null
        ? null
        : Math.max(0, sale.quantityLimit - counts.used),
    events,
  };
}
export async function listSales(
  db: Db,
  query: { q?: string; status?: string; category?: string; page?: number },
  userId?: string,
  admin = false,
) {
  const page = Math.max(1, Math.min(100000, query.page || 1)),
    limit = 20;
  const where = and(
    admin
      ? query.status
        ? eq(coreSales.status, query.status)
        : undefined
      : and(
          eq(coreSales.status, "PUBLISHED"),
          sql`(${coreSales.startsAt} IS NULL OR ${coreSales.startsAt} <= now()) AND (${coreSales.expiresAt} IS NULL OR ${coreSales.expiresAt} > now())`,
        ),
    query.q
      ? or(
          ilike(coreSales.title, `%${query.q.slice(0, 200)}%`),
          ilike(coreSales.shortDescription, `%${query.q.slice(0, 200)}%`),
        )
      : undefined,
    query.category ? eq(coreSales.category, query.category) : undefined,
  );
  const [rows, [count], categories] = await Promise.all([
    db
      .select()
      .from(coreSales)
      .where(where)
      .orderBy(desc(coreSales.createdAt), desc(coreSales.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(coreSales)
      .where(where),
    db
      .selectDistinct({ category: coreSales.category })
      .from(coreSales)
      .where(admin ? undefined : eq(coreSales.status, "PUBLISHED")),
  ]);
  const items = await Promise.all(
    rows.map(async (s: Sale) => {
      const [counts] = await db
        .select({
          purchases: sql<number>`count(*) FILTER (WHERE status IN ('PAID','REFUNDED'))::int`,
          used: sql<number>`count(*) FILTER (WHERE status IN ('PENDING','PAID','REFUNDED'))::int`,
          reserved: sql<boolean>`coalesce(bool_or(user_id=${userId ?? null} AND status='PENDING'),false)`,
          purchased: sql<boolean>`coalesce(bool_or(user_id=${userId ?? null} AND status IN ('PAID','REFUNDED')),false)`,
        })
        .from(coreSaleOrders)
        .where(eq(coreSaleOrders.saleId, s.id));
      return {
        ...s,
        purchases: counts.purchases,
        availability: saleAvailability(
          s,
          counts.used,
          counts.purchased,
          new Date(),
          counts.reserved,
        ),
      };
    }),
  );
  return {
    items,
    total: count.total,
    page,
    pageSize: limit,
    categories: categories.map((r: { category: string }) => r.category),
  };
}
export async function saveSale(
  db: Db,
  body: Record<string, unknown>,
  id?: string,
) {
  const values = validateSale(body);
  if (!id)
    return (await db.insert(coreSales).values(values).returning())[0] as Sale;
  requireUuid(id);
  if (!Number.isInteger(body.version))
    throw new SaleError("VERSION_REQUIRED", 409);
  // Updates lock the same sale row as reservations; do not lower the limit below committed inventory.
  let updated: Sale;
  try {
    [updated] = await db
      .update(coreSales)
      .set({
        ...values,
        version: sql`${coreSales.version}+1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(coreSales.id, id),
          eq(coreSales.version, body.version as number),
          values.quantityLimit == null
            ? undefined
            : sql`${values.quantityLimit} >= (SELECT count(*) FROM ibpa.sale_orders WHERE sale_id=${id} AND status IN ('PENDING','PAID','REFUNDED'))`,
        ),
      )
      .returning();
  } catch (error) {
    if (
      String(
        (error as { cause?: { message?: string } }).cause?.message ||
          (error as Error).message,
      ).includes("SALE_CONFLICT")
    )
      throw new SaleError("SALE_CONFLICT", 409);
    throw error;
  }
  if (!updated) throw new SaleError("SALE_CONFLICT", 409);
  return updated;
}
export async function listSaleOrders(
  db: Db,
  userId?: string,
  page = 1,
  status?: string,
) {
  const where = and(
    userId ? eq(coreSaleOrders.userId, userId) : undefined,
    status ? eq(coreSaleOrders.status, status) : undefined,
  );
  const [items, [count]] = await Promise.all([
    db
      .select()
      .from(coreSaleOrders)
      .where(where)
      .orderBy(desc(coreSaleOrders.createdAt), desc(coreSaleOrders.id))
      .limit(20)
      .offset((page - 1) * 20),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(coreSaleOrders)
      .where(where),
  ]);
  return {
    items: items.map((o: SaleOrder) => ({
      ...o,
      requestKey: undefined,
      checkoutUrl: undefined,
    })),
    total: count.total,
    page,
    pageSize: 20,
  };
}
export async function saleStats(db: Db) {
  const [[items], [orders]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) FILTER(WHERE status='PUBLISHED')::int`,
        drafts: sql<number>`count(*) FILTER(WHERE status='DRAFT')::int`,
      })
      .from(coreSales),
    db
      .select({
        purchases: sql<number>`count(*) FILTER(WHERE status IN ('PAID','REFUNDED'))::int`,
        revenue: sql<string>`coalesce(sum(amount-refunded_amount) FILTER(WHERE status IN ('PAID','REFUNDED')),0)::text`,
      })
      .from(coreSaleOrders),
  ]);
  return { ...items, ...orders, currency: "usd" };
}
