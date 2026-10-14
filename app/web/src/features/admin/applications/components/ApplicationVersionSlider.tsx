"use client";

import { ChevronLeft, ChevronRight, Repeat2 } from "lucide-react";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

import { formatAdminDate } from "../../shared/utils/admin-formatters";
import type { RelatedApplication } from "../types/application-admin.types";

const STATUS_LABELS: Record<RelatedApplication["status"], string> = {
  approved: "Approved",
  paid: "Paid",
  pending: "Pending review",
  rejected: "Rejected",
  review: "Changes requested",
};

type ApplicationVersionSliderProps = {
  items: RelatedApplication[];
  activeId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

/**
 * Switches between a member's current application and the update built on it.
 * Both stay one tap apart so an admin can compare them before approving.
 */
export function ApplicationVersionSlider({ items, activeId, disabled, onSelect }: ApplicationVersionSliderProps) {
  const activeIndex = Math.max(items.findIndex((item) => item.id === activeId), 0);
  const step = (direction: 1 | -1) => {
    const next = items[activeIndex + direction];
    if (next && !disabled) onSelect(next.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        aria-label="Show previous application"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#D7E5F4] bg-white text-[#55708D] transition hover:border-[#BFD3EA] hover:text-[#1F5D8F] disabled:pointer-events-none disabled:opacity-35"
        disabled={disabled || activeIndex === 0}
        onClick={() => step(-1)}
        type="button"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div
        aria-label="Applications from this member"
        className="relative grid min-w-0 flex-1 rounded-[20px] border border-[#D7E5F4] bg-[#EEF4FB] p-1"
        onKeyDown={handleKeyDown}
        role="tablist"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-[16px] border border-[#BFD3EA] bg-white shadow-[0_8px_22px_rgba(31,93,143,0.14)] transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            transform: `translateX(${activeIndex * 100}%)`,
            width: `calc((100% - 0.5rem) / ${items.length})`,
          }}
        />

        {items.map((item) => {
          const isActive = item.id === activeId;
          const isUpdate = item.role === "update";

          return (
            <button
              aria-selected={isActive}
              className="relative z-[1] flex min-w-0 flex-col items-start rounded-[16px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1F5D8F]/15 sm:px-4"
              disabled={disabled}
              key={item.id}
              onClick={() => onSelect(item.id)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span className="flex items-center gap-1.5">
                {isUpdate ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#1F5D8F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    <Repeat2 className="size-3" /> Update
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8AA2BD]">Previous</span>
                )}
              </span>
              <span className={cn("mt-1 w-full truncate text-sm font-semibold", isActive ? "text-[#10203B]" : "text-[#55708D]")}>
                {item.membershipCategory || "Membership"}
              </span>
              <span className="w-full truncate text-[11px] text-[#6C7F95]">
                {STATUS_LABELS[item.status] ?? item.status} · {formatAdminDate(item.createdAt)}
              </span>
            </button>
          );
        })}
      </div>

      <button
        aria-label="Show update"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#D7E5F4] bg-white text-[#55708D] transition hover:border-[#BFD3EA] hover:text-[#1F5D8F] disabled:pointer-events-none disabled:opacity-35"
        disabled={disabled || activeIndex === items.length - 1}
        onClick={() => step(1)}
        type="button"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
