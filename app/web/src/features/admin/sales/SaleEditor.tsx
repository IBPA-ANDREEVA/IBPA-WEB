"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
          className="resize-none border-border bg-input-background"
          aria-invalid={field === key}
          aria-describedby={field === key ? "sale-error" : undefined}
          value={form[key] || ""}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      ) : (
        <Input
          className="border-border bg-input-background"
          name={key}
          aria-invalid={field === key}
          aria-describedby={field === key ? "sale-error" : undefined}
          value={form[key] || ""}
          onChange={(e) => patch({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          closeLabel={c.close}
          className="max-h-[92dvh] max-w-3xl overflow-y-auto rounded-2xl"
        >
          <DialogTitle className="pr-10 text-xl font-semibold">
            {form.id ? c.edit : c.create}
          </DialogTitle>
          <DialogDescription>{c.sales}</DialogDescription>
          <form
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-5"
          >
            {input("title")}
            {input("shortDescription", true)}
            {input("description", true)}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span>{c.category}</span>
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
              </label>
              <label className="space-y-2">
                <span>{c.status}</span>
                <CommerceSelect
                  label={c.status}
                  value={form.status}
                  onChange={(v) => patch({ status: v })}
                  options={["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => ({
                    value,
                    label: c[value as keyof typeof c],
                  }))}
                />
              </label>
            </div>
            <ContentImageEditor
              alt={form.title || c.image}
              value={form.imagePresentation}
              onChange={(value) => patch({ imagePresentation: value })}
              onDirtyChange={setImageDirty}
              onError={(message) => toast.error(message)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { name: "price", value: price, set: setPrice, label: c.price },
                {
                  name: "compareAtPrice",
                  value: compare,
                  set: setCompare,
                  label: c.compareAtPrice,
                },
                {
                  name: "quantityLimit",
                  value: limit,
                  set: setLimit,
                  label: c.quantityLimit,
                },
              ].map((f) => (
                <label key={f.name} className="space-y-2">
                  <span>{f.label}</span>
                  <Input
                    className="border-border bg-input-background"
                    name={f.name}
                    inputMode={
                      f.name === "quantityLimit" ? "numeric" : "decimal"
                    }
                    value={f.value}
                    aria-invalid={field === f.name}
                    aria-describedby={
                      field === f.name ? "sale-error" : undefined
                    }
                    onChange={(e) => {
                      f.set(e.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.onePerAccount}
                  onChange={(e) => patch({ onePerAccount: e.target.checked })}
                />
                {c.onePerAccount}
              </label>
              <label className="space-y-2">
                <span>{c.startsAt}</span>
                <Input
                  className="border-border bg-input-background"
                  name="startsAt"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <label className="space-y-2">
                <span>{c.expiresAt}</span>
                <Input
                  className="border-border bg-input-background"
                  name="expiresAt"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
            </div>
            {input("ctaLabel")}
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {c.translations}
              </summary>
              <div className="mt-4 space-y-5">
                {(["en", "ru", "uk"] as const).map((locale) => (
                  <fieldset key={locale} className="space-y-3">
                    <legend className="mb-2 font-medium">
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
                      <label key={key} className="block space-y-1 text-sm">
                        <span>{c[key]}</span>
                        <Textarea
                          className="resize-none border-border bg-input-background"
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
            {error && (
              <p id="sale-error" role="alert" className="text-sm text-red-700">
                {commerceError(error, c)}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(true)}
              >
                {c.preview}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={close}
              >
                {c.cancel}
              </Button>
              <Button type="submit" disabled={busy || imageDirty}>
                {busy ? c.loading : c.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogContent closeLabel={c.close} className="max-w-md">
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
        <DialogContent
          closeLabel={c.close}
          className="max-h-[90dvh] max-w-xl overflow-y-auto"
        >
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
