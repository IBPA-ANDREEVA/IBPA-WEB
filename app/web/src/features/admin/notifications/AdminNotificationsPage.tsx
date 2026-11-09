"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Existing fetch-in-effect architecture: pending state is reset when the authenticated request key changes. */
import { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Send, Users } from "lucide-react";
import { AdminSectionCard } from "@/features/admin/shared/components/AdminSectionCard";
import {
  CommerceButton as Button,
  CommerceLoading,
  CommerceError,
  CommerceEmpty,
  CommerceRefresh,
  CommerceView,
  CommerceViewSwitch,
  commerceInputClassName,
  commerceTextareaClassName,
  commerceDialogClassName,
} from "@/features/sales/CommerceUi";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AdminPageShell } from "@/features/admin/shared/components/AdminPageShell";
import { MailingMemberPicker } from "@/features/admin/mailing/components/MailingMemberPicker";
import { MailingAudienceSelector } from "@/features/admin/mailing/components/MailingAudienceSelector";
import {
  listMailingRecipients,
  listApplicationAudienceEmails,
  listEventRegistrantAudienceEmails,
  listTeamMemberAudienceEmails,
} from "@/features/admin/mailing/server/mailing.repository";
import {
  normalizeRecipients,
  emptyMailingDraft,
  emptyApplicationStatusEmails,
  resolveAudienceEmails,
  buildCampaignRecipients,
} from "@/features/admin/mailing/server/mailing.service";
import type { MailingAudienceSources } from "@/features/admin/mailing/types/mailing.types";
import { SaleSelector } from "@/features/admin/sales/SaleSelector";
import { useCommerce, commerceError } from "@/features/sales/messages";
import { commerceApi } from "@/features/sales/api";
import { CommerceSelect, CommerceSearch } from "@/features/sales/controls";
import { SaleSummary } from "@/features/sales/SalePurchaseProvider";
import type { SaleItem } from "@/features/sales/types";

type History = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  recipients: { emails?: string[] };
  actionType: string;
};
export function AdminNotificationsPage() {
  const { c, locale } = useCommerce();
  const params = useSearchParams(),
    router = useRouter();
  const historyView = params.get("view") === "history";
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(emptyMailingDraft),
    [sources, setSources] = useState<MailingAudienceSources>({
      recipients: [],
      applicationStatusEmails: emptyApplicationStatusEmails,
      eventRegistrantEmails: [],
      teamMemberEmails: [],
    }),
    [categories, setCategories] = useState<string[]>([]),
    [picked, setPicked] = useState<string[]>([]),
    [teams, setTeams] = useState<string[]>([]);
  const [action, setAction] = useState("NONE"),
    [category, setCategory] = useState("admin"),
    [url, setUrl] = useState(""),
    [cta, setCta] = useState(""),
    [sale, setSale] = useState<SaleItem | null>(null),
    [saleId, setSaleId] = useState<string | null>(null),
    [eventId, setEventId] = useState(""),
    [events, setEvents] = useState<
      { id: string; title: string; publishToDashboard: boolean }[]
    >([]),
    [eventQuery, setEventQuery] = useState("");
  const [translations, setTranslations] = useState<SaleItem["translations"]>(
      {},
    ),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [history, setHistory] = useState<History[]>([]),
    [revision, setRevision] = useState(0);
  const requestKey = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      listMailingRecipients(),
      listApplicationAudienceEmails(),
      listEventRegistrantAudienceEmails(),
      listTeamMemberAudienceEmails(),
      commerceApi<{ items: History[] }>("/api/admin/notifications"),
      commerceApi<{
        items: { id: string; title: string; publishToDashboard: boolean }[];
      }>("/api/admin/content"),
    ])
      .then(
        ([people, applications, eventEmails, teamEmails, logs, content]) => {
          if (!active) return;
          setSources({
            recipients: normalizeRecipients(people.items || []),
            applicationStatusEmails: applications,
            eventRegistrantEmails: eventEmails,
            teamMemberEmails: teamEmails,
          });
          setCategories(people.categories || []);
          setHistory(logs.items);
          setReady(true);
          setEvents(content.items.filter((e) => e.publishToDashboard));
          setError("");
        },
      )
      .catch(() => {
        if (active) setError("NOTIFICATIONS_ERROR");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const audience = useMemo(
    () => resolveAudienceEmails(sources, draft),
    [sources, draft],
  );
  const recipients = useMemo(
    () =>
      buildCampaignRecipients({
        audienceEmails: audience,
        draft,
        pickedMemberEmails: picked,
        pickedTeamMemberEmails: teams,
      }).emails,
    [audience, draft, picked, teams],
  );
  // Changing a send payload starts a new idempotency key; failed retries keep it.
  useEffect(() => {
    requestKey.current = null;
  }, [
    draft,
    picked,
    teams,
    action,
    category,
    url,
    cta,
    saleId,
    eventId,
    translations,
  ]);
  useEffect(() => {
    if (!draft.subject && !draft.body) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.subject, draft.body]);
  async function send() {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    requestKey.current ||= crypto.randomUUID();
    try {
      const result = await commerceApi<{ count: number }>(
        "/api/admin/notifications",
        {
          method: "POST",
          body: JSON.stringify({
            requestKey: requestKey.current,
            title: draft.subject,
            description: draft.body,
            emails: recipients,
            actionType: action,
            category,
            ctaUrl: url,
            ctaLabel: cta,
            linkedSaleId: saleId,
            linkedEventId: eventId || null,
            translations,
          }),
        },
      );
      toast.success(`${c.sendSuccess} ${c.sendCount}: ${result.count}`);
      setPreview(false);
      setDraft(emptyMailingDraft);
      setPicked([]);
      setTeams([]);
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as { code?: string }).code || "NOTIFICATIONS_ERROR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPageShell
      title={c.notifications}
      subtitle={c.adminNotificationsIntro}
    >
      <AdminSectionCard contentClassName="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CommerceViewSwitch
            className="border-0 pb-0"
            label={c.notifications}
            value={historyView ? "history" : ""}
            onChange={(value) => {
              const next = new URLSearchParams(params.toString());
              if (value) next.set("view", value);
              else next.delete("view");
              router.replace("/admin/notifications?" + next.toString(), {
                scroll: false,
              });
            }}
            options={[
              { value: "", label: c.compose },
              { value: "history", label: c.history },
            ]}
          />
          <CommerceRefresh active={loading && ready} />
        </div>
        {error && (
          <CommerceError
            message={commerceError(error, c)}
            onRetry={() => setRevision((n) => n + 1)}
          />
        )}
      </AdminSectionCard>
      {!ready && loading ? (
        <AdminSectionCard>
          <CommerceLoading />
        </AdminSectionCard>
      ) : (
        ready && (
          <CommerceView viewKey={historyView ? "history" : "compose"}>
            {!historyView ? (
              <form
                ref={formRef}
                noValidate
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !draft.subject.trim() ||
                    !draft.body.trim() ||
                    !recipients.length
                  ) {
                    setError("INVALID_FIELD");
                    formRef.current
                      ?.querySelector<HTMLInputElement>('input[name="title"]')
                      ?.focus();
                    return;
                  }
                  setPreview(true);
                }}
              >
                <AdminSectionCard
                  title={c.recipients}
                  contentClassName="space-y-5"
                >
                  <MailingAudienceSelector
                    draft={draft}
                    onChange={setDraft}
                    categories={categories}
                    membershipTypes={[
                      ...new Set(
                        sources.recipients
                          .map((r) => r.cardName)
                          .filter(Boolean),
                      ),
                    ]}
                    recipientCount={recipients.length}
                    controlClassName={`${commerceInputClassName} data-[size=default]:h-11 w-full`}
                    audienceLabel={c.audience}
                  />
                  <details className="rounded-xl border p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      {c.selectRecipients}
                    </summary>
                    <div className="mt-4">
                      <MailingMemberPicker
                        recipients={sources.recipients}
                        selectedEmails={picked}
                        selectedTeamEmails={teams}
                        onChange={setPicked}
                        onTeamChange={setTeams}
                      />
                    </div>
                  </details>
                </AdminSectionCard>
                <AdminSectionCard
                  title={c.message}
                  contentClassName="space-y-5"
                >
                  <label className="block space-y-2 text-sm font-medium">
                    <span>{c.title}</span>
                    <Input
                      className={commerceInputClassName}
                      name="title"
                      value={draft.subject}
                      onChange={(e) =>
                        setDraft({ ...draft, subject: e.target.value })
                      }
                    />
                  </label>
                  <label className="block space-y-2">
                    <span>{c.description}</span>
                    <Textarea
                      className={commerceTextareaClassName}
                      rows={7}
                      value={draft.body}
                      onChange={(e) =>
                        setDraft({ ...draft, body: e.target.value })
                      }
                    />
                  </label>
                </AdminSectionCard>
                <AdminSectionCard
                  title={c.actionType}
                  contentClassName="space-y-5"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{c.category}</p>
                      <CommerceSelect
                        label={c.category}
                        value={category}
                        onChange={setCategory}
                        options={[
                          "admin",
                          "membership",
                          "certificate",
                          "content",
                          "system",
                          "sale",
                          "event",
                        ].map((value) => ({
                          value,
                          label: c[value as keyof typeof c],
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{c.actionType}</p>
                      <CommerceSelect
                        label={c.actionType}
                        value={action}
                        onChange={setAction}
                        options={[
                          "NONE",
                          "INTERNAL",
                          "EXTERNAL",
                          "SALE",
                          "EVENT",
                        ].map((value) => ({
                          value,
                          label: c[value as keyof typeof c],
                        }))}
                      />
                    </div>
                  </div>
                  {["INTERNAL", "EXTERNAL"].includes(action) && (
                    <>
                      <label className="block space-y-2">
                        <span>{c.link}</span>
                        <Input
                          className={commerceInputClassName}
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </label>
                      <label className="block space-y-2">
                        <span>{c.ctaLabel}</span>
                        <Input
                          className={commerceInputClassName}
                          value={cta}
                          onChange={(e) => setCta(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  {action === "SALE" && (
                    <SaleSelector
                      value={saleId}
                      onChange={(id, item) => {
                        setSaleId(id);
                        setSale(item || null);
                      }}
                    />
                  )}
                  {action === "EVENT" && (
                    <div className="space-y-3">
                      <CommerceSearch
                        value={eventQuery}
                        onChange={setEventQuery}
                      />
                      <CommerceSelect
                        label={c.selectEvent}
                        value={eventId}
                        onChange={setEventId}
                        options={[
                          { value: "", label: c.selectEvent },
                          ...events
                            .filter((e) =>
                              e.title
                                .toLowerCase()
                                .includes(eventQuery.toLowerCase()),
                            )
                            .map((e) => ({ value: e.id, label: e.title })),
                        ]}
                      />
                    </div>
                  )}
                </AdminSectionCard>
                <details className="rounded-[24px] border border-[#D4E0F0] bg-white p-5">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {c.translations}
                  </summary>
                  <p className="mt-3 text-sm text-[#6C7F95]">
                    {c.translationsHelp}
                  </p>
                  <div className="mt-4 space-y-4">
                    {(["en", "ru", "uk"] as const).map((language) => (
                      <fieldset key={language} className="space-y-2">
                        <legend>
                          {language === "en"
                            ? "English"
                            : language === "ru"
                              ? "Русский"
                              : "Українська"}
                        </legend>
                        {(["title", "description", "ctaLabel"] as const).map(
                          (key) => (
                            <label key={key} className="block space-y-1">
                              <span>{c[key]}</span>
                              <Textarea
                                className={commerceTextareaClassName}
                                rows={key === "description" ? 4 : 2}
                                value={translations[language]?.[key] || ""}
                                onChange={(e) =>
                                  setTranslations({
                                    ...translations,
                                    [language]: {
                                      ...translations[language],
                                      [key]: e.target.value,
                                    },
                                  })
                                }
                              />
                            </label>
                          ),
                        )}
                      </fieldset>
                    ))}
                  </div>
                </details>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[#D4E0F0] bg-white p-5">
                  <p className="flex items-center gap-2 text-sm text-[#6C7F95]">
                    <Users aria-hidden className="size-4" />
                    {c.sendCount}:{" "}
                    <strong className="text-[#10203B] tabular-nums">
                      {recipients.length}
                    </strong>
                  </p>
                  <Button
                    type="submit"
                    disabled={
                      loading ||
                      busy ||
                      !recipients.length ||
                      (action === "SALE" && !saleId) ||
                      (action === "EVENT" && !eventId)
                    }
                  >
                    <Eye aria-hidden className="size-4" />
                    {c.preview}
                  </Button>
                </div>
              </form>
            ) : (
              <AdminSectionCard
                title={c.history}
                contentClassName="divide-y divide-[#E4EEF8]"
              >
                {history.length ? (
                  history.map((n) => (
                    <article key={n.id} className="py-5 first:pt-0 last:pb-0">
                      <h3 className="font-medium">{n.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                        {n.message}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {new Date(n.createdAt).toLocaleString(locale)} ·{" "}
                        {c.sent}: {n.recipients.emails?.length || 0}
                      </p>
                    </article>
                  ))
                ) : (
                  <CommerceEmpty title={c.empty} />
                )}
              </AdminSectionCard>
            )}
          </CommerceView>
        )
      )}
      <Dialog
        open={preview}
        onOpenChange={(value) => {
          if (!busy) setPreview(value);
        }}
      >
        <DialogContent
          closeLabel={c.close}
          closeDisabled={busy}
          className={`${commerceDialogClassName} admin-theme`}
        >
          <DialogTitle>{draft.subject}</DialogTitle>
          <DialogDescription>{c.confirmSend}</DialogDescription>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          {action === "SALE" && sale && <SaleSummary item={sale} />}{" "}
          {action === "EVENT" && (
            <p>{events.find((e) => e.id === eventId)?.title}</p>
          )}
          {["INTERNAL", "EXTERNAL"].includes(action) && (
            <p className="break-all text-sm">
              {cta || c.viewDetails}: {url}
            </p>
          )}
          <p className="text-sm">
            {c.sendCount}: {recipients.length}
          </p>
          {error && (
            <p role="alert" className="text-red-700">
              {commerceError(error, c)}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPreview(false)}
            >
              {c.cancel}
            </Button>
            <Button busy={busy} onClick={() => void send()}>
              <Send aria-hidden className="size-4" />
              {c.send}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
