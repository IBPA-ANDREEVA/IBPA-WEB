"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ContentImage } from "@/components/content/ContentImage";
import { commerceApi, CommerceApiError } from "./api";
import { useCommerce, commerceError } from "./messages";
import { localizedSale, money, type SaleItem, type SaleOrder } from "./types";

type PurchaseContext = { openSale: (id: string, confirm?: boolean) => void };
const Context = createContext<PurchaseContext | null>(null);
export function useSaleCheckout() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing SalePurchaseProvider");
  return context;
}
export function SaleSummary({
  item,
  full = false,
}: {
  item: SaleItem;
  full?: boolean;
}) {
  const { c, locale } = useCommerce();
  const sale = localizedSale(item, locale);
  return (
    <div className="space-y-4">
      {sale.imagePresentation?.url && (
        <div className="overflow-hidden rounded-xl">
          <ContentImage metadata={sale.imagePresentation} alt={sale.title} />
        </div>
      )}
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
        {full ? sale.description : sale.shortDescription}
      </p>
      {sale.price != null && (
        <p className="text-xl font-semibold tabular-nums">
          {money(sale.price, sale.currency, locale)}{" "}
          {sale.compareAtPrice != null && (
            <del className="ml-2 text-sm font-normal text-slate-500">
              {money(sale.compareAtPrice, sale.currency, locale)}
            </del>
          )}
        </p>
      )}
      {sale.onePerAccount && <p className="text-sm">{c.onePerAccount}</p>}
      {sale.expiresAt && (
        <p className="text-sm">
          {c.expiresAt}: {new Date(sale.expiresAt).toLocaleString(locale)}
        </p>
      )}
      {full &&
        sale.events?.map((event) => (
          <div key={event.id} className="border-t pt-3 text-sm">
            <Link
              className="underline"
              href={`/dashboard?tab=events&event=${event.id}`}
            >
              {event.title}
            </Link>
            {event.eventDate && (
              <p>{new Date(event.eventDate).toLocaleString(locale)}</p>
            )}
            <p>{event.eventAddress}</p>
          </div>
        ))}
      {sale.availability && (
        <p role="status" className="text-sm text-slate-600">
          {commerceError(sale.availability, c)}
        </p>
      )}
    </div>
  );
}
export function SalePurchaseProvider({ children }: { children: ReactNode }) {
  const { c, locale } = useCommerce();
  const params = useSearchParams();
  const pathname = usePathname();
  const [id, setId] = useState<string | null>(null);
  const [item, setItem] = useState<SaleItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const request = useRef<{ sale: string; key: string } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);
  const openSale = useCallback((saleId: string, purchase = false) => {
    previousFocus.current = document.activeElement as HTMLElement;
    setItem(null);
    setError("");
    setLoading(true);
    setId(saleId);
    setConfirm(purchase);
  }, []);
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    commerceApi<{ item: SaleItem }>(`/api/dashboard/sales/${id}`, {
      signal: abort.signal,
    })
      .then((result) => setItem(result.item))
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.code || "SALES_ERROR");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [id, reload]);
  useEffect(() => {
    const sale = params.get("sale");
    if (sale && !params.has("order")) openSale(sale);
  }, [params, openSale]);
  async function checkout() {
    if (!item || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    if (request.current?.sale !== item.id)
      request.current = { sale: item.id, key: crypto.randomUUID() };
    try {
      const result = await commerceApi<{ url: string }>(
        `/api/dashboard/sales/${item.id}/checkout`,
        {
          method: "POST",
          body: JSON.stringify({
            requestKey: request.current.key,
            returnPath:
              pathname + (params.toString() ? "?" + params.toString() : ""),
            locale,
          }),
        },
      );
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("Invalid checkout URL");
      window.location.assign(result.url);
    } catch (e) {
      const code = e instanceof CommerceApiError ? e.code : "SALES_ERROR";
      setError(code);
      if (code === "CHECKOUT_ENDED") request.current = null;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  return (
    <Context.Provider value={{ openSale }}>
      {children}
      <PurchaseReturn key={params.get("order") || "none"} />
      <Dialog
        open={Boolean(id)}
        onOpenChange={(open) => {
          if (!open && !busy) setId(null);
        }}
      >
        <DialogContent
          closeLabel={c.close}
          className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            previousFocus.current?.focus();
          }}
        >
          <DialogTitle className="pr-10 text-xl font-semibold">
            {confirm
              ? c.confirmPurchase
              : item
                ? localizedSale(item, locale).title
                : c.viewDetails}
          </DialogTitle>
          <DialogDescription>
            {confirm ? c.paymentNotice : c.conditions}
          </DialogDescription>
          {loading ? (
            <div
              role="status"
              className="h-48 animate-pulse rounded-xl bg-slate-100"
            >
              {c.loading}
            </div>
          ) : item ? (
            <>
              <h3 className="font-semibold">
                {confirm ? localizedSale(item, locale).title : null}
              </h3>
              <SaleSummary item={item} full={!confirm} />
            </>
          ) : null}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {commerceError(error, c)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setId(null)}
              disabled={busy}
            >
              {c.cancel}
            </Button>
            {!item && error && (
              <Button
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setReload((v) => v + 1);
                }}
              >
                {c.retry}
              </Button>
            )}
            {item && (
              <Button
                disabled={
                  busy || Boolean(item.availability) || item.price == null
                }
                onClick={() => (confirm ? void checkout() : setConfirm(true))}
              >
                {busy
                  ? c.loading
                  : confirm
                    ? c.continueStripe
                    : localizedSale(item, locale).ctaLabel || c.purchase}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
export function SaleCheckoutButton({
  saleId,
  label,
}: {
  saleId: string;
  label?: string;
}) {
  const { openSale } = useSaleCheckout();
  const { c } = useCommerce();
  return (
    <Button onClick={() => openSale(saleId, true)}>
      {label || c.purchase}
    </Button>
  );
}
function PurchaseReturn() {
  const params = useSearchParams();
  const router = useRouter(),
    pathname = usePathname();
  const { c, locale } = useCommerce();
  const id = params.get("order");
  const canceled = params.get("payment") === "canceled";
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!id) return;
    let stopped = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const poll = async () => {
      try {
        const result = await commerceApi<{ order: SaleOrder }>(
          `/api/dashboard/sales/orders/${id}${canceled && attempts === 0 ? "/cancel" : ""}`,
          {
            method: canceled && attempts === 0 ? "POST" : "GET",
            signal: abort.signal,
          },
        );
        if (stopped) return;
        setOrder(result.order);
        setError(false);
        attempts++;
        if (result.order.status === "PENDING" && attempts < 40)
          timer = setTimeout(poll, 3000);
      } catch {
        if (!stopped) setError(true);
      }
    };
    void poll();
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [id, canceled, retry]);
  if (!id || dismissed === id) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setDismissed(id);
          const next = new URLSearchParams(params.toString());
          for (const key of ["order", "payment", "session_id"])
            next.delete(key);
          router.replace(pathname + (next.size ? "?" + next.toString() : ""), {
            scroll: false,
          });
        }
      }}
    >
      <DialogContent closeLabel={c.close} className="max-w-lg rounded-2xl">
        <DialogTitle className="pr-10 text-xl font-semibold">
          {c.purchases}
        </DialogTitle>
        <DialogDescription>
          {error
            ? c.error
            : order?.status === "PAID"
              ? c.paymentSuccess
              : order?.status === "CANCELED"
                ? c.paymentCanceled
                : order?.status === "FAILED"
                  ? c.paymentFailed
                  : order?.status === "REFUNDED"
                    ? c.REFUNDED
                    : c.paymentPending}
        </DialogDescription>
        {order && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">{order.itemTitle}</p>
            <p>{money(order.amount, order.currency, locale)}</p>
            <p className="break-all">
              {c.transaction}: {order.id}
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
            {c.retry}
          </Button>
          <Button asChild>
            <Link
              href="/dashboard/sales?view=purchases"
              onClick={() => setDismissed(id)}
            >
              {c.purchases}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
