"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useEffect, useState } from "react";
import {
  CommerceButton as Button,
  CommerceLoading,
  CommerceRefresh,
  CommerceError,
} from "@/features/sales/CommerceUi";
import { useCommerce } from "@/features/sales/messages";
import { commerceApi } from "@/features/sales/api";
import { type SaleItem, money } from "@/features/sales/types";
import { CommerceSearch, CommercePagination } from "@/features/sales/controls";
export function SaleSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null, item?: SaleItem) => void;
}) {
  const { c, locale } = useCommerce();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] = useState<{ items: SaleItem[]; total: number } | null>(
      null,
    ),
    [selected, setSelected] = useState<SaleItem | null>(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    setLoading(true);
    commerceApi<{ items: SaleItem[]; total: number }>(
      `/api/admin/sales?status=PUBLISHED&q=${encodeURIComponent(q)}&page=${page}`,
      { signal: abort.signal },
    )
      .then(setData)
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [q, page, revision]);
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const abort = new AbortController();
    commerceApi<{ item: SaleItem }>(`/api/admin/sales/${value}`, {
      signal: abort.signal,
    })
      .then((r) => setSelected(r.item))
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [value]);
  return (
    <fieldset className="space-y-3 rounded-2xl border border-[#D4E0F0] bg-[#F8FBFF] p-4">
      <legend className="px-1 text-sm font-medium">{c.linkedSale}</legend>
      <CommerceSearch
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
      />
      {selected && (
        <p className="text-sm font-medium">
          {selected.title}{" "}
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            {c.cancel}
          </Button>
        </p>
      )}
      <CommerceRefresh active={loading && Boolean(data)} />
      {error ? (
        <CommerceError
          message={c.error}
          onRetry={() => setRevision((n) => n + 1)}
        />
      ) : !data ? (
        <CommerceLoading compact />
      ) : (
        <div
          role="radiogroup"
          aria-label={c.selectSale}
          className="max-h-56 space-y-2 overflow-y-auto"
        >
          {data.items.map((item) => (
            <label
              key={item.id}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${value === item.id ? "border-[#21466D] bg-[#EEF6FF]" : "border-[#D4E0F0] bg-white hover:border-[#8AA2BD]"}`}
            >
              <input
                className="size-4 shrink-0 accent-[#21466D]"
                type="radio"
                name="linked-sale"
                value={item.id}
                checked={value === item.id}
                onChange={() => {
                  setSelected(item);
                  onChange(item.id, item);
                }}
              />
              <span className="flex-1">{item.title}</span>
              <span>
                {item.price != null
                  ? money(item.price, item.currency, locale)
                  : ""}
              </span>
            </label>
          ))}
          {!data.items.length && <p>{c.empty}</p>}
        </div>
      )}
      {data && data.total > 20 && (
        <CommercePagination
          loading={loading}
          page={page}
          total={data.total}
          onChange={setPage}
        />
      )}
    </fieldset>
  );
}
