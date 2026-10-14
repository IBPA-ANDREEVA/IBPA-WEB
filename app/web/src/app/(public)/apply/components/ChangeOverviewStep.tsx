"use client";

import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
import type { NewApplicationField } from "@/lib/application-steps";
import { membershipConfigById, type MembershipCategory } from "@/lib/membership";

type ChangeSummary = {
  fromCategory: MembershipCategory;
  toCategory: MembershipCategory;
  oldAmount: number;
  newAmount: number;
  balanceDue: number;
  expiresAt?: string | null;
};

type StepLabel = { en: string };

export function formatChangeMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDueDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function groupByStep(items: readonly NewApplicationField[]) {
  const groups = new Map<number, NewApplicationField[]>();
  for (const item of items) {
    groups.set(item.step, [...(groups.get(item.step) ?? []), item]);
  }
  return Array.from(groups.entries()).sort(([left], [right]) => left - right);
}

/** What the member pays and keeps, in plain terms. */
function PriceLedger({ change }: { change: ChangeSummary }) {
  const dueDate = formatDueDate(change.expiresAt);
  const isUpgrade = change.balanceDue > 0;

  return (
    <dl className="divide-y divide-slate-200/80 text-sm">
      <div className="flex items-baseline justify-between gap-4 py-3">
        <dt className="text-slate-500">{change.fromCategory} (current)</dt>
        <dd className="tabular-nums text-slate-700">{formatChangeMoney(change.oldAmount)} / year</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 py-3">
        <dt className="text-slate-500">{change.toCategory} (requested)</dt>
        <dd className="tabular-nums text-slate-700">{formatChangeMoney(change.newAmount)} / year</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 py-3">
        <dt className="font-semibold text-slate-900">You pay after approval</dt>
        <dd className="text-lg font-semibold tabular-nums text-[#1F5D8F]">
          {isUpgrade ? formatChangeMoney(change.balanceDue) : "$0"}
        </dd>
      </div>
      {dueDate ? (
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-slate-500">Renewal date</dt>
          <dd className="text-slate-700">{dueDate}, unchanged</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function ChangeHeader({
  change,
  headlineClassName,
}: {
  change: ChangeSummary;
  headlineClassName: string;
}) {
  return (
    <section className="bg-[#F1F3F5]">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-16">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#708090]">Membership change</p>
        <h1 className={`mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-4xl uppercase leading-[0.95] text-slate-900 sm:text-6xl md:text-7xl ${headlineClassName}`}>
          <span className="text-slate-400">{membershipConfigById[change.fromCategory].shortTitle}</span>
          <ArrowRight aria-hidden className="size-8 text-[#72A0C1] sm:size-12" strokeWidth={1.5} />
          <span>{membershipConfigById[change.toCategory].shortTitle}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
          Your answers carry over. Add what the {membershipConfigById[change.toCategory].shortTitle} application asks for beyond{" "}
          {membershipConfigById[change.fromCategory].shortTitle}, then send it for review.
        </p>
      </div>
    </section>
  );
}

export function ChangeOverviewStep({
  change,
  headlineClassName,
  editorialClassName,
  carriedCount,
  newFields,
  remaining,
  stepTitles,
  labelFor,
  onJump,
}: {
  change: ChangeSummary;
  headlineClassName: string;
  editorialClassName: string;
  carriedCount: number;
  newFields: readonly NewApplicationField[];
  remaining: readonly NewApplicationField[];
  stepTitles: readonly StepLabel[];
  labelFor: (field: string) => string;
  onJump: (step: number) => void;
}) {
  const remainingFields = new Set(remaining.map((item) => item.field));
  const groups = groupByStep(newFields);
  const target = membershipConfigById[change.toCategory].shortTitle;
  const source = membershipConfigById[change.fromCategory].shortTitle;

  return (
    <motion.div
      key="change-overview"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="space-y-10"
    >
      <div className="space-y-3">
        <h2 className={`text-3xl uppercase tracking-tight text-slate-900 md:text-4xl ${headlineClassName}`}>
          Your answers carry over
        </h2>
        <p className={`text-slate-500 ${editorialClassName}`}>
          {carriedCount > 0
            ? `${carriedCount} details and files from your ${source} application are already filled in. Edit anything that has changed.`
            : `Fill in the ${target} application below.`}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-labelledby="change-new-heading" className="rounded-[32px] border border-[#B9D9EB] bg-white p-6 md:p-8">
          <div className="flex items-center justify-between gap-3">
            <h3 id="change-new-heading" className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#1F5D8F]">
              New for {target}
            </h3>
            {newFields.length > 0 ? (
              <span className="rounded-full bg-[#EAF4FB] px-3 py-1 text-[11px] font-bold tabular-nums text-[#1F5D8F]">
                {remaining.length} to add
              </span>
            ) : null}
          </div>

          {newFields.length === 0 ? (
            <p className="mt-5 text-sm leading-relaxed text-slate-600">
              {target} asks for the same details as {source}. Review each step and send the request.
            </p>
          ) : (
            <div className="mt-5 space-y-6">
              {groups.map(([step, items]) => (
                <div key={step}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    {stepTitles[step]?.en ?? `Step ${step}`}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {items.map((item) => {
                      const isOpen = remainingFields.has(item.field);
                      return (
                        <li key={item.field}>
                          <button
                            type="button"
                            onClick={() => onJump(item.step)}
                            className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[#F4F9FD] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9D9EB]/50"
                          >
                            {isOpen ? (
                              <CircleDashed aria-hidden className="size-4 shrink-0 text-[#72A0C1]" />
                            ) : (
                              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-600" />
                            )}
                            <span className={`text-sm ${isOpen ? "text-slate-900" : "text-slate-400 line-through"}`}>
                              {labelFor(item.field)}
                            </span>
                            <span className="sr-only">{isOpen ? "still to add" : "added"}</span>
                            <ArrowRight aria-hidden className="ml-auto size-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#72A0C1]" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="change-price-heading" className="rounded-[32px] border border-slate-200 bg-white p-6 md:p-8">
          <h3 id="change-price-heading" className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#708090]">
            What it costs
          </h3>
          <div className="mt-3">
            <PriceLedger change={change} />
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#F8FBFD] p-4 text-sm leading-relaxed text-slate-600">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-[#72A0C1]" />
            <p>
              Nothing changes until we approve the request and you pay the difference.
              Your current membership stays active in the meantime.
            </p>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

export function ChangeSidebar({
  change,
  remaining,
  labelFor,
  onJump,
}: {
  change: ChangeSummary;
  remaining: readonly NewApplicationField[];
  labelFor: (field: string) => string;
  onJump: (step: number) => void;
}) {
  return (
    <>
      <div className="rounded-[36px] border border-slate-100 bg-white p-8 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#708090]">Your change</p>
        <p className="mt-4 text-lg font-semibold text-slate-900">
          {change.fromCategory} <span className="text-slate-400">to</span> {change.toCategory}
        </p>
        <div className="mt-2">
          <PriceLedger change={{ ...change, expiresAt: change.expiresAt }} />
        </div>
      </div>

      <div className="rounded-[36px] border border-[#B9D9EB] bg-white p-8 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#1F5D8F]">Still to send</p>
        {remaining.length === 0 ? (
          <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-slate-600">
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            Everything new for {change.toCategory} is filled in. Review the last step and send.
          </p>
        ) : (
          <ul className="mt-3 space-y-1" aria-live="polite">
            {remaining.map((item) => (
              <li key={item.field}>
                <button
                  type="button"
                  onClick={() => onJump(item.step)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-slate-700 transition-colors hover:bg-[#F4F9FD] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9D9EB]/50"
                >
                  <CircleDashed aria-hidden className="size-3.5 shrink-0 text-[#72A0C1]" />
                  {labelFor(item.field)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
