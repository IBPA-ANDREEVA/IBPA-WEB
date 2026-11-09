"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  SectionCard,
  SectionHeader,
} from "@/shared/components/DashboardShared";
import { useCommerce, commerceError } from "./messages";
import { commerceApi } from "./api";
import { type SaleItem, type SaleOrder, localizedSale, money } from "./types";
import {
  SaleSummary,
  useSaleCheckout,
  SaleCheckoutButton,
} from "./SalePurchaseProvider";
import { CommerceSelect, CommerceSearch, CommercePagination } from "./controls";
export function SaleCard({ item }: { item: SaleItem }) {
  const { c, locale } = useCommerce();
  const { openSale } = useSaleCheckout();
  const sale = localizedSale(item, locale);
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[#D4E0F0] bg-white p-5">
      <div>
        <p className="text-xs text-slate-500">
          {c[sale.category as keyof typeof c] || sale.category}
        </p>
        <h2 className="mt-1 text-lg font-semibold break-words">{sale.title}</h2>
      </div>
      <SaleSummary item={item} />
      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => openSale(item.id)}>
          {c.viewDetails}
        </Button>
        <Button
          disabled={Boolean(item.availability)}
          onClick={() => openSale(item.id, true)}
        >
          {sale.ctaLabel || c.purchase}
        </Button>
      </div>
    </article>
  );
}
export function PurchaseHistory({ admin = false }: { admin?: boolean }) {
  const { c, locale } = useCommerce();
  const [data, setData] = useState<{
    items: SaleOrder[];
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    commerceApi<{ items: SaleOrder[]; total: number }>(
      `/api/${admin ? "admin" : "dashboard"}/sales/orders?page=${page}&status=${status}`,
      { signal: abort.signal },
    )
      .then(setData)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.code || "SALES_ERROR");
      });
    return () => abort.abort();
  }, [admin, page, status, retry]);
  return (
    <div className="space-y-4">
      {admin && (
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
            label: value ? c[value as keyof typeof c] : c.all,
          }))}
        />
      )}{" "}
      {error && (
        <p role="alert">
          {commerceError(error, c)}{" "}
          <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
            {c.retry}
          </Button>
        </p>
      )}
      {!data && !error ? (
        <p role="status">{c.loading}</p>
      ) : data?.items.length === 0 ? (
        <p className="py-12 text-center text-slate-500">{c.noPurchases}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3">{c.title}</th>
                {admin && <th className="p-3">{c.buyer}</th>}
                <th className="p-3">{c.amount}</th>
                <th className="p-3">{c.status}</th>
                <th className="p-3">{c.purchaseDate}</th>
                <th className="p-3">{c.transaction}</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((o) => (
                <tr key={o.id} className="border-b align-top">
                  <td className="p-3">
                    <p>{o.itemTitle}</p>
                    {!admin && (
                      <a
                        className="underline"
                        href={`/dashboard/sales?sale=${o.saleId}`}
                      >
                        {c.viewDetails}
                      </a>
                    )}
                  </td>
                  {admin && <td className="p-3">{o.buyerEmail}</td>}
                  <td className="p-3 whitespace-nowrap">
                    {money(o.amount, o.currency, locale)}
                    {o.refundedAmount > 0 && (
                      <p>
                        {c.refund}:{" "}
                        {money(o.refundedAmount, o.currency, locale)}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    {c[o.status as keyof typeof c] || o.status}
                    {!admin && o.status === "PENDING" && (
                      <SaleCheckoutButton saleId={o.saleId} />
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {o.paidAt ? new Date(o.paidAt).toLocaleString(locale) : "—"}
                  </td>
                  <td className="max-w-52 break-all p-3 text-xs">
                    <p>{o.id}</p>
                    <p className="mt-1 text-slate-500">
                      {o.stripePaymentIntentId || o.stripeSessionId}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <CommercePagination page={page} total={data.total} onChange={setPage} />
      )}
    </div>
  );
}
export function DashboardSales() {
  const { c } = useCommerce();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
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
  const [loading, setLoading] = useState(false);
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
    <SectionCard>
      <SectionHeader title={c.sales} />
      <div className="my-5 flex flex-wrap gap-3">
        <Button
          variant={history ? "outline" : "default"}
          onClick={() => update("view", "")}
        >
          {c.catalog}
        </Button>
        <Button
          variant={history ? "default" : "outline"}
          onClick={() => update("view", "purchases")}
        >
          {c.purchases}
        </Button>
      </div>
      {history ? (
        <PurchaseHistory />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <CommerceSearch
              key="catalog-search"
              value={q}
              onChange={(v) => update("q", v)}
            />
            <CommerceSelect
              label={c.category}
              value={category}
              onChange={(v) => update("category", v)}
              options={[
                { value: "", label: c.all },
                ...(data?.categories || []).map((value) => ({
                  value,
                  label: c[value as keyof typeof c] || value,
                })),
              ]}
            />
          </div>
          {error && (
            <p role="alert">
              {commerceError(error, c)}{" "}
              <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
                {c.retry}
              </Button>
            </p>
          )}
          {loading && (
            <div
              role="status"
              className="h-24 animate-pulse rounded-xl bg-slate-100"
            >
              {c.loading}
            </div>
          )}
          {!loading && data?.items.length === 0 && (
            <p className="py-12 text-center text-slate-500">{c.empty}</p>
          )}
          <div aria-busy={loading} className="grid gap-5 md:grid-cols-2">
            {data?.items.map((item) => (
              <SaleCard key={item.id} item={item} />
            ))}
          </div>
          {data && (
            <CommercePagination
              page={page}
              total={data.total}
              onChange={(v) => update("page", String(v))}
            />
          )}
        </div>
      )}
    </SectionCard>
  );
}
