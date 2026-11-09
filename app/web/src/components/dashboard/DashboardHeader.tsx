"use client";

import { NotificationBell } from "@/features/notifications/NotificationProvider";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { AnimatePresence, motion } from "motion/react";
import { Bell, LayoutDashboard, LogIn, Menu } from "lucide-react";
import Link from "next/link";

import { dashboardShellContainerClassName } from "@/shared/components/DashboardShared";
import type { DashboardNotification } from "@/lib/notifications";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

type Props = {
  userLoaded: boolean;
  isSignedIn: boolean;
  unreadNotificationsCount: number;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  alertCards: DashboardNotification[];
};

export function DashboardHeader({
  userLoaded,
  isSignedIn,
  unreadNotificationsCount,
  isNotificationsOpen,
  setIsNotificationsOpen,
  setIsMobileMenuOpen,
  alertCards,
}: Props) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className={`${dashboardShellContainerClassName} flex items-center justify-between gap-4 py-4`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 lg:hidden"
            aria-label={t.dashboard.header.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#10203B] text-white shadow-[0_12px_30px_rgba(16,32,59,0.18)]">
            <LayoutDashboard className="h-5 w-5" />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#4C7D9D]">
              IBPA
            </p>
            <p className="text-lg font-semibold tracking-tight text-[#10203B]">
              {t.dashboard.header.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <LanguageSwitcher scrolled />
          </div>
          {isSignedIn && <NotificationBell />}

          {!userLoaded ? (
            <div className="h-11 w-11 animate-pulse rounded-full bg-slate-100" />
          ) : isSignedIn ? (
            <div className="flex items-center gap-3">
              <SignOutButton>
                <button className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-[#4C7D9D]/40 hover:text-[#10203B] md:inline-flex">
                  {t.dashboard.header.signOut}
                </button>
              </SignOutButton>

              <UserButton />
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#10203B] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a3157]"
            >
              <LogIn className="h-4 w-4" />
              {t.dashboard.header.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
