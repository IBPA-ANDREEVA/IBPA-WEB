import { getServerBackendUrl } from "@/lib/backend-url";
import { cache } from "react";
import { canonicalizePublicNews, normalizePublicContentItems, type PublicContentItem } from "@/lib/public-content";

/**
 * Fetches published site content during server rendering so lists such as
 * /news and /events are present in the HTML that search engines receive.
 *
 * Uses the same backend endpoint, cache lifetime, and `public-content` tag as
 * the /api/content proxy, so admin edits that call `revalidateTag` refresh
 * these pages exactly as they refresh the homepage sections.
 *
 * Returns `null` when the backend cannot be reached, so callers can fall back
 * to client-side loading instead of showing an empty list as if it were fact.
 */
export async function fetchPublicContentServer(
  type: "news" | "events" | "partners",
  target: "site" | "dashboard" = "site",
): Promise<PublicContentItem[] | null> {
  const backendUrl = getServerBackendUrl();
  if (!backendUrl) {
    return null;
  }

  try {
    const response = await fetch(`${backendUrl}/api/content/public?type=${type}&target=${target}`, {
      next: { revalidate: 300, tags: ["public-content"] },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    return Array.isArray(data?.items) ? normalizePublicContentItems(data.items) : null;
  } catch {
    return null;
  }
}

export async function fetchPublicNewsServer() {
  const [news, events] = await Promise.all([fetchPublicContentServer("news"), fetchPublicContentServer("events")]);
  if (news === null || events === null) return null;
  return canonicalizePublicNews(news, events);
}

/** Only the published SITE feed may populate indexable detail pages. */
export const getPublicContentItem = cache(async (type: "news" | "events", id: string) => {
  if (!/^[a-zA-Z0-9-]+$/.test(id) || id.length > 128) return null;
  const items = type === "news" ? await fetchPublicNewsServer() : await fetchPublicContentServer(type, "site");
  // An outage is not evidence that a published URL has been removed.
  if (items === null) throw new Error("Public content is temporarily unavailable");
  return items.find((item) => item.id === id && item.type === type) ?? null;
});
