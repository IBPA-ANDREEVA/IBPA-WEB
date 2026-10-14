import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import { fetchPublicContentServer } from "@/lib/public-content-server";
import { canonicalizePublicNews } from "@/lib/public-content";
import type { PublicContentItem } from "@/lib/public-content";
import { contentPath } from "@/lib/seo/content";

export const revalidate = 300;

type PublicContentType = "news" | "events";

function isIndexablePublishedItem(
  item: PublicContentItem,
  expectedType: PublicContentType,
) {
  return item.type === expectedType &&
    item.publishToSite === true &&
    /^[a-zA-Z0-9-]+$/.test(item.id) &&
    item.id.length <= 128;
}

/** Use the database modification timestamp only when it is a valid instant. */
function reliableLastModified(item: PublicContentItem) {
  if (!item.updatedAt) return undefined;
  const timestamp = Date.parse(item.updatedAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function buildSitemapEntries(
  news: PublicContentItem[],
  events: PublicContentItem[],
): MetadataRoute.Sitemap {
  const publishedEvents = events.filter((item) => isIndexablePublishedItem(item, "events"));
  const publishedNews = canonicalizePublicNews(
    news.filter((item) => isIndexablePublishedItem(item, "news")),
    publishedEvents,
  ).filter((item) => !item.canonicalPath);

  const entries: MetadataRoute.Sitemap = [
    ...INDEXABLE_ROUTES.map(({ path, lastModified }) => ({
      url: absoluteUrl(path),
      ...(lastModified ? { lastModified } : {}),
    })),
    ...[...publishedNews, ...publishedEvents].map((item) => {
      const lastModified = reliableLastModified(item);
      return {
        url: absoluteUrl(contentPath(item)),
        ...(lastModified ? { lastModified } : {}),
      };
    }),
  ];

  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}

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
  return buildSitemapEntries(news, events);
}
