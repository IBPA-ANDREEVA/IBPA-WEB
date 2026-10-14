"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, Loader2 } from "lucide-react";

import { ApplyForm, type MembershipChangeContext } from "@/app/(public)/apply/components/ApplyForm";
import { getMembershipCategory, membershipConfigs, type MembershipCategory } from "@/lib/membership";
import {
  dashboardPrimaryButtonClassName,
  dashboardStandalonePageContainerClassName,
  SectionCard,
} from "@/shared/components/DashboardShared";

type ChangeRequest = {
  id: string;
  status: string;
  fromCategory: MembershipCategory;
  toCategory: MembershipCategory;
  oldAmount: number;
  newAmount: number;
  balanceDue: number;
  submittedAt: string;
  paymentLink?: string | null;
};

type MembershipChangeData = {
  currentMembership: {
    id: string;
    category: MembershipCategory;
    amount: number;
    expiresAt?: string | null;
  };
  latestRequest?: ChangeRequest | null;
};

type PrefillData = {
  currentMembership: { category: MembershipCategory; amount: number; expiresAt?: string | null };
  target: { category: MembershipCategory; amount: number; balanceDue: number };
  application: Record<string, unknown>;
};

const statusLabels: Record<string, string> = {
  SUBMITTED: "In review",
  UNDER_REVIEW: "More information requested",
  APPROVED: "Approved",
  PAYMENT_SENT: "Ready for payment",
  PAID: "Completed",
  REJECTED: "Not approved",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function priceOf(category: MembershipCategory) {
  const value = membershipConfigs.find((item) => item.id === category)?.price ?? "$0";
  return Number(value.replace(/[^0-9]/g, "")) * 100;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || fallback);
  return payload as T;
}

function PageMessage({ message }: { message: string }) {
  return (
    <main className={dashboardStandalonePageContainerClassName}>
      <SectionCard className="mx-auto max-w-2xl text-center">
        <p className="text-sm leading-6 text-rose-600">{message}</p>
        <Link href="/dashboard" className={`mt-6 ${dashboardPrimaryButtonClassName}`}>
          Back to dashboard
        </Link>
      </SectionCard>
    </main>
  );
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB]">
      <Loader2 className="h-10 w-10 animate-spin text-[#4C7D9D]" />
    </div>
  );
}

function RequestStatus({ request }: { request: ChangeRequest }) {
  const awaitingPayment = request.status === "PAYMENT_SENT" && request.paymentLink;
  const needsMoreInfo = request.status === "UNDER_REVIEW";

  return (
    <main className={dashboardStandalonePageContainerClassName}>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#10203B]">
          <ArrowLeft className="h-4 w-4" /> Back to Billing &amp; Membership
        </Link>
        <SectionCard className="overflow-hidden rounded-[32px] p-0">
          <div className="bg-[linear-gradient(135deg,#10203B_0%,#244A73_60%,#4C7D9D_100%)] px-6 py-10 text-white md:px-10">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
              <Clock3 className="h-6 w-6" />
            </div>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#B9D9EB]">Membership change</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
              {awaitingPayment ? "Approved. One payment left." : "Your update is with our review team."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 md:text-base">
              {awaitingPayment
                ? "Pay the difference and your new membership starts. Your renewal date stays the same."
                : needsMoreInfo
                  ? "We emailed you what to update. Use the link in that email to edit your application."
                  : "We review your updated application first. If approved, we email you a payment link for the difference."}
            </p>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto_1fr] md:items-center md:p-10">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current</p>
              <p className="mt-2 text-xl font-semibold text-[#10203B]">{request.fromCategory}</p>
              <p className="mt-1 text-sm text-slate-500">{formatMoney(request.oldAmount)} annual membership</p>
            </div>
            <ArrowRight className="mx-auto hidden h-5 w-5 text-[#4C7D9D] md:block" />
            <div className="rounded-[24px] border border-[#B9D9EB] bg-[#F0F8FF] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4C7D9D]">Requested</p>
              <p className="mt-2 text-xl font-semibold text-[#10203B]">{request.toCategory}</p>
              <p className="mt-1 text-sm text-slate-500">{statusLabels[request.status] || request.status}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 px-6 py-6 md:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#10203B]">
                  {request.balanceDue > 0 ? `${formatMoney(request.balanceDue)} due after approval` : "No additional balance due"}
                </p>
                <p className="mt-1 text-sm text-slate-500">Your current membership stays active until the change is complete.</p>
              </div>
              {awaitingPayment ? (
                <Link href={request.paymentLink as string} className={dashboardPrimaryButtonClassName}>Complete payment</Link>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function PackageChooser({ data }: { data: MembershipChangeData }) {
  const plans = useMemo(
    () => membershipConfigs.filter((plan) => plan.id !== data.currentMembership.category),
    [data.currentMembership.category],
  );

  return (
    <main className={`${dashboardStandalonePageContainerClassName} pb-16`}>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#10203B]">
          <ArrowLeft className="h-4 w-4" /> Back to Billing &amp; Membership
        </Link>
        <SectionCard className="rounded-[30px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#4C7D9D]">Membership change</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#10203B]">Choose your new package</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            You are on <strong className="text-[#10203B]">{data.currentMembership.category}</strong>. Your application carries over, so you only add what the new package asks for.
          </p>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const difference = priceOf(plan.id) - data.currentMembership.amount;
              return (
                <li key={plan.id}>
                  <Link
                    href={`/dashboard/membership/change?to=${plan.id}`}
                    className="group flex h-full flex-col rounded-[24px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#8FB7D2] hover:shadow-[0_14px_32px_rgba(16,32,59,0.08)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9D9EB]/60"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4C7D9D]">{plan.applicantType}</p>
                    <h2 className="mt-3 text-xl font-semibold text-[#10203B]">{plan.title}</h2>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{plan.summary}</p>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <span className="text-lg font-semibold text-[#10203B]">{plan.price}</span>
                      <span className="text-xs text-slate-500">
                        {difference > 0 ? `Pay ${formatMoney(difference)} more` : "No charge"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </main>
  );
}

function ChangeApplication({
  category,
  onSubmitted,
}: {
  category: MembershipCategory;
  onSubmitted: () => void;
}) {
  const [prefill, setPrefill] = useState<PrefillData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/membership-change/prefill?to=${encodeURIComponent(category)}`, { cache: "no-store" })
      .then((response) => readJson<PrefillData>(response, "Unable to load your application."))
      .then((payload) => {
        if (!cancelled) setPrefill(payload);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load your application.");
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const change = useMemo<MembershipChangeContext | null>(() => {
    if (!prefill) return null;
    return {
      fromCategory: prefill.currentMembership.category,
      toCategory: prefill.target.category,
      oldAmount: prefill.currentMembership.amount,
      newAmount: prefill.target.amount,
      balanceDue: prefill.target.balanceDue,
      expiresAt: prefill.currentMembership.expiresAt,
      initialValues: prefill.application,
      backHref: "/dashboard",
      onSubmitted,
    };
  }, [onSubmitted, prefill]);

  if (error) return <PageMessage message={error} />;
  if (!change) return <FullPageSpinner />;
  return <ApplyForm change={change} />;
}

function MembershipChangeContent() {
  const searchParams = useSearchParams();
  const target = getMembershipCategory(searchParams.get("to"));
  const [data, setData] = useState<MembershipChangeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/membership-change", { cache: "no-store" })
      .then((response) => readJson<MembershipChangeData>(response, "Unable to load membership options."))
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load membership options.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleSubmitted = useCallback(() => {
    setData(null);
    setReloadKey((value) => value + 1);
    window.history.replaceState(null, "", "/dashboard/membership/change");
  }, []);

  if (error) return <PageMessage message={error} />;
  if (!data) return <FullPageSpinner />;

  const openRequest = data.latestRequest && !["PAID", "REJECTED"].includes(data.latestRequest.status)
    ? data.latestRequest
    : null;
  if (openRequest) return <RequestStatus request={openRequest} />;
  if (target && target !== data.currentMembership.category) {
    return <ChangeApplication category={target} onSubmitted={handleSubmitted} />;
  }

  return <PackageChooser data={data} />;
}

export default function MembershipChangePage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <MembershipChangeContent />
    </Suspense>
  );
}
