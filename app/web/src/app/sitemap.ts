import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { fetchPublicContentServer } from "@/lib/public-content-server";
import { canonicalizePublicNews } from "@/lib/public-content";
import { contentPath } from "@/lib/seo/content";

export const revalidate = 300;

/**
 * Google ignores `priority` and `changefreq`, and only trusts `lastmod` when
 * it is accurate, so entries carry a `lastModified` only when a real date is
 * recorded in `INDEXABLE_ROUTES`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, events] = await Promise.all([fetchPublicContentServer("news"), fetchPublicContentServer("events")]);
  // Preserve the last successfully generated sitemap on a transient API failure.
  // Never cache a successful but silently truncated sitemap.
  if (news === null || events === null) throw new Error("Public sitemap content is temporarily unavailable");
  return [...INDEXABLE_ROUTES.map(({ path, lastModified }) => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
  })), ...[...canonicalizePublicNews(news, events).filter((item) => !item.canonicalPath), ...events]
    .map((item) => ({ url: absoluteUrl(contentPath(item)) }))];
}
