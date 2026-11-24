"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Heart, List, LoaderCircle, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/lib/locale";
import {
  catalogStats,
  filterCatalog,
  type CatalogFilters,
  type CatalogResult,
  type Listing,
} from "./catalog";
import { CATALOG_REFRESH_MS } from "./config";
import type { CampaignCopy } from "./messages";
import { CatalogCard } from "./CatalogCard";
import styles from "./campaign.module.css";

const EMPTY_FILTERS: CatalogFilters = {
  type: "all",
  specialization: "",
  format: "",
  showDone: false,
};
const PAGE_SIZE = 12;

export function CatalogExperience({
  copy,
  locale,
  previewItems,
  children,
}: {
  copy: CampaignCopy;
  locale: Locale;
  previewItems?: Listing[];
  children: ReactNode;
}) {
  const params = useSearchParams();
  const [result, setResult] = useState<CatalogResult | null>(
    previewItems ? { state: "ready", items: previewItems } : null,
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(!previewItems);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const controller = useRef<AbortController | null>(null);
  const filters: CatalogFilters = {
    type:
      params.get("type") === "offer" || params.get("type") === "request"
        ? (params.get("type") as "offer" | "request")
        : "all",
    specialization: params.get("specialization") ?? "",
    format: ["online", "offline"].includes(params.get("format") ?? "")
      ? params.get("format")!
      : "",
    showDone: params.get("completed") === "1",
  };
  const updateFilters = (patch: Partial<CatalogFilters>) => {
    const next = { ...filters, ...patch };
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      type: next.type === "all" ? "" : next.type,
      specialization: next.specialization,
      format: next.format,
      completed: next.showDone ? "1" : "",
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    setLimit(PAGE_SIZE);
  };
  const refresh = useCallback(async () => {
    if (previewItems || controller.current) return;
    const active = new AbortController();
    controller.current = active;
    const timeout = setTimeout(() => active.abort(), 15_000);
    setBusy(true);
    try {
      const response = await fetch("/api/beauty-gives-back", {
        signal: active.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unavailable");
      const data: CatalogResult = await response.json();
      if (
        !["ready", "unconfigured"].includes(data.state) ||
        !Array.isArray(data.items)
      )
        throw new Error("Invalid response");
      if (controller.current === active) {
        setResult(data);
        setError(false);
      }
    } catch {
      if (controller.current === active) setError(true);
    } finally {
      clearTimeout(timeout);
      if (controller.current === active) {
        controller.current = null;
        setBusy(false);
      }
    }
  }, [previewItems]);
  useEffect(() => {
    if (previewItems) return;
    const initialLoad = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, CATALOG_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      controller.current?.abort();
      controller.current = null;
    };
  }, [previewItems, refresh]);
  const items = result?.items ?? [];
  const matching = filterCatalog(items, filters);
  const visible = matching.slice(0, limit);
  const specializations = [
    ...new Set(items.map((i) => i.specialization).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, locale));
  if (
    filters.specialization &&
    !specializations.includes(filters.specialization)
  )
    specializations.unshift(filters.specialization);
  const stats = catalogStats(items);
  const icons = [List, Heart, UsersRound, Check];
  const formatNumber = (value: number) => value.toLocaleString(locale);
  return (
    <>
      <section className={styles.statsSection} aria-label={copy.catalog}>
        <div className={`${styles.wrap} ${styles.stats}`}>
          {copy.stats.map((label, index) => {
            const Icon = icons[index];
            return (
              <div key={label} className={styles.stat}>
                <Icon aria-hidden="true" size={24} />
                <div>
                  <strong>{result ? formatNumber(stats[index]) : "—"}</strong>
                  <span>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
        {previewItems && (
          <p className={`${styles.wrap} ${styles.previewStats}`}>
            {copy.preview}
          </p>
        )}
      </section>
      {children}
      <section
        className={styles.catalog}
        id="catalog"
        aria-labelledby="catalog-title"
      >
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>Beauty Gives Back</p>
          <h2 className={styles.heading} id="catalog-title">
            {copy.catalog}
          </h2>
          <div className={styles.catalogIntro}>
            <p>{copy.catalogDescription}</p>
            <p role="status">
              {copy.shown}: {formatNumber(visible.length)} /{" "}
              {formatNumber(matching.length)}
            </p>
          </div>
          <div className={styles.filters}>
            <div
              className={styles.segmented}
              role="group"
              aria-label={copy.typeLabel}
            >
              {(["all", "offer", "request"] as const).map((type, index) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={filters.type === type}
                  onClick={() => updateFilters({ type })}
                >
                  {[copy.all, copy.offers, copy.requests][index]}
                </button>
              ))}
            </div>
            <div className={styles.filter}>
              <label id="specialization-label">{copy.specialization}</label>
              <Select
                value={filters.specialization || "all"}
                onValueChange={(value) =>
                  updateFilters({
                    specialization: value === "all" ? "" : value,
                  })
                }
              >
                <SelectTrigger
                  className={styles.select}
                  aria-labelledby="specialization-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className={styles.selectPopup}>
                  <SelectItem value="all">{copy.allSpecializations}</SelectItem>
                  {specializations.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={styles.filter}>
              <label id="format-label">{copy.format}</label>
              <Select
                value={filters.format || "all"}
                onValueChange={(value) =>
                  updateFilters({ format: value === "all" ? "" : value })
                }
              >
                <SelectTrigger
                  className={styles.select}
                  aria-labelledby="format-label"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className={styles.selectPopup}>
                  <SelectItem value="all">{copy.allFormats}</SelectItem>
                  <SelectItem value="online">{copy.online}</SelectItem>
                  <SelectItem value="offline">{copy.offline}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.showDone}
                onChange={(e) => updateFilters({ showDone: e.target.checked })}
              />
              {copy.showDone}
            </label>
          </div>
          {previewItems && <p className={styles.notice}>{copy.preview}</p>}
          <div className={styles.refreshStatus} role="status">
            {busy && result && (
              <>
                <LoaderCircle
                  size={15}
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
                {copy.updating}
              </>
            )}
          </div>
          {error && (
            <div className={styles.error} role="alert">
              <p>{copy.error}</p>
              <button
                className={styles.button}
                type="button"
                disabled={busy}
                onClick={() => void refresh()}
              >
                {copy.retry}
              </button>
            </div>
          )}
          <div aria-busy={busy}>
            {!result && busy ? (
              <div className={styles.empty} role="status">
                <LoaderCircle
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
                {copy.loading}
              </div>
            ) : result?.state === "unconfigured" ? (
              <div className={styles.empty}>{copy.unconfigured}</div>
            ) : result && !matching.length ? (
              <div className={styles.empty}>
                <p>{items.length ? copy.noResults : copy.empty}</p>
                {items.length > 0 && (
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => updateFilters(EMPTY_FILTERS)}
                  >
                    {copy.reset}
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.grid}>
                {visible.map((item) => (
                  <CatalogCard key={item.id} item={item} copy={copy} />
                ))}
              </div>
            )}
          </div>
          {matching.length > visible.length && (
            <button
              type="button"
              className={`${styles.button} ${styles.loadMore}`}
              onClick={() => setLimit((value) => value + PAGE_SIZE)}
            >
              {copy.loadMore}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
