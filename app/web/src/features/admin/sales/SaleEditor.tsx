"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Eye, Save } from "lucide-react";
import { AdminSheet } from "@/features/admin/shared/components/AdminSheet";
import { AdminSectionCard } from "@/features/admin/shared/components/AdminSectionCard";
import {
  CommerceButton as Button,
  commerceInputClassName,
  commerceTextareaClassName,
  commerceDialogClassName,
} from "@/features/sales/CommerceUi";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContentImageEditor } from "@/components/content/ContentImageEditor";
import { useCommerce, commerceError } from "@/features/sales/messages";
import {
  type SaleItem,
  parseMoney,
  decimalMoney,
} from "@/features/sales/types";
import { commerceApi, CommerceApiError } from "@/features/sales/api";
import { CommerceSelect } from "@/features/sales/controls";
import { SaleSummary } from "@/features/sales/SalePurchaseProvider";
const categories = [
  "service",
  "masterclass",
  "education",
  "event",
  "consultation",
  "digital",
  "offer",
];
export function blankSale(): SaleItem {
  return {
    id: "",
    title: "",
    shortDescription: "",
    description: "",
    category: "service",
    price: 5000,
    currency: "usd",
    compareAtPrice: null,
    status: "DRAFT",
    startsAt: null,
    expiresAt: null,
    quantityLimit: null,
    onePerAccount: false,
    ctaLabel: null,
    imagePresentation: null,
    translations: {},
    version: 1,
    createdAt: "",
    availability: null,
  };
}
function localDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function SaleEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: SaleItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { c } = useCommerce();
  const [form, setForm] = useState(initial),
    [price, setPrice] = useState(decimalMoney(initial.price)),
    [compare, setCompare] = useState(decimalMoney(initial.compareAtPrice)),
    [limit, setLimit] = useState(initial.quantityLimit?.toString() || ""),
    [start, setStart] = useState(localDate(initial.startsAt)),
    [end, setEnd] = useState(localDate(initial.expiresAt));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [field, setField] = useState(""),
    [dirty, setDirty] = useState(false),
    [imageDirty, setImageDirty] = useState(false),
    [discard, setDiscard] = useState(false),
    [preview, setPreview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [returnFocus] = useState(() =>
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement)
      : null,
  );
  const patch = (values: Partial<SaleItem>) => {
    setForm((f) => ({ ...f, ...values }));
    setDirty(true);
  };
  useEffect(() => {
    if (!dirty && !imageDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, imageDirty]);
  const close = () => {
    if (busy) return;
    if (dirty || imageDirty) setDiscard(true);
    else onClose();
  };
  async function save() {
    if (busy) return;
    setField("");
    setError("");
    const amount = parseMoney(price),
      original = compare ? parseMoney(compare) : null;
    let code = "",
      invalid = "";
    if (!form.title.trim()) {
      code = "INVALID_FIELD";
      invalid = "title";
    } else if (
      amount === null ||
      (compare && (original === null || original <= amount))
    ) {
      code = "INVALID_PRICE";
      invalid = amount === null ? "price" : "compareAtPrice";
    } else if (
      limit &&
      (!/^\d+$/.test(limit) ||
        !Number.isSafeInteger(Number(limit)) ||
        Number(limit) < 1)
    ) {
      code = "INVALID_QUANTITY";
      invalid = "quantityLimit";
    } else if (imageDirty) {
      code = "INVALID_FIELD";
      invalid = "imagePresentation";
    }
    if (code) {
      setField(invalid);
      setError(code);
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${invalid}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    try {
      await commerceApi(`/api/admin/sales${form.id ? "/" + form.id : ""}`, {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          price: amount,
          compareAtPrice: original,
          quantityLimit: limit ? Number(limit) : null,
          startsAt: start ? new Date(start).toISOString() : null,
          expiresAt: end ? new Date(end).toISOString() : null,
        }),
      });
      toast.success(c.saveSuccess);
      onSaved();
    } catch (e) {
      const api =
        e instanceof CommerceApiError ? e : new CommerceApiError("SALES_ERROR");
      setError(api.code);
      setField(api.field || "");
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${api.field}"]`)
          ?.focus(),
      );
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (name: string) =>
    field === name && error ? (
      <p
        id={`sale-error-${name}`}
        role="alert"
        className="text-sm font-normal leading-5 text-red-700"
      >
        {commerceError(error, c)}
      </p>
    ) : null;
  const input = (
    key: "title" | "shortDescription" | "description" | "ctaLabel",
    multiline = false,
  ) => (
    <label className="block space-y-2" key={key}>
      <span className="text-sm font-medium">{c[key]}</span>
      {multiline ? (
        <Textarea
          name={key}
          rows={key === "description" ? 8 : 3}
          className={commerceTextareaClassName}
          aria-invalid={field === key}
          aria-describedby={field === key ? `sale-error-${key}` : undefined}
          value={form[key] || ""}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      ) : (
        <Input
          className={commerceInputClassName}
          name={key}
          aria-invalid={field === key}
          aria-describedby={field === key ? `sale-error-${key}` : undefined}
          value={form[key] || ""}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      )}
      {fieldError(key)}
    </label>
  );
  return (
    <>
      <AdminSheet
        open
        size="md"
        closeLabel={c.close}
        closeDisabled={busy}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          formRef.current
            ?.querySelector<HTMLInputElement>('input[name="title"]')
            ?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus?.focus();
        }}
        className="admin-theme motion-reduce:animate-none"
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={form.id ? `${c.edit}: ${initial.title}` : c.create}
        description={c.sales}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setPreview(true)}
            >
              <Eye aria-hidden className="size-4" />
              {c.preview}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={close}
              >
                {c.cancel}
              </Button>
              <Button
                type="submit"
                form="sale-editor"
                busy={busy}
                disabled={imageDirty}
              >
                <Save aria-hidden className="size-4" />
                {c.save}
              </Button>
            </div>
          </div>
        }
      >
        <form
          id="sale-editor"
          ref={formRef}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-5"
        >
          {error &&
            ![
              "title",
              "shortDescription",
              "description",
              "ctaLabel",
              "price",
              "compareAtPrice",
              "quantityLimit",
              "startsAt",
              "expiresAt",
              "imagePresentation",
            ].includes(field) && (
              <p
                id="sale-error"
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                {commerceError(error, c)}
              </p>
            )}
          <fieldset disabled={busy} className="space-y-5">
            <AdminSectionCard title={c.basicInfo} contentClassName="space-y-5">
              {input("title")}
              {input("shortDescription", true)}
              {input("description", true)}
              <div className="space-y-2 text-sm">
                <p className="font-medium">{c.category}</p>
                <CommerceSelect
                  label={c.category}
                  value={form.category}
                  onChange={(v) => patch({ category: v })}
                  options={[...new Set([...categories, form.category])].map(
                    (value) => ({
                      value,
                      label: c[value as keyof typeof c] || value,
                    }),
                  )}
                />
              </div>
            </AdminSectionCard>
            <AdminSectionCard
              title={c.pricing}
              description={c.pricingHelp}
              contentClassName="grid gap-5 sm:grid-cols-2"
            >
              {[
                { name: "price", value: price, set: setPrice, label: c.price },
                {
                  name: "compareAtPrice",
                  value: compare,
                  set: setCompare,
                  label: c.compareAtPrice,
                },
              ].map((f) => (
                <label key={f.name} className="space-y-2 text-sm">
                  <span className="font-medium">{f.label}</span>
                  <Input
                    className={commerceInputClassName}
                    name={f.name}
                    inputMode="decimal"
                    value={f.value}
                    aria-invalid={field === f.name}
                    aria-describedby={
                      field === f.name ? `sale-error-${f.name}` : undefined
                    }
                    onChange={(e) => {
                      f.set(e.target.value);
                      setDirty(true);
                    }}
                  />
                  {fieldError(f.name)}
                </label>
              ))}
            </AdminSectionCard>
            <AdminSectionCard
              title={c.availability}
              contentClassName="space-y-5"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <p className="font-medium">{c.status}</p>
                  <CommerceSelect
                    label={c.status}
                    value={form.status}
                    onChange={(v) => patch({ status: v })}
                    options={["DRAFT", "PUBLISHED", "ARCHIVED"].map(
                      (value) => ({
                        value,
                        label: c[value as keyof typeof c],
                      }),
                    )}
                  />
                </div>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">{c.quantityLimit}</span>
                  <Input
                    className={commerceInputClassName}
                    name="quantityLimit"
                    inputMode="numeric"
                    value={limit}
                    aria-invalid={field === "quantityLimit"}
                    aria-describedby={
                      field === "quantityLimit"
                        ? "sale-error-quantityLimit"
                        : "quantity-help"
                    }
                    onChange={(e) => {
                      setLimit(e.target.value);
                      setDirty(true);
                    }}
                  />
                  {fieldError("quantityLimit")}
                  <p
                    id="quantity-help"
                    className="text-xs leading-5 text-[#6C7F95]"
                  >
                    {c.unlimitedHelp}
                  </p>
                </label>
                {[
                  {
                    name: "startsAt",
                    label: c.startsAt,
                    value: start,
                    set: setStart,
                  },
                  {
                    name: "expiresAt",
                    label: c.expiresAt,
                    value: end,
                    set: setEnd,
                  },
                ].map((f) => (
                  <label key={f.name} className="space-y-2 text-sm">
                    <span className="font-medium">{f.label}</span>
                    <Input
                      className={commerceInputClassName}
                      name={f.name}
                      type="datetime-local"
                      value={f.value}
                      aria-invalid={field === f.name}
                      aria-describedby={
                        field === f.name ? `sale-error-${f.name}` : undefined
                      }
                      onChange={(e) => {
                        f.set(e.target.value);
                        setDirty(true);
                      }}
                    />
                    {fieldError(f.name)}
                  </label>
                ))}
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[#D4E0F0] bg-[#F8FBFF] p-4 text-sm">
                <input
                  className="size-4 accent-[#21466D]"
                  type="checkbox"
                  checked={form.onePerAccount}
                  onChange={(e) => patch({ onePerAccount: e.target.checked })}
                />
                {c.onePerAccount}
              </label>
            </AdminSectionCard>
            <AdminSectionCard
              title={c.display}
              description={c.displayHelp}
              contentClassName="space-y-5"
            >
              <ContentImageEditor
                alt={form.title || c.image}
                value={form.imagePresentation}
                onChange={(value) => patch({ imagePresentation: value })}
                onDirtyChange={setImageDirty}
                onError={(message) => toast.error(message)}
              />
              {fieldError("imagePresentation")}
              {input("ctaLabel")}
            </AdminSectionCard>
            <details className="rounded-[24px] border border-[#D4E0F0] bg-white p-5">
              <summary className="cursor-pointer text-sm font-semibold text-[#10203B]">
                {c.translations}
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#6C7F95]">
                {c.translationsHelp}
              </p>
              <div className="mt-5 space-y-6">
                {(["en", "ru", "uk"] as const).map((locale) => (
                  <fieldset
                    key={locale}
                    className="space-y-3 border-t border-[#E4EEF8] pt-4"
                  >
                    <legend className="pr-3 text-sm font-semibold">
                      {locale === "en"
                        ? "English"
                        : locale === "ru"
                          ? "Русский"
                          : "Українська"}
                    </legend>
                    {(
                      [
                        "title",
                        "shortDescription",
                        "description",
                        "ctaLabel",
                      ] as const
                    ).map((key) => (
                      <label key={key} className="block space-y-2 text-sm">
                        <span>{c[key]}</span>
                        <Textarea
                          className={commerceTextareaClassName}
                          rows={key === "description" ? 5 : 2}
                          value={form.translations[locale]?.[key] || ""}
                          onChange={(e) =>
                            patch({
                              translations: {
                                ...form.translations,
                                [locale]: {
                                  ...form.translations[locale],
                                  [key]: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            </details>
          </fieldset>
        </form>
      </AdminSheet>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent
          closeLabel={c.close}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            formRef.current
              ?.querySelector<HTMLInputElement>('input[name="title"]')
              ?.focus();
          }}
          className={`${commerceDialogClassName} admin-theme max-w-md`}
        >
          <DialogTitle>{c.unsaved}</DialogTitle>
          <DialogDescription>{form.title}</DialogDescription>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              {c.keepEditing}
            </Button>
            <Button onClick={onClose}>{c.discard}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent closeLabel={c.close} className={commerceDialogClassName}>
          <DialogTitle>{form.title || c.preview}</DialogTitle>
          <DialogDescription>{c.preview}</DialogDescription>
          <SaleSummary
            item={{
              ...form,
              price: parseMoney(price),
              compareAtPrice: compare ? parseMoney(compare) : null,
            }}
            full
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
