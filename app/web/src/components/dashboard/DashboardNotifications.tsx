"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    [loading, setLoading] = useState(false),
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
  return (
    <SectionCard>
      <SectionHeader
        title={c.notifications}
        action={
          <Button
            variant="outline"
            disabled={!unreadCount}
            onClick={() => void markRead()}
          >
            {c.markAllRead}
          </Button>
        }
      />
      <div className="my-5 flex flex-wrap gap-3">
        <CommerceSelect
          label={c.status}
          value={filter}
          onChange={(v) => update("filter", v)}
          options={["", "unread", "read"].map((value) => ({
            value,
            label: value ? c[value as "unread" | "read"] : c.all,
          }))}
        />
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
            label: value ? c[value as keyof typeof c] : c.all,
          }))}
        />
      </div>
      {loading && <p role="status">{c.loading}</p>}
      {error && (
        <p role="alert">
          {c.error}{" "}
          <Button onClick={() => setRetry((n) => n + 1)}>{c.retry}</Button>
        </p>
      )}
      <div className="space-y-3">
        {data?.notifications.map((n) => (
          <NotificationRow key={n.id} item={n} />
        ))}
        {!loading && data?.total === 0 && (
          <p className="py-12 text-center text-slate-500">
            {c.noNotifications}
          </p>
        )}
      </div>
      {data && (
        <div className="mt-5">
          <CommercePagination
            page={page}
            pageSize={50}
            total={data.total}
            onChange={(v) => update("page", String(v))}
          />
        </div>
      )}
    </SectionCard>
  );
}
