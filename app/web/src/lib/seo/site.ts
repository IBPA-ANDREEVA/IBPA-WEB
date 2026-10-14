/** The one public origin search engines should index. */
export const CANONICAL_SITE_ORIGIN = "https://www.ibpassociations.org";

/**
 * Default share image (1200x630) used for Open Graph and Twitter cards.
 * Lives in `public/` so it is served at a stable, crawlable URL.
 */
export const DEFAULT_OG_IMAGE = {
  url: "/og/ibpa-og.jpg",
  width: 1200,
  height: 630,
  alt: "International Beauty Professionals Association (IBPA)",
} as const;

/**
 * Origin used for every SEO-facing absolute URL: canonical links, Open Graph
 * URLs, sitemap entries, robots.txt, and JSON-LD.
 *
 * This is intentionally independent of runtime environment variables. A
 * stale apex-domain value, local development origin, or Vercel preview host
 * must not leak into public search signals or structured data.
 */
export function getSeoOrigin(): string {
  return CANONICAL_SITE_ORIGIN;
}

/** Absolute URL on the SEO origin. `absoluteUrl("/")` is the bare origin plus a slash. */
export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSeoOrigin()}${normalizedPath}`;
}
