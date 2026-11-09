"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    commerceApi<{ items: SaleItem[]; total: number }>(
      `/api/admin/sales?status=PUBLISHED&q=${encodeURIComponent(q)}&page=${page}`,
      { signal: abort.signal },
    )
      .then(setData)
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
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
    <fieldset className="space-y-3 rounded-xl border p-4">
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
      {error ? (
        <p role="alert">
          {c.error}
          <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
            {c.retry}
          </Button>
        </p>
      ) : !data ? (
        <p role="status">{c.loading}</p>
      ) : (
        <div
          role="radiogroup"
          aria-label={c.selectSale}
          className="max-h-56 space-y-2 overflow-y-auto"
        >
          {data.items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <input
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
        <CommercePagination page={page} total={data.total} onChange={setPage} />
      )}
    </fieldset>
  );
}
