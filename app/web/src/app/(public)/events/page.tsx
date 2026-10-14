import { fetchPublicContentServer } from "@/lib/public-content-server";
import { EventsPageClient } from "./EventsPageClient";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";

export const metadata = buildPageMetadata(PAGE_SEO.events);

export default async function EventsPage() {
  // Rendering the list on the server puts the events in the HTML that search
  // engines and AI crawlers read, instead of only the built-in fallback event.
  const initialItems = await fetchPublicContentServer("events");

  return <><BreadcrumbJsonLd page={PAGE_SEO.events} /><EventsPageClient initialItems={initialItems} /></>;
}
