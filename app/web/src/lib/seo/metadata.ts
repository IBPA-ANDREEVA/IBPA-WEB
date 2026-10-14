import type { Metadata } from "next";
import type { Locale } from "@/lib/locale";
import { SITE_DISPLAY_NAME } from "@/lib/seo/organization";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo/site";

/** Suffix appended to inner-page titles by the root layout's title template. */
export const TITLE_SUFFIX = "IBPA";

type PageMetadataInput = {
  /** Page title without the brand suffix, e.g. "Membership Criteria & Review Process". */
  title: string;
  description: string;
  /** Site-relative path, e.g. "/membership". Becomes the canonical URL. */
  path: string;
  /**
   * Use the title exactly as given instead of appending " | IBPA". For pages
   * that need the full brand name in the title, such as the homepage.
   */
  absoluteTitle?: boolean;
  /** Keep the page out of search results. */
  noindex?: boolean;
  /** Locale of the server-rendered page variant. */
  locale?: Locale;
};

const shareImage = {
  url: DEFAULT_OG_IMAGE.url,
  width: DEFAULT_OG_IMAGE.width,
  height: DEFAULT_OG_IMAGE.height,
  alt: DEFAULT_OG_IMAGE.alt,
};

/**
 * Builds the metadata every indexable page needs: title, description, a
 * self-referencing canonical, and matching Open Graph and Twitter cards.
 *
 * Next.js replaces (rather than merges) `openGraph` and `twitter` objects
 * declared in a child segment, so each page restates its own share fields
 * here instead of relying on the root layout.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noindex = false,
  locale = "en",
}: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${TITLE_SUFFIX}`;
  const pageUrl = absoluteUrl(path);
  const shareImageUrl = absoluteUrl(shareImage.url);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      siteName: SITE_DISPLAY_NAME,
      locale: locale === "ru" ? "ru_RU" : locale === "uk" ? "uk_UA" : "en_US",
      url: pageUrl,
      title: fullTitle,
      description,
      images: [{ ...shareImage, url: shareImageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [shareImageUrl],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Metadata for pages that must never be indexed (account, checkout, token pages). */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false },
};
