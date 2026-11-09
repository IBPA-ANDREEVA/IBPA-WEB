"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Pending state follows the authenticated request key. */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUpRight, ReceiptText, ShoppingBag } from "lucide-react";
import {
  SectionCard,
  SectionHeader,
} from "@/shared/components/DashboardShared";
import { AdminTable } from "@/features/admin/shared/components/AdminTable";
import { ContentImage } from "@/components/content/ContentImage";
import { useCommerce, commerceError } from "./messages";
import { commerceApi } from "./api";
import { type SaleItem, type SaleOrder, localizedSale, money } from "./types";
import { useSaleCheckout, SaleCheckoutButton } from "./SalePurchaseProvider";
import { CommerceSelect, CommerceSearch, CommercePagination } from "./controls";
import {
  CommerceButton as Button,
  CommerceEmpty,
  CommerceError,
  CommerceLoading,
  CommerceRefresh,
  CommerceStatus,
  CommerceView,
  CommerceViewSwitch,
} from "./CommerceUi";

export function SaleCard({ item }: { item: SaleItem }) {
  const { c, locale } = useCommerce();
  const { openSale } = useSaleCheckout();
  const sale = localizedSale(item, locale);
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white">
      {sale.imagePresentation?.url && (
        <ContentImage
          metadata={sale.imagePresentation}
          alt={sale.title}
          className="aspect-[16/9] w-full"
        />
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-[#4C7D9D]">
          {c[sale.category as keyof typeof c] || sale.category}
        </p>
        <h3 className="mt-2 break-words text-lg font-semibold leading-7 text-[#10203B]">
          {sale.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
          {sale.shortDescription}
        </p>
        <div className="mt-auto pt-5">
          <p className="flex flex-wrap items-baseline gap-2 text-2xl font-semibold tracking-tight text-[#10203B] tabular-nums">
            {sale.price != null && money(sale.price, sale.currency, locale)}
            {sale.compareAtPrice != null && (
              <del className="text-sm font-normal text-slate-400">
                {money(sale.compareAtPrice, sale.currency, locale)}
              </del>
            )}
          </p>
          <p className="mt-2 min-h-5 text-xs leading-5 text-slate-500">
            {sale.availability
              ? commerceError(sale.availability, c)
              : sale.onePerAccount
                ? c.onePerAccount
                : sale.expiresAt
                  ? `${c.expiresAt}: ${new Date(sale.expiresAt).toLocaleDateString(locale)}`
                  : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <Button
              className="flex-1"
              disabled={Boolean(item.availability)}
              onClick={() => openSale(item.id, true)}
            >
              {sale.ctaLabel || c.purchase}
            </Button>
            <Button variant="outline" onClick={() => openSale(item.id)}>
              {c.viewDetails}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function PurchaseHistory({
  admin = false,
  refreshKey = 0,
}: {
  admin?: boolean;
  refreshKey?: number;
}) {
  const { c, locale } = useCommerce();
  const [data, setData] = useState<{
    items: SaleOrder[];
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    setLoading(true);
    commerceApi<{ items: SaleOrder[]; total: number }>(
      `/api/${admin ? "admin" : "dashboard"}/sales/orders?page=${page}&status=${status}`,
      { signal: abort.signal },
    )
      .then(setData)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.code || "SALES_ERROR");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [admin, page, status, retry, refreshKey]);
  const date = (o: SaleOrder) =>
    new Date(o.paidAt || o.createdAt).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const amount = (o: SaleOrder) => (
    <div className="whitespace-nowrap tabular-nums">
      <span className="font-semibold">
        {money(o.amount, o.currency, locale)}
      </span>
      {o.refundedAmount > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {c.refund}: {money(o.refundedAmount, o.currency, locale)}
        </p>
      )}
    </div>
  );
  const transaction = (o: SaleOrder) => (
    <details className="text-xs text-slate-500">
      <summary className="cursor-pointer py-2 font-medium text-[#4C7D9D] focus-visible:outline-2">
        {c.transaction}
      </summary>
      <div className="max-w-full space-y-1 break-all pb-2 font-mono leading-5">
        <p>{o.id}</p>
        <p>{o.stripePaymentIntentId || o.stripeSessionId}</p>
      </div>
    </details>
  );
  return (
    <div className="space-y-4">
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-3">
        {admin ? (
          <CommerceSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            label={c.status}
            options={[
              "",
              "PENDING",
              "PAID",
              "FAILED",
              "CANCELED",
              "REFUNDED",
            ].map((value) => ({
              value,
              label: value ? c[value as keyof typeof c] : c.allStatuses,
            }))}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#10203B]">
            <ReceiptText aria-hidden className="size-4 text-[#4C7D9D]" />
            {c.purchases}
          </p>
        )}
        <CommerceRefresh active={loading && Boolean(data)} />
      </div>
      {error && (
        <CommerceError
          message={commerceError(error, c)}
          onRetry={() => setRetry((n) => n + 1)}
        />
      )}
      <div aria-busy={loading}>
        {!data && loading ? (
          <CommerceLoading />
        ) : data?.items.length === 0 ? (
          <CommerceEmpty
            title={status ? c.noResults : c.noPurchases}
            description={!admin ? c.emptyPurchasesHelp : undefined}
            action={
              status ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("");
                    setPage(1);
                  }}
                >
                  {c.resetFilters}
                </Button>
              ) : !admin ? (
                <Button asChild variant="outline">
                  <Link href="/dashboard/sales">
                    <ShoppingBag aria-hidden className="size-4" />
                    {c.catalog}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : data && admin ? (
          <AdminTable
            items={data.items}
            getRowKey={(o) => o.id}
            columns={[
              {
                key: "item",
                label: c.title,
                render: (o) => (
                  <div className="min-w-44 max-w-64">
                    <p className="font-semibold">{o.itemTitle}</p>
                    {transaction(o)}
                  </div>
                ),
              },
              {
                key: "buyer",
                label: c.buyer,
                render: (o) => (
                  <span className="break-all">{o.buyerEmail}</span>
                ),
              },
              { key: "amount", label: c.amount, render: amount },
              {
                key: "status",
                label: c.status,
                render: (o) => <CommerceStatus status={o.status} />,
              },
              {
                key: "date",
                label: c.purchaseDate,
                render: (o) => (
                  <span className="whitespace-nowrap text-xs text-slate-500">
                    {date(o)}
                  </span>
                ),
              },
            ]}
          />
        ) : (
          <ul className="space-y-3">
            {data?.items.map((o) => (
              <li
                key={o.id}
                className="rounded-[22px] border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-6 text-[#10203B]">
                      {o.itemTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{date(o)}</p>
                  </div>
                  {amount(o)}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <CommerceStatus status={o.status} />
                  <div className="flex flex-wrap gap-2">
                    {o.status === "PENDING" && (
                      <SaleCheckoutButton saleId={o.saleId} />
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/dashboard/sales?view=purchases&sale=${o.saleId}`}
                      >
                        {c.viewDetails}
                        <ArrowUpRight aria-hidden className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-1">
                  {transaction(o)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data && data.total > 20 && (
        <CommercePagination
          loading={loading}
          page={page}
          total={data.total}
          onChange={setPage}
        />
      )}
    </div>
  );
}

export function DashboardSales() {
  const { c } = useCommerce();
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const q = params.get("q") || "",
    category = params.get("category") || "",
    page = Math.max(1, Number(params.get("page")) || 1),
    history = params.get("view") === "purchases";
  const [data, setData] = useState<{
    items: SaleItem[];
    total: number;
    categories: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      router.replace(pathname + "?" + next.toString(), { scroll: false });
    },
    [params, pathname, router],
  );
  const clearFilters = () => {
    const next = new URLSearchParams(params.toString());
    ["q", "category", "page"].forEach((key) => next.delete(key));
    router.replace(pathname + "?" + next.toString(), { scroll: false });
  };
  useEffect(() => {
    if (history) return;
    const abort = new AbortController();
    setLoading(true);
    setError("");
    commerceApi<{ items: SaleItem[]; total: number; categories: string[] }>(
      `/api/dashboard/sales?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&page=${page}`,
      { signal: abort.signal },
    )
      .then(setData)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.code || "SALES_ERROR");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [q, category, page, history, retry]);
  return (
    <SectionCard className="space-y-5">
      <SectionHeader title={c.sales} description={c.salesIntro} />
      <CommerceViewSwitch
        label={c.sales}
        value={history ? "purchases" : ""}
        onChange={(v) => update("view", v)}
        options={[
          { value: "", label: c.catalog },
          { value: "purchases", label: c.purchases },
        ]}
      />
      <CommerceView viewKey={history ? "purchases" : "catalog"}>
        {history ? (
          <PurchaseHistory />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <CommerceSearch value={q} onChange={(v) => update("q", v)} />
              <CommerceSelect
                label={c.category}
                value={category}
                onChange={(v) => update("category", v)}
                options={[
                  { value: "", label: c.allCategories },
                  ...(data?.categories || []).map((value) => ({
                    value,
                    label: c[value as keyof typeof c] || value,
                  })),
                ]}
              />
            </div>
            <div className="flex min-h-5 items-center justify-between">
              <span className="text-xs text-slate-500">
                {data && data.total > 0
                  ? `${c.totalItems}: ${data.total}`
                  : null}
              </span>
              <CommerceRefresh active={loading && Boolean(data)} />
            </div>
            {error && (
              <CommerceError
                message={commerceError(error, c)}
                onRetry={() => setRetry((n) => n + 1)}
              />
            )}
            <div aria-busy={loading}>
              {!data && loading ? (
                <CommerceLoading />
              ) : data?.items.length === 0 ? (
                <CommerceEmpty
                  title={q || category ? c.noResults : c.empty}
                  description={!q && !category ? c.emptySalesHelp : undefined}
                  action={
                    q || category ? (
                      <Button variant="outline" onClick={clearFilters}>
                        {c.resetFilters}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {data?.items.map((item) => (
                    <SaleCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
            {data && data.total > 20 && (
              <CommercePagination
                loading={loading}
                page={page}
                total={data.total}
                onChange={(v) => update("page", String(v))}
              />
            )}
          </div>
        )}
      </CommerceView>
    </SectionCard>
  );
}
