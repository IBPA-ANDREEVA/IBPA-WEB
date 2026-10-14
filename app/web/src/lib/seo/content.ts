import type { PublicContentItem } from "@/lib/public-content";
import { buildPageMetadata } from "./metadata";
import { absoluteUrl } from "./site";
import { organizationId, websiteId, type JsonLdObject } from "./json-ld";

export function contentPath(item: Pick<PublicContentItem, "id" | "type" | "canonicalPath">) {
  return item.canonicalPath || `/${item.type}/${encodeURIComponent(item.id)}`;
}

export function contentDescription(item: Pick<PublicContentItem, "body" | "title">) {
  const text = (item.body || item.title).replace(/\s+/g, " ").trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

export function contentImageUrl(item: PublicContentItem) {
  return publicHttpUrl(item.imageMetadata?.url || item.coverImage);
}

/** Accept only real web destinations, never executable or protocol-relative URLs. */
export function publicHttpUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return absoluteUrl(value);
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Invalid optional URLs are omitted. */ }
  return undefined;
}

export function contentMetadata(item: PublicContentItem) {
  const metadata = buildPageMetadata({
    title: item.title,
    description: contentDescription(item),
    path: contentPath(item),
  });
  const image = contentImageUrl(item);
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: item.type === "news" ? "article" as const : "website" as const,
      ...(image ? { images: [{ url: image, alt: item.imageMetadata?.alt || item.title }] } : {}),
    },
    twitter: { ...metadata.twitter, ...(image ? { images: [image] } : {}) },
  };
}

export function contentJsonLd(item: PublicContentItem): JsonLdObject[] {
  const url = absoluteUrl(contentPath(item));
  const page: JsonLdObject = {
    "@context": "https://schema.org", "@type": "WebPage", "@id": `${url}#webpage`,
    url, name: item.title, description: contentDescription(item),
    isPartOf: { "@id": websiteId() },
  };
  const image = contentImageUrl(item);
  if (item.type === "news") {
    // createdAt is a database creation time, not a verified publication date.
    // There is no author field/byline: omit both instead of inventing them.
    return [page, {
      "@context": "https://schema.org", "@type": "Article", "@id": `${url}#article`,
      headline: item.title, description: contentDescription(item), url,
      mainEntityOfPage: { "@id": `${url}#webpage` },
      publisher: { "@id": organizationId() }, ...(image ? { image: [image] } : {}),
    }];
  }
  // The public event feed's schedule conflicts with its published announcement
  // (June 27 versus September 25–26, verified in docs/SEO_AUDIT.md).
  // Withhold Event markup until editorial data and venue timezone are verified.
  // Do not infer a replacement date from prose or use database creation times.
  return [page];
}
