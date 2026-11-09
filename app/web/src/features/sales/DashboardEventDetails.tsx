"use client";
import { useEffect, useState } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentImage } from "@/components/content/ContentImage";
import type { DashboardContentItem } from "@/components/dashboard/dashboard-types";
import { commerceApi } from "./api";
import { useCommerce } from "./messages";
import {
  LinkedSale,
  safeNotificationLink,
} from "@/features/notifications/NotificationProvider";
export function DashboardEventDetails() {
  const params = useSearchParams();
  const id = params.get("event");
  return id && !params.has("order") ? <EventDialog key={id} id={id} /> : null;
}
function EventDialog({ id }: { id: string }) {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const { c, locale } = useCommerce();
  const [event, setEvent] = useState<DashboardContentItem | null>(null),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    commerceApi<{ items: DashboardContentItem[] }>("/api/dashboard/events", {
      signal: abort.signal,
    })
      .then((data) => {
        const found = data.items.find((e) => e.id === id);
        setEvent(found || null);
        setError(!found);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [id, retry]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          const next = new URLSearchParams(params.toString());
          next.delete("event");
          router.replace(pathname + (next.size ? "?" + next.toString() : ""), {
            scroll: false,
          });
        }
      }}
    >
      <DialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document
            .querySelector<HTMLAnchorElement>(
              `a[href="/dashboard?tab=events&event=${CSS.escape(id)}"]`,
            )
            ?.focus();
        }}
        closeLabel={c.close}
        className="max-h-[90dvh] max-w-xl overflow-y-auto"
      >
        <DialogTitle className="pr-10 text-xl font-semibold">
          {event?.title || c.eventDetails}
        </DialogTitle>
        <DialogDescription>
          {error
            ? c.error
            : event?.eventDate
              ? new Date(event.eventDate).toLocaleString(locale)
              : c.eventDetails}
        </DialogDescription>
        {event ? (
          <>
            {event.coverImage && (
              <ContentImage
                metadata={event.imageMetadata}
                legacyUrl={event.coverImage}
                alt={event.title}
              />
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-7">
              {event.body}
            </p>
            <p className="text-sm">{event.eventAddress}</p>
            {event.linkedSaleId && <LinkedSale id={event.linkedSaleId} />}{" "}
            {safeNotificationLink(event.ctaUrl) && (
              <Button asChild variant="outline">
                <a
                  href={event.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {event.ctaLabel || c.secondaryLink}
                </a>
              </Button>
            )}
          </>
        ) : !error ? (
          <p role="status">{c.loading}</p>
        ) : (
          <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
            {c.retry}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
