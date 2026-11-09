"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Archive,
  Eye,
  MoreHorizontal,
  Pencil,
  Send,
  RotateCw,
  ShoppingBag,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { AdminSectionCard } from "@/features/admin/shared/components/AdminSectionCard";
import { AdminMetricCard } from "@/features/admin/shared/components/AdminMetricCard";
import { AdminTable } from "@/features/admin/shared/components/AdminTable";
import {
  CommerceButton as Button,
  CommerceLoading,
  CommerceError,
  CommerceEmpty,
  CommerceRefresh,
  CommerceStatus,
  CommerceView,
  CommerceViewSwitch,
  commerceDialogClassName,
} from "@/features/sales/CommerceUi";
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
  const clearFilters = () => {
    const next = new URLSearchParams(params.toString());
    ["q", "status", "page"].forEach((key) => next.delete(key));
    router.replace(pathname + "?" + next.toString(), { scroll: false });
  };
  const menuItemClass =
    "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-[#EEF6FF] data-[disabled]:pointer-events-none data-[disabled]:opacity-50";
  return (
    <AdminPageShell
      title={c.sales}
      subtitle={c.adminSalesIntro}
      actions={
        <Button onClick={() => setEditing(blankSale())}>
          <Plus aria-hidden className="size-4" />
          {c.create}
        </Button>
      }
    >
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
        aria-busy={loading && !data}
      >
        {[
          [c.totalItems, data?.stats.total],
          [c.PUBLISHED, data?.stats.published],
          [c.DRAFT, data?.stats.drafts],
          [c.completed, data?.stats.purchases],
          [
            c.revenue,
            data ? money(data.stats.revenue, "usd", locale) : undefined,
          ],
        ].map(([label, value]) => (
          <AdminMetricCard
            key={String(label)}
            label={String(label)}
            value={value ?? "—"}
          />
        ))}
      </div>
      <AdminSectionCard contentClassName="space-y-5">
        <CommerceViewSwitch
          label={c.sales}
          value={orders ? "orders" : ""}
          onChange={(v) => update("view", v)}
          options={[
            { value: "", label: c.sales },
            { value: "orders", label: c.allPurchases },
          ]}
        />
        {error && (
          <CommerceError
            message={commerceError(error, c)}
            onRetry={() => setRevision((n) => n + 1)}
          />
        )}
        <CommerceView viewKey={orders ? "orders" : "catalog"}>
          {orders ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  busy={busy}
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
                  <RotateCw aria-hidden className="size-4" />
                  {c.reconcile}
                </Button>
              </div>
              <PurchaseHistory refreshKey={revision} admin />
            </div>
          ) : (
            <div className="space-y-4">
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
                      label: value ? c[value as keyof typeof c] : c.allStatuses,
                    }),
                  )}
                />
              </div>
              <div className="flex min-h-5 items-center justify-between">
                <p className="text-xs text-[#6C7F95]">
                  {data ? `${c.totalItems}: ${data.total}` : null}
                </p>
                <CommerceRefresh active={Boolean(data) && (loading || busy)} />
              </div>
              <div aria-busy={loading}>
                {!data && loading ? (
                  <CommerceLoading />
                ) : data?.items.length === 0 ? (
                  <CommerceEmpty
                    title={q || status ? c.noResults : c.empty}
                    action={
                      <Button
                        variant="outline"
                        onClick={
                          q || status
                            ? clearFilters
                            : () => setEditing(blankSale())
                        }
                      >
                        {q || status ? c.resetFilters : c.create}
                      </Button>
                    }
                  />
                ) : (
                  data && (
                    <AdminTable
                      items={data.items}
                      getRowKey={(item) => item.id}
                      columns={[
                        {
                          key: "item",
                          label: c.title,
                          render: (item) => (
                            <div className="flex min-w-56 max-w-80 items-center gap-3">
                              {item.imagePresentation ? (
                                <ContentImage
                                  metadata={item.imagePresentation}
                                  alt=""
                                  className="h-12 w-16 shrink-0 rounded-xl"
                                />
                              ) : (
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#4C7D9D]">
                                  <ShoppingBag aria-hidden className="size-5" />
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold leading-5">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs text-[#6C7F95]">
                                  {c[item.category as keyof typeof c] ||
                                    item.category}
                                </p>
                              </div>
                            </div>
                          ),
                        },
                        {
                          key: "price",
                          label: c.price,
                          render: (item) => (
                            <span className="whitespace-nowrap font-semibold tabular-nums">
                              {item.price != null
                                ? money(item.price, "usd", locale)
                                : "—"}
                            </span>
                          ),
                        },
                        {
                          key: "status",
                          label: c.status,
                          render: (item) => (
                            <CommerceStatus status={item.status} />
                          ),
                        },
                        {
                          key: "purchases",
                          label: c.allPurchases,
                          render: (item) => (
                            <span className="tabular-nums">
                              {item.purchases || 0}
                            </span>
                          ),
                        },
                        {
                          key: "date",
                          label: c.createdAt,
                          render: (item) => (
                            <span className="whitespace-nowrap text-xs text-[#6C7F95]">
                              {new Date(item.createdAt).toLocaleDateString(
                                locale,
                              )}
                            </span>
                          ),
                        },
                        {
                          key: "actions",
                          label: c.actionType,
                          render: (item) => (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(item)}
                              >
                                <Pencil aria-hidden className="size-3.5" />
                                {c.edit}
                              </Button>
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`${c.moreActions}: ${item.title}`}
                                    className="size-10 min-h-10 p-0"
                                  >
                                    <MoreHorizontal
                                      aria-hidden
                                      className="size-4"
                                    />
                                  </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    sideOffset={6}
                                    collisionPadding={12}
                                    className="admin-theme z-50 min-w-48 rounded-2xl border border-[#D4E0F0] bg-white p-1.5 text-[#10203B] shadow-lg"
                                  >
                                    <DropdownMenu.Item
                                      className={menuItemClass}
                                      onSelect={() => setPreview(item)}
                                    >
                                      <Eye aria-hidden className="size-4" />
                                      {c.preview}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className={menuItemClass}
                                      disabled={busy}
                                      onSelect={() =>
                                        void mutate(item, "duplicate")
                                      }
                                    >
                                      <Copy aria-hidden className="size-4" />
                                      {c.duplicate}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className={menuItemClass}
                                      disabled={busy}
                                      onSelect={() =>
                                        void mutate(
                                          item,
                                          item.status === "PUBLISHED"
                                            ? "unpublish"
                                            : "publish",
                                        )
                                      }
                                    >
                                      <Send aria-hidden className="size-4" />
                                      {item.status === "PUBLISHED"
                                        ? c.unpublish
                                        : c.publish}
                                    </DropdownMenu.Item>
                                    {item.status !== "ARCHIVED" && (
                                      <>
                                        <DropdownMenu.Separator className="my-1 border-t border-[#E4EEF8]" />
                                        <DropdownMenu.Item
                                          className={menuItemClass}
                                          disabled={busy}
                                          onSelect={() =>
                                            void mutate(item, "archive")
                                          }
                                        >
                                          <Archive
                                            aria-hidden
                                            className="size-4"
                                          />
                                          {c.archive}
                                        </DropdownMenu.Item>
                                      </>
                                    )}
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
                            </div>
                          ),
                        },
                      ]}
                    />
                  )
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
      </AdminSectionCard>
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
        <DialogContent closeLabel={c.close} className={commerceDialogClassName}>
          <DialogTitle className="pr-8 text-xl font-semibold">
            {preview?.title}
          </DialogTitle>
          <DialogDescription>{c.preview}</DialogDescription>
          {preview && <SaleSummary item={preview} full />}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
