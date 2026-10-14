"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Clock3, Repeat2 } from "lucide-react";

import { getMembershipCategory, membershipConfigs, type MembershipCategory } from "@/lib/membership";
import { cn } from "@/lib/utils";

type OpenRequest = {
  status: string;
  toCategory: string;
};

const OPEN_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAYMENT_SENT"]);

function priceInCents(category: MembershipCategory) {
  const price = membershipConfigs.find((plan) => plan.id === category)?.price ?? "$0";
  return Number(price.replace(/[^0-9]/g, "")) * 100;
}

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

/**
 * "Change membership" control for the billing page. Opens a short list of the
 * other packages with what each would cost, then hands off to the change flow.
 */
export function ChangeMembershipMenu({ currentCategory }: { currentCategory?: string | null }) {
  const current = getMembershipCategory(currentCategory ?? undefined);
  const [open, setOpen] = useState(false);
  const [openRequest, setOpenRequest] = useState<OpenRequest | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/membership-change", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403 || response.status === 422) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const payload = await response.json().catch(() => ({}));
        const latest = payload?.latestRequest;
        if (!cancelled && latest && OPEN_STATUSES.has(latest.status)) {
          setOpenRequest({ status: latest.status, toCategory: latest.toCategory });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, open]);

  const plans = useMemo(
    () => membershipConfigs.map((plan) => {
      const delta = current ? priceInCents(plan.id) - priceInCents(current) : 0;
      return { plan, delta, isCurrent: plan.id === current };
    }),
    [current],
  );

  if (unavailable) return null;

  if (openRequest) {
    return (
      <Link
        href="/dashboard/membership/change"
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#B9D9EB] bg-[#F0F8FF] px-4 py-2.5 text-sm font-medium text-[#1F5D8F] transition hover:bg-[#E4F2FB]"
      >
        <Clock3 className="h-4 w-4" />
        Change to {openRequest.toCategory} in review
      </Link>
    );
  }

  const moveFocus = (direction: 1 | -1) => {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    items[(index + direction + items.length) % items.length]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          close(true);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) setOpen(true);
          else moveFocus(event.key === "ArrowDown" ? 1 : -1);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10203B] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a3157] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#10203B]/20"
      >
        <Repeat2 className="h-4 w-4" />
        Change membership
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Choose a new membership"
          className="absolute left-0 top-full z-30 mt-3 w-[min(24rem,calc(100vw-2rem))] origin-top-left overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(16,32,59,0.18)] animate-in fade-in-0 slide-in-from-top-1 duration-150 sm:left-auto sm:right-0 sm:origin-top-right"
        >
          <div className="border-b border-slate-100 bg-[#F8FBFD] px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#4C7D9D]">Choose a new package</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Your answers carry over. You pay only the difference, and your renewal date stays the same.
            </p>
          </div>

          <ul className="p-2">
            {plans.map(({ plan, delta, isCurrent }) => (
              <li key={plan.id} role="none">
                {isCurrent ? (
                  <div className="flex items-center justify-between gap-4 rounded-[18px] px-3 py-3 opacity-70">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{plan.shortTitle}</p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Your current package</p>
                    </div>
                    <p className="text-sm tabular-nums text-slate-500">{plan.price}</p>
                  </div>
                ) : (
                  <Link
                    role="menuitem"
                    href={`/dashboard/membership/change?to=${plan.id}`}
                    onClick={() => close()}
                    className="group flex items-center gap-4 rounded-[18px] px-3 py-3 transition-colors hover:bg-[#F0F8FF] focus-visible:bg-[#F0F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#72A0C1]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#10203B]">{plan.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{plan.audienceAliases[0] ?? plan.applicantType}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-[#10203B]">{plan.price}</p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px] font-semibold tabular-nums",
                          delta > 0 ? "text-[#1F5D8F]" : "text-slate-400",
                        )}
                      >
                        {delta > 0 ? `Pay ${formatDollars(delta)} more` : "No charge"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#72A0C1]" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
