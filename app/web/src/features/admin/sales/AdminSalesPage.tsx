"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentImage } from "@/components/content/ContentImage";
import { AdminPageShell } from "@/features/admin/shared/components/AdminPageShell";
import { commerceApi } from "@/features/sales/api";
import { useCommerce, commerceError } from "@/features/sales/messages";
import { type SaleItem, money } from "@/features/sales/types";
import {
  CommerceSelect,
  CommerceSearch,
  CommercePagination,
} from "@/features/sales/controls";
import { PurchaseHistory } from "@/features/sales/DashboardSales";
import { SaleSummary } from "@/features/sales/SalePurchaseProvider";
import { SaleEditor, blankSale } from "./SaleEditor";
type Catalog = {
  items: SaleItem[];
  total: number;
  stats: {
    total: number;
    published: number;
    drafts: number;
    purchases: number;
    revenue: string;
    currency: string;
  };
};
export function AdminSalesPage() {
  const { c, locale } = useCommerce();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") || "",
    status = params.get("status") || "",
    page = Math.max(1, Number(params.get("page")) || 1),
    orders = params.get("view") === "orders";
  const [data, setData] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<SaleItem | null>(null),
    [preview, setPreview] = useState<SaleItem | null>(null),
    [busy, setBusy] = useState(false);
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
    const abort = new AbortController();
    setLoading(true);
    setError("");
    commerceApi<Catalog>(
      `/api/admin/sales?q=${encodeURIComponent(q)}&status=${status}&page=${page}`,
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
  }, [q, status, page, revision]);
  async function mutate(item: SaleItem, action: string) {
    setBusy(true);
    try {
      await commerceApi(
        `/api/admin/sales/${item.id}${action === "duplicate" ? "/duplicate" : ""}`,
        {
          method: action === "duplicate" ? "POST" : "PATCH",
          body: JSON.stringify({
            ...item,
            status:
              action === "archive"
                ? "ARCHIVED"
                : action === "publish"
                  ? "PUBLISHED"
                  : "DRAFT",
          }),
        },
      );
      setRevision((n) => n + 1);
      toast.success(c.saveSuccess);
    } catch (e) {
      setError((e as { code?: string }).code || "SALES_ERROR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPageShell
      title={c.sales}
      actions={
        <Button onClick={() => setEditing(blankSale())}>{c.create}</Button>
      }
    >
      {data && (
        <dl className="flex flex-wrap gap-x-8 gap-y-4 rounded-2xl border border-[#D4E0F0] bg-white p-5">
          {[
            [c.totalItems, data.stats.total],
            [c.PUBLISHED, data.stats.published],
            [c.DRAFT, data.stats.drafts],
            [c.completed, data.stats.purchases],
            [c.revenue, money(data.stats.revenue, "usd", locale)],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="space-y-5 rounded-2xl border border-[#D4E0F0] bg-white p-5">
        <div className="flex flex-wrap gap-3">
          <Button
            variant={orders ? "outline" : "default"}
            onClick={() => update("view", "")}
          >
            {c.catalog}
          </Button>
          <Button
            variant={orders ? "default" : "outline"}
            onClick={() => update("view", "orders")}
          >
            {c.allPurchases}
          </Button>
        </div>
        {orders ? (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await commerceApi("/api/admin/sales/reconcile", {
                    method: "POST",
                    body: "{}",
                  });
                  toast.success(c.reconciled);
                  setRevision((n) => n + 1);
                } catch {
                  setError("SALES_ERROR");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {c.reconcile}
            </Button>
            <PurchaseHistory key={revision} admin />
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <CommerceSearch
                value={q}
                onChange={(value) => update("q", value)}
              />
              <CommerceSelect
                label={c.status}
                value={status}
                onChange={(value) => update("status", value)}
                options={["", "DRAFT", "PUBLISHED", "ARCHIVED"].map(
                  (value) => ({
                    value,
                    label: value ? c[value as keyof typeof c] : c.all,
                  }),
                )}
              />
            </div>
            {loading && (
              <div role="status" className="h-24 animate-pulse bg-slate-100">
                {c.loading}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    {[
                      c.title,
                      c.price,
                      c.status,
                      c.completed,
                      c.createdAt,
                      c.actionType,
                    ].map((label) => (
                      <th key={label} className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((item) => (
                    <tr className="border-b align-top" key={item.id}>
                      <td className="min-w-52 p-3">
                        <div className="flex gap-3">
                          {item.imagePresentation && (
                            <ContentImage
                              metadata={item.imagePresentation}
                              alt={item.title}
                              className="h-12 w-16 shrink-0 rounded-lg"
                            />
                          )}
                          <span>{item.title}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {item.price != null
                          ? money(item.price, "usd", locale)
                          : "—"}
                      </td>
                      <td className="p-3">
                        {c[item.status as keyof typeof c]}
                      </td>
                      <td className="p-3">{item.purchases || 0}</td>
                      <td className="whitespace-nowrap p-3">
                        {new Date(item.createdAt).toLocaleDateString(locale)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(item)}
                          >
                            {c.edit}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreview(item)}
                          >
                            {c.preview}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void mutate(item, "duplicate")}
                          >
                            {c.duplicate}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                item,
                                item.status === "PUBLISHED"
                                  ? "unpublish"
                                  : "publish",
                              )
                            }
                          >
                            {item.status === "PUBLISHED"
                              ? c.unpublish
                              : c.publish}
                          </Button>
                          {item.status !== "ARCHIVED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void mutate(item, "archive")}
                            >
                              {c.archive}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && data?.items.length === 0 && (
                <p className="py-12 text-center text-slate-500">{c.empty}</p>
              )}
            </div>
            {data && (
              <CommercePagination
                page={page}
                total={data.total}
                onChange={(v) => update("page", String(v))}
              />
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {commerceError(error, c)}{" "}
            <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
              {c.retry}
            </Button>
          </p>
        )}
      </div>
      {editing && (
        <SaleEditor
          key={editing.id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent
          closeLabel={c.close}
          className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl"
        >
          <DialogTitle>{preview?.title}</DialogTitle>
          <DialogDescription>{c.preview}</DialogDescription>
          {preview && <SaleSummary item={preview} full />}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
