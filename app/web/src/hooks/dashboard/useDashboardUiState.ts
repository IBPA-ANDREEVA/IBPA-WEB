"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  SupportMode,
  TabType,
} from "@/components/dashboard/dashboard-types";

export function useDashboardUiState() {
  // Pages outside the tab shell (e.g. the webinar player) link back with
  // ?tab=webinars. Search params are available during SSR too, so the initial
  // tab is identical on server and client.
  const searchParams = useSearchParams();
  const pathname=usePathname(); const router=useRouter();
  const routeTab = pathname === '/dashboard/sales' ? 'sales' : pathname === '/dashboard/notifications' ? 'notifications' : searchParams?.get('tab') || 'dashboard';
  const activeTab = (['dashboard','profile','certificates','billing','sales','events','webinars','directory','support','accountSettings','notifications','teamMembers'].includes(routeTab) ? routeTab : 'dashboard') as TabType;
  const setActiveTab: React.Dispatch<React.SetStateAction<TabType>> = (value) => {
    const tab=typeof value==='function'?value(activeTab):value;
    router.push(tab==='sales'||tab==='notifications'?`/dashboard/${tab}`:`/dashboard?tab=${tab}`);
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [eventRegistrationFilter, setEventRegistrationFilter] = useState<
    "all" | "registered" | "not_registered"
  >("all");
  const [supportMode, setSupportMode] = useState<SupportMode>("question");

  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow =
      isMobileMenuOpen || isNotificationsOpen
        ? "hidden"
        : previousOverflow || "";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen, isNotificationsOpen]);

  return {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isNotificationsOpen,
    setIsNotificationsOpen,
    eventRegistrationFilter,
    setEventRegistrationFilter,
    supportMode,
    setSupportMode,
  };
}
