import type { Metadata } from "next";
import { cookies } from "next/headers";
import { fetchPublicContentServer } from "@/lib/public-content-server";
import { EventsPageClient } from "./EventsPageClient";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { resolveLocale } from "@/lib/locale";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getLocalizedPageSeo } from "@/lib/seo/pages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  return buildPageMetadata({ ...getLocalizedPageSeo("events", locale), locale });
}

export default async function EventsPage() {
  // Rendering the list on the server puts the events in the HTML that search
  // engines and AI crawlers read, instead of only the built-in fallback event.
  const [initialItems, cookieStore] = await Promise.all([
    fetchPublicContentServer("events"),
    cookies(),
  ]);
  const locale = resolveLocale(cookieStore.get("ibpa-locale")?.value);

  return <><BreadcrumbJsonLd page={getLocalizedPageSeo("events", locale)} /><EventsPageClient initialItems={initialItems} /></>;
}
