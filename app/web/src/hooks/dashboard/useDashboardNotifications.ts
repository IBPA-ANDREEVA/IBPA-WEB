"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Restore existing browser preferences after hydration. */

import {useNotifications} from "@/features/notifications/NotificationProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSystemNotifications,
  normalizeNotifications,
  type DashboardNotification,
} from "@/lib/notifications";
import {
  defaultNotificationPreferences,
  getDashboardStatus,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/lib/dashboard-cabinet";

const DASHBOARD_SYSTEM_NOTIFICATIONS_SEEN_KEY =
  "ibpa-dashboard-system-notifications-seen";
const DASHBOARD_NOTIFICATION_PREFS_KEY =
  "ibpa-dashboard-notification-preferences";

export function getNotificationSignature(notification: DashboardNotification) {
  return `${notification.id}:${notification.timestamp}`;
}

export function getNotificationMeta(notification: DashboardNotification) {
  const category = notification.category || "admin";
  const priority = notification.priority || "medium";

  const categoryLabelMap: Record<string, string> = {
    membership: "Membership",
    certificate: "Certificate",
    content: "Opportunity",
    admin: "Admin",
    system: "System",
  };

  const priorityLabelMap: Record<string, string> = {
    high: "High priority",
    medium: "Update",
    low: "Info",
  };

  const categoryClassMap: Record<string, string> = {
    membership: "border border-sky-200 bg-sky-50 text-sky-700",
    certificate: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    content: "border border-violet-200 bg-violet-50 text-violet-700",
    admin: "border border-amber-200 bg-amber-50 text-amber-700",
    system: "border border-slate-200 bg-slate-100 text-slate-600",
  };

  const priorityClassMap: Record<string, string> = {
    high: "border border-rose-200 bg-rose-50 text-rose-700",
    medium: "border border-cyan-200 bg-cyan-50 text-cyan-700",
    low: "border border-zinc-200 bg-zinc-100 text-zinc-600",
  };

  return {
    categoryLabel: categoryLabelMap[category],
    priorityLabel: priorityLabelMap[priority],
    categoryClassName: categoryClassMap[category],
    priorityClassName: priorityClassMap[priority],
  };
}

type StatusSummary = ReturnType<typeof getDashboardStatus>;

type Params = {
  customNotifications: DashboardNotification[];
  hasApprovedCert: boolean;
  membershipCategoryLabel: string;
  primaryCertificate?: {
    certNumber: string;
    membershipCategory?: string | null;
    createdAt: string;
    expiresAt?: string | null;
  };
  userCreatedAt?: string;
};

export function useDashboardNotifications(_params: Params) {
 const {items,unreadCount}=useNotifications();
 const [notificationPreferences,setNotificationPreferences]=useState<NotificationPreferences>(defaultNotificationPreferences);
 useEffect(()=>{
  try {
   const stored=window.localStorage.getItem(DASHBOARD_NOTIFICATION_PREFS_KEY);
   if(stored) setNotificationPreferences({...defaultNotificationPreferences,...JSON.parse(stored)});
  } catch { /* Keep safe defaults when browser storage is unavailable. */ }
 },[]);
 const togglePreference=useCallback((key:NotificationPreferenceKey)=>setNotificationPreferences(prev=>{
 const next={...prev,[key]:!prev[key]};
 try {window.localStorage.setItem(DASHBOARD_NOTIFICATION_PREFS_KEY,JSON.stringify(next));} catch { /* Preferences still work for this session. */ }
 return next;
 }),[]);
 return {allNotifications:items,alertCards:items.slice(0,3),unreadNotificationsCount:unreadCount,notificationPreferences,togglePreference,getNotificationMeta};
}
