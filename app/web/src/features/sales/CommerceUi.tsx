"use client";

import { useRef, type ComponentProps, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { CircleAlert, Inbox, LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminStatusBadge } from "@/features/admin/shared/components/AdminStatusBadge";
import {
  dashboardPrimaryButtonClassName,
  dashboardSecondaryButtonClassName,
} from "@/shared/components/DashboardShared";
import { cn } from "@/lib/utils";
import { useCommerce } from "./messages";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

// Business variants of the existing controls; the dashboard and admin retain
// their respective action colors. Busy labels keep their original geometry.
export function CommerceButton({
  busy,
  children,
  className,
  variant = "default",
  size,
  ...props
}: ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button
      type="button"
      {...props}
      variant={variant}
      size={size}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      className={cn(
        variant === "default"
          ? dashboardPrimaryButtonClassName
          : variant === "outline"
            ? dashboardSecondaryButtonClassName
            : "rounded-2xl text-slate-600",
        "relative h-auto min-h-11 gap-2 whitespace-normal px-4 py-2.5 text-sm leading-5 motion-reduce:transition-none motion-reduce:active:translate-y-0",
        variant === "default" &&
          "in-[.admin-theme]:bg-[#21466D] in-[.admin-theme]:hover:bg-[#193956]",
        size === "sm" && "min-h-9 rounded-xl px-3 py-2 text-xs",
        className,
      )}
    >
      {busy ? (
        <>
          <span className="inline-flex items-center gap-2 opacity-0">
            {children}
          </span>
          <LoaderCircle
            aria-hidden
            className="absolute size-4 motion-safe:animate-spin"
          />
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export const commerceInputClassName =
  "h-11 rounded-2xl border-[#D4E0F0] bg-white px-3.5 text-sm text-[#10203B] shadow-none focus-visible:border-[#4C7D9D] focus-visible:ring-[#4C7D9D]/15";
export const commerceTextareaClassName =
  "field-sizing-fixed resize-none rounded-2xl border-[#D4E0F0] bg-white px-3.5 py-3 text-sm leading-6 text-[#10203B] shadow-none focus-visible:border-[#4C7D9D] focus-visible:ring-[#4C7D9D]/15";
export const commerceDialogClassName =
  "max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[28px] border-[#D4E0F0] bg-white p-6 text-[#10203B] [&_[data-slot=dialog-description]]:text-sm [&_[data-slot=dialog-description]]:leading-6 [&_[data-slot=dialog-description]]:text-slate-500 [&_[data-slot=dialog-title]]:pr-8 [&_[data-slot=dialog-title]]:text-xl [&_[data-slot=dialog-title]]:font-semibold shadow-[0_24px_80px_rgba(16,32,59,0.18)] sm:p-7 motion-reduce:animate-none";
export function CommerceLoading({ compact = false }: { compact?: boolean }) {
  const { c } = useCommerce();
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-[#55708D]",
        compact ? "min-h-24" : "min-h-72",
      )}
    >
      <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" />
      {c.loading}
    </div>
  );
}

export function CommerceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { c } = useCommerce();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#F2C7C7] bg-[#FFF5F5] p-4 text-sm text-[#8F241E]"
    >
      <CircleAlert aria-hidden className="size-5 shrink-0" />
      <p className="min-w-40 flex-1 leading-6">{message}</p>
      {onRetry && (
        <CommerceButton variant="outline" onClick={onRetry}>
          <RotateCw aria-hidden className="size-4" />
          {c.retry}
        </CommerceButton>
      )}
    </div>
  );
}

export function CommerceEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[22px] border border-dashed border-[#D4E0F0] bg-[#F8FBFF] p-6 text-center">
      <Inbox aria-hidden className="mb-4 size-7 text-[#4C7D9D]" />
      <h3 className="font-semibold text-[#10203B]">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function CommerceStatus({ status }: { status: string }) {
  const { c } = useCommerce();
  return (
    <AdminStatusBadge
      className="whitespace-nowrap shadow-none"
      tone={
        status === "PAID" || status === "PUBLISHED"
          ? "success"
          : status === "FAILED"
            ? "danger"
            : status === "PENDING"
              ? "info"
              : "neutral"
      }
    >
      {c[status as keyof typeof c] || status}
    </AdminStatusBadge>
  );
}

// Only a committed view change fades in. Polling, filter refreshes and pending
// actions never replay the animation or hide usable content.
export function CommerceView({
  viewKey,
  children,
  className,
}: {
  viewKey: string;
  children?: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          root.current,
          { opacity: 0.5 },
          {
            opacity: 1,
            duration: 0.18,
            ease: "power1.out",
            clearProps: "opacity",
          },
        );
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [viewKey], revertOnUpdate: true },
  );
  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

export function CommerceRefresh({ active }: { active: boolean }) {
  const { c } = useCommerce();
  return (
    <span
      role="status"
      className={cn(
        "inline-flex min-h-5 items-center gap-1.5 text-xs text-[#55708D]",
        !active && "invisible",
      )}
    >
      <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
      {active ? c.refreshing : "\u00a0"}
    </span>
  );
}

export function CommerceViewSwitch({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-wrap gap-2 border-b border-slate-200 pb-4",
        className,
      )}
    >
      {options.map((option) => (
        <CommerceButton
          key={option.value}
          variant={value === option.value ? "default" : "ghost"}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </CommerceButton>
      ))}
    </nav>
  );
}
