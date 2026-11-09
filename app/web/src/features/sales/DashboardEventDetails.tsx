"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const { c, locale } = useCommerce();
  const [event, setEvent] = useState<DashboardContentItem | null>(null),
    [error, setError] = useState(false),
    [closed, setClosed] = useState<string | null>(null);
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
  }, [id]);
  if (!id || closed === id) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) setClosed(id);
      }}
    >
      <DialogContent
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
