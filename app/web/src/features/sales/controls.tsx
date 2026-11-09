"use client";
import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { CommerceButton as Button, commerceInputClassName } from "./CommerceUi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCommerce } from "./messages";
export function CommerceSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value || "__all"}
      onValueChange={(v) => onChange(v === "__all" ? "" : v)}
    >
      <SelectTrigger
        aria-label={label}
        className={`${commerceInputClassName} w-full min-w-40 data-[size=default]:h-11 sm:w-auto`}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="start"
        className="max-w-[calc(100vw-2rem)] rounded-2xl border-[#D4E0F0] bg-white p-1.5 text-[#10203B]"
      >
        {options.map((o) => (
          <SelectItem key={o.value || "__all"} value={o.value || "__all"}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function CommerceSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { c } = useCommerce();
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    // Route back/forward navigation restores the visible search alongside its results.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);
  useEffect(() => {
    if (composing) return;
    const timer = setTimeout(() => {
      if (value !== draft) onChange(draft);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, composing, onChange, value]);
  return (
    <div className="relative min-w-48 flex-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-[#8AA2BD]"
      />
      <Input
        type="search"
        ref={ref}
        aria-label={c.search}
        placeholder={c.search}
        className={`${commerceInputClassName} pl-10 pr-12 [&::-webkit-search-cancel-button]:appearance-none`}
        value={draft}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onChange={(e) => setDraft(e.target.value)}
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          className="absolute right-0 top-0 size-11 min-h-11 p-0"
          aria-label={c.clear}
          onClick={() => {
            setDraft("");
            onChange("");
            ref.current?.focus();
          }}
        >
          <X aria-hidden className="size-4" />
        </Button>
      )}
    </div>
  );
}
export function CommercePagination({
  page,
  total,
  pageSize = 20,
  loading = false,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  loading?: boolean;
  onChange: (p: number) => void;
}) {
  const { c } = useCommerce();
  return (
    <nav
      aria-label={c.pagination}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4EEF8] pt-4"
    >
      <Button
        variant="outline"
        disabled={page <= 1 || loading}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft aria-hidden className="size-4" />
        {c.previous}
      </Button>
      <span className="text-xs tabular-nums text-slate-500">
        {total ? Math.min((page - 1) * pageSize + 1, total) : 0}–
        {Math.min(page * pageSize, total)} / {total}
      </span>
      <Button
        variant="outline"
        disabled={page * pageSize >= total || loading}
        onClick={() => onChange(page + 1)}
      >
        {c.next}
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </nav>
  );
}
