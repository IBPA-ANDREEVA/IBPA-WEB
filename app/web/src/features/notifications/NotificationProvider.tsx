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
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Bell, Check, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import {
  CommerceButton as Button,
  CommerceLoading,
  CommerceError,
  commerceDialogClassName,
} from "@/features/sales/CommerceUi";
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
  const { isSaleOpen } = useSaleCheckout();
  const { c, locale } = useCommerce();
  const params = useSearchParams();
  const router = useRouter(),
    pathname = usePathname();
  const [items, setItems] = useState<Notification[]>([]),
    [unreadCount, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [selected, setSelected] = useState<Notification | null>(null),
    [detailError, setDetailError] = useState(false),
    [detailLoading, setDetailLoading] = useState(false),
    [detailRetry, setDetailRetry] = useState(0),
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
        const latest = await commerceApi<Feed>(
          "/api/dashboard/notifications",
        ).catch(() => null);
        if (latest && mounted.current && generation.current === operation) {
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
    if (!id) {
      openedParam.current = null;
      return;
    }
    if (params.has("order") || openedParam.current === id || !isSignedIn)
      return;
    openedParam.current = id;
    setSelected(null);
    setDetailError(false);
    setDetailLoading(true);
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
      })
      .finally(() => {
        if (!abort.signal.aborted) setDetailLoading(false);
      });
    return () => abort.abort();
  }, [params, isSignedIn, detailRetry]);
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
        open={
          !isSaleOpen && (Boolean(selected) || detailError || detailLoading)
        }
        onOpenChange={(value) => {
          if (!value) {
            setSelected(null);
            setDetailError(false);
            setDetailLoading(false);
            if (params.has("notification")) {
              const next = new URLSearchParams(params.toString());
              next.delete("notification");
              router.replace(
                pathname + (next.size ? "?" + next.toString() : ""),
                { scroll: false },
              );
            }
          }
        }}
      >
        <DialogContent
          closeLabel={c.close}
          className={commerceDialogClassName}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (!isSaleOpen) focus.current?.focus();
          }}
        >
          <DialogTitle className="pr-10 text-xl font-semibold">
            {display?.title || c.notifications}
          </DialogTitle>
          <DialogDescription>
            {display
              ? new Date(display.timestamp).toLocaleString(locale)
              : c.notificationsIntro}
          </DialogDescription>
          {detailLoading && <CommerceLoading />}
          {detailError && (
            <CommerceError
              message={c.error}
              onRetry={() => {
                openedParam.current = null;
                setDetailRetry((n) => n + 1);
              }}
            />
          )}
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
  const { c, locale } = useCommerce();
  const { openSale } = useSaleCheckout();
  const [item, setItem] = useState<SaleItem | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setItem(null);
    setError(false);
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
    <div className="space-y-4 rounded-[22px] border border-[#D4E0F0] bg-[#F8FBFF] p-5">
      {error ? (
        <CommerceError
          message={c.error}
          onRetry={() => {
            setError(false);
            setRetry((v) => v + 1);
          }}
        />
      ) : item ? (
        <>
          <h3 className="font-semibold">{localizedSale(item, locale).title}</h3>
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
        <CommerceLoading compact />
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
          aria-label={`${c.notifications}, ${c.unread}: ${unreadCount}`}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C7D9D]"
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
          className="z-50 w-[min(92vw,420px)] overflow-hidden rounded-[24px] border border-[#D4E0F0] bg-white text-[#10203B] shadow-[0_18px_55px_rgba(16,32,59,0.16)] outline-none"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
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
            <CommerceLoading compact />
          ) : error ? (
            <div className="p-4">
              <CommerceError message={c.error} onRetry={() => void refresh()} />
            </div>
          ) : (
            <div className="max-h-[55dvh] divide-y divide-slate-100 overflow-y-auto px-4">
              {items.length ? (
                items.slice(0, 6).map((n) => (
                  <NotificationRow
                    key={n.id}
                    item={n}
                    compact
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
          <Button
            asChild
            variant="outline"
            className="m-3 w-[calc(100%-1.5rem)]"
          >
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
  compact = false,
}: {
  item: Notification;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const { c, locale } = useCommerce();
  const [marking, setMarking] = useState(false);
  const { open, markRead } = useNotifications();
  const n = localizedSale(item, locale);
  const show = onOpen || (() => open(n));
  return (
    <article className={`relative py-4 ${compact ? "" : "sm:py-5"}`}>
      <div className="flex gap-3">
        {!compact && (
          <span
            aria-hidden
            className={`mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-2xl sm:flex ${n.unread ? "bg-[#EEF6FF] text-[#21466D]" : "bg-slate-50 text-slate-400"}`}
          >
            <Bell className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4C7D9D] focus-visible:ring-offset-4"
            onClick={show}
          >
            <div className="flex items-start gap-2">
              <h3
                className={`min-w-0 flex-1 break-words text-sm leading-6 text-[#10203B] ${n.unread ? "font-semibold" : "font-medium"}`}
              >
                {n.title}
              </h3>
              {n.unread && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-[#21466D]">
                  <span className="sr-only">{c.unread}</span>
                </span>
              )}
              <ChevronRight
                aria-hidden
                className="mt-1 size-4 shrink-0 text-slate-400 transition-colors group-hover:text-[#21466D]"
              />
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
              {n.description}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#6C7F95]">
              {c[(n.category || "admin") as keyof typeof c] || n.category}
              {" · "}
              <time dateTime={n.timestamp}>
                {new Date(n.timestamp).toLocaleString(locale, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </p>
          </button>
          {(!compact || n.unread) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {!compact && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="-ml-3 text-[#21466D]"
                  onClick={show}
                >
                  {c.viewDetails}
                </Button>
              )}
              {n.unread && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={compact ? "-ml-3" : ""}
                  busy={marking}
                  onClick={async () => {
                    setMarking(true);
                    try {
                      await markRead([n.id]);
                    } finally {
                      setMarking(false);
                    }
                  }}
                >
                  <Check aria-hidden className="size-3.5" />
                  {c.markRead}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
