"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck } from "lucide-react";
import {
  CommerceButton as Button,
  CommerceLoading,
  CommerceError,
  CommerceEmpty,
  CommerceRefresh,
  CommerceViewSwitch,
} from "@/features/sales/CommerceUi";
import {
  SectionCard,
  SectionHeader,
} from "@/shared/components/DashboardShared";
import {
  NotificationRow,
  useNotifications,
  type Notification,
} from "@/features/notifications/NotificationProvider";
import { useCommerce } from "@/features/sales/messages";
import { commerceApi } from "@/features/sales/api";
import { CommerceSelect, CommercePagination } from "@/features/sales/controls";
export function DashboardNotifications() {
  const { c } = useCommerce();
  const { markRead, revision, unreadCount } = useNotifications();
  const router = useRouter();
  const params = useSearchParams();
  const filter = params.get("filter") || "",
    category = params.get("category") || "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const [data, setData] = useState<{
      notifications: Notification[];
      total: number;
    } | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace("/dashboard/notifications?" + next.toString(), {
      scroll: false,
    });
  };
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(false);
    commerceApi<{ notifications: Notification[]; total: number }>(
      `/api/dashboard/notifications?filter=${filter}&category=${category}&page=${page}`,
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
  }, [filter, category, page, revision, retry]);
  const clearFilters = () => {
    const next = new URLSearchParams(params.toString());
    ["filter", "category", "page"].forEach((key) => next.delete(key));
    router.replace("/dashboard/notifications?" + next.toString(), {
      scroll: false,
    });
  };
  return (
    <SectionCard className="space-y-5">
      <SectionHeader
        title={c.notifications}
        description={c.notificationsIntro}
        action={
          <Button
            variant="outline"
            disabled={!unreadCount}
            onClick={() => void markRead()}
          >
            <CheckCheck aria-hidden className="size-4" />
            {c.markAllRead}
          </Button>
        }
      />
      <CommerceViewSwitch
        label={c.status}
        value={filter}
        onChange={(v) => update("filter", v)}
        options={[
          { value: "", label: c.all },
          {
            value: "unread",
            label: unreadCount ? `${c.unread} (${unreadCount})` : c.unread,
          },
          { value: "read", label: c.read },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CommerceSelect
          label={c.category}
          value={category}
          onChange={(v) => update("category", v)}
          options={[
            "",
            "membership",
            "certificate",
            "content",
            "admin",
            "system",
            "sale",
            "event",
          ].map((value) => ({
            value,
            label: value ? c[value as keyof typeof c] : c.allCategories,
          }))}
        />
        <CommerceRefresh active={loading && Boolean(data)} />
      </div>
      {error && (
        <CommerceError
          message={c.error}
          onRetry={() => setRetry((n) => n + 1)}
        />
      )}
      <div aria-busy={loading} className="min-h-64">
        {!data && loading ? (
          <CommerceLoading />
        ) : data?.notifications.length === 0 ? (
          <CommerceEmpty
            title={filter || category ? c.noResults : c.noNotifications}
            action={
              filter || category ? (
                <Button variant="outline" onClick={clearFilters}>
                  {c.resetFilters}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-slate-200">
            {data?.notifications.map((n) => (
              <NotificationRow key={n.id} item={n} />
            ))}
          </div>
        )}
      </div>
      {data && data.total > 50 && (
        <CommercePagination
          loading={loading}
          page={page}
          pageSize={50}
          total={data.total}
          onChange={(v) => update("page", String(v))}
        />
      )}
    </SectionCard>
  );
}
