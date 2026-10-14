import { fetchPublicNewsServer } from "@/lib/public-content-server";
import { NewsPageClient } from "./NewsPageClient";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";

export const metadata = buildPageMetadata(PAGE_SEO.news);

export default async function NewsPage() {
  // Rendering the list on the server puts the news items in the HTML that
  // search engines and AI crawlers read, instead of a "Loading news..." state.
  const initialItems = await fetchPublicNewsServer();

  return <><BreadcrumbJsonLd page={PAGE_SEO.news} /><NewsPageClient initialItems={initialItems} /></>;
}
