"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { DashboardNotification } from "@/lib/notifications";
import { commerceApi } from "@/features/sales/api";
import { useCommerce, commerceError } from "@/features/sales/messages";
import { localizedSale, type SaleItem } from "@/features/sales/types";
import {
  SaleSummary,
  useSaleCheckout,
} from "@/features/sales/SalePurchaseProvider";
export type Notification = DashboardNotification & {
  actionType?: string;
  linkedSaleId?: string | null;
  linkedEventId?: string | null;
  toasted?: boolean;
  translations?: SaleItem["translations"];
};
type Feed = {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  page: number;
  pageSize: number;
};
type ContextValue = {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  open: (n: Notification) => void;
  revision: number;
};
const Context = createContext<ContextValue | null>(null);
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing NotificationProvider");
  return value;
}
export function safeNotificationLink(
  value: unknown,
  internal = false,
): value is string {
  if (typeof value !== "string" || /[\\\u0000-\u0020]/.test(value))
    return false;
  if (internal)
    return (
      /^\/dashboard(?:[/?#]|$)/.test(value) &&
      !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(value)
    );
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user } = useUser();
  const { c, locale } = useCommerce();
  const params = useSearchParams();
  const [items, setItems] = useState<Notification[]>([]),
    [unreadCount, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [selected, setSelected] = useState<Notification | null>(null),
    [detailError, setDetailError] = useState(false),
    [revision, setRevision] = useState(0);
  const focus = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  const started = useRef(0);
  const generation = useRef(0);
  const openedParam = useRef<string | null>(null);
  const markRead = useCallback(
    async (ids?: string[]) => {
      const operation = ++generation.current;
      const selectedIds = new Set(ids);
      const previousItems = items,
        previousCount = unreadCount;
      setItems((current) =>
        current.map((n) =>
          !ids || selectedIds.has(n.id) ? { ...n, unread: false } : n,
        ),
      );
      setCount((current) =>
        ids
          ? Math.max(
              0,
              current -
                items.filter((n) => n.unread && selectedIds.has(n.id)).length,
            )
          : 0,
      );
      try {
        await commerceApi("/api/dashboard/notifications", {
          method: "PATCH",
          body: JSON.stringify(ids ? { ids } : { all: true }),
        });
        setRevision((n) => n + 1);
        const latest = await commerceApi<Feed>("/api/dashboard/notifications");
        if (generation.current === operation) {
          setItems(latest.notifications);
          setCount(latest.unreadCount);
        }
      } catch {
        if (generation.current === operation) {
          setItems(previousItems);
          setCount(previousCount);
        }
        toast.error(c.error);
      }
    },
    [items, unreadCount, c.error],
  );
  const open = useCallback(
    (n: Notification) => {
      focus.current = document.activeElement as HTMLElement;
      setSelected(n);
      setDetailError(false);
      if (n.unread) void markRead([n.id]);
    },
    [markRead],
  );
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const refresh = useCallback(async () => {
    if (!isSignedIn) return;
    const version = generation.current;
    try {
      const data = await commerceApi<Feed>("/api/dashboard/notifications");
      if (!mounted.current || version !== generation.current) return;
      setItems(data.notifications);
      setCount(data.unreadCount);
      setError(false);
      const fresh = data.notifications.filter(
        (n) =>
          n.unread &&
          !n.toasted &&
          new Date(n.timestamp).getTime() > started.current,
      );
      if (fresh.length) {
        const claimed = await commerceApi<{ updatedIds: string[] }>(
          "/api/dashboard/notifications",
          {
            method: "PATCH",
            body: JSON.stringify({
              ids: fresh.map((n) => n.id),
              mode: "toast",
            }),
          },
        );
        if (!mounted.current) return;
        for (const n of fresh
          .filter((n) => claimed.updatedIds.includes(n.id))
          .slice(0, 3))
          toast(localizedSale(n, locale).title, {
            id: `notification-${n.id}`,
            description: localizedSale(n, locale).description.slice(0, 120),
            action: { label: c.viewDetails, onClick: () => openRef.current(n) },
            duration: 7000,
          });
      }
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [isSignedIn, c.viewDetails, locale]);
  useEffect(() => {
    generation.current++;
    mounted.current = true;
    started.current = Date.now();
    setItems([]);
    setCount(0);
    setLoading(true);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [user?.id, refresh]);
  useEffect(() => {
    const id = params.get("notification");
    if (!id || openedParam.current === id || !isSignedIn) return;
    openedParam.current = id;
    const abort = new AbortController();
    commerceApi<Feed>(
      `/api/dashboard/notifications?id=${encodeURIComponent(id)}`,
      { signal: abort.signal },
    )
      .then((data) => {
        if (data.notifications[0]) openRef.current(data.notifications[0]);
        else setDetailError(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setDetailError(true);
      });
    return () => abort.abort();
  }, [params, isSignedIn]);
  const display = selected ? localizedSale(selected, locale) : null;
  return (
    <Context.Provider
      value={{
        items,
        unreadCount,
        loading,
        error,
        refresh,
        markRead,
        open,
        revision,
      }}
    >
      {children}
      <Dialog
        open={Boolean(selected) || detailError}
        onOpenChange={(value) => {
          if (!value) {
            setSelected(null);
            setDetailError(false);
          }
        }}
      >
        <DialogContent
          closeLabel={c.close}
          className="max-h-[90dvh] max-w-xl overflow-y-auto rounded-2xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            focus.current?.focus();
          }}
        >
          <DialogTitle className="pr-10 text-xl font-semibold">
            {display?.title || c.notifications}
          </DialogTitle>
          <DialogDescription>
            {display
              ? new Date(display.timestamp).toLocaleString(locale)
              : c.error}
          </DialogDescription>
          {display && (
            <>
              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                {display.description}
              </p>
              <NotificationAction
                item={display}
                onNavigate={() => setSelected(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
export function LinkedSale({ id }: { id: string }) {
  const { c } = useCommerce();
  const { openSale } = useSaleCheckout();
  const [item, setItem] = useState<SaleItem | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    commerceApi<{ item: SaleItem }>(`/api/dashboard/sales/${id}`, {
      signal: abort.signal,
    })
      .then((r) => {
        setItem(r.item);
        setError(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [id, retry]);
  return (
    <div className="space-y-3 border-t pt-4">
      {error ? (
        <p role="alert">
          {c.error}{" "}
          <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
            {c.retry}
          </Button>
        </p>
      ) : item ? (
        <>
          <h3 className="font-semibold">{item.title}</h3>
          <SaleSummary item={item} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openSale(id)}>
              {c.viewDetails}
            </Button>
            <Button
              disabled={Boolean(item.availability)}
              onClick={() => openSale(id, true)}
            >
              {c.purchase}
            </Button>
          </div>
        </>
      ) : (
        <p role="status">{c.loading}</p>
      )}
    </div>
  );
}
export function NotificationAction({
  item,
  onNavigate,
}: {
  item: Notification;
  onNavigate?: () => void;
}) {
  const { c } = useCommerce();
  if (item.actionType === "SALE" && item.linkedSaleId)
    return <LinkedSale id={item.linkedSaleId} />;
  if (item.actionType === "EVENT" && item.linkedEventId)
    return (
      <Button asChild>
        <Link
          href={`/dashboard?tab=events&event=${item.linkedEventId}`}
          onClick={onNavigate}
        >
          {c.eventDetails}
        </Link>
      </Button>
    );
  if (item.actionType === "INTERNAL" && safeNotificationLink(item.ctaUrl, true))
    return (
      <Button asChild>
        <Link href={item.ctaUrl} onClick={onNavigate}>
          {item.ctaLabel || c.viewDetails}
        </Link>
      </Button>
    );
  if (item.actionType === "EXTERNAL" && safeNotificationLink(item.ctaUrl))
    return (
      <Button asChild>
        <a href={item.ctaUrl} target="_blank" rel="noopener noreferrer">
          {item.ctaLabel || c.viewDetails}
        </a>
      </Button>
    );
  return null;
}
export function NotificationBell() {
  const { c } = useCommerce();
  const { items, unreadCount, loading, error, refresh, markRead, open } =
    useNotifications();
  const [expanded, setExpanded] = useState(false);
  return (
    <Popover.Root open={expanded} onOpenChange={setExpanded}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${c.notifications}: ${unreadCount}`}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#21466D] px-1.5 text-xs leading-5 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-50 w-[min(92vw,400px)] rounded-2xl border border-[#D4E0F0] bg-white p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{c.notifications}</h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={!unreadCount}
              onClick={() => void markRead()}
            >
              {c.markAllRead}
            </Button>
          </div>
          {loading ? (
            <p role="status">{c.loading}</p>
          ) : error ? (
            <p role="alert">
              {c.error}
              <Button onClick={() => void refresh()}>{c.retry}</Button>
            </p>
          ) : (
            <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
              {items.length ? (
                items.slice(0, 6).map((n) => (
                  <NotificationRow
                    key={n.id}
                    item={n}
                    onOpen={() => {
                      setExpanded(false);
                      open(n);
                    }}
                  />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  {c.noNotifications}
                </p>
              )}
            </div>
          )}
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link
              href="/dashboard/notifications"
              onClick={() => setExpanded(false)}
            >
              {c.viewAll}
            </Link>
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function NotificationRow({
  item,
  onOpen,
}: {
  item: Notification;
  onOpen?: () => void;
}) {
  const { c, locale } = useCommerce();
  const { open, markRead } = useNotifications();
  const n = localizedSale(item, locale);
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <button
        className="w-full text-left focus-visible:outline-2 focus-visible:outline-[#21466D]"
        onClick={onOpen || (() => open(n))}
      >
        <div className="flex items-start gap-2">
          <h3 className="flex-1 break-words text-sm font-semibold">
            {n.title}
          </h3>
          {n.unread && (
            <span className="text-xs font-semibold text-[#21466D]">
              {c.unread}
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">
          {n.description}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {c[(n.category || "admin") as keyof typeof c] || n.category} ·{" "}
          {new Date(n.timestamp).toLocaleString(locale)}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onOpen || (() => open(n))}>
          {c.viewDetails}
        </Button>
        {n.unread && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void markRead([n.id])}
          >
            {c.markRead}
          </Button>
        )}
      </div>
    </article>
  );
}
