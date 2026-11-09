"use client";
import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
        className="min-w-40 border-border bg-input-background"
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
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
    <div className="relative min-w-40 flex-1">
      <Input
        ref={ref}
        aria-label={c.search}
        placeholder={c.search}
        className="pr-12 border-border bg-input-background"
        value={draft}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onChange={(e) => setDraft(e.target.value)}
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          className="absolute right-1 top-0"
          aria-label={c.clear}
          onClick={() => {
            setDraft("");
            onChange("");
            ref.current?.focus();
          }}
        >
          ×
        </Button>
      )}
    </div>
  );
}
export function CommercePagination({
  page,
  total,
  pageSize = 20,
  onChange,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (p: number) => void;
}) {
  const { c } = useCommerce();
  return (
    <nav
      aria-label={c.next}
      className="flex items-center justify-between gap-3"
    >
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {c.previous}
      </Button>
      <span className="text-sm tabular-nums">
        {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} / {total}
      </span>
      <Button
        variant="outline"
        disabled={page * pageSize >= total}
        onClick={() => onChange(page + 1)}
      >
        {c.next}
      </Button>
    </nav>
  );
}
