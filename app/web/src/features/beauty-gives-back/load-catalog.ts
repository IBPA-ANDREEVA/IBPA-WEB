import { BEAUTY_GIVES_BACK_CONFIG, CATALOG_TIMEOUT_MS } from "./config";
import { parseCatalog, safeHttpsUrl, type CatalogResult } from "./catalog";

export async function loadCatalog(
  url = BEAUTY_GIVES_BACK_CONFIG.catalogCsvUrl,
  fetcher: typeof fetch = fetch,
): Promise<CatalogResult> {
  if (!url) return { state: "unconfigured", items: [] };
  const parsed = new URL(safeHttpsUrl(url));
  if (
    parsed.hostname !== "docs.google.com" ||
    !/^\/spreadsheets\/d\/e\/[^/]+\/pub$/.test(parsed.pathname) ||
    parsed.searchParams.get("output") !== "csv" ||
    !/^\d+$/.test(parsed.searchParams.get("gid") ?? "") ||
    parsed.searchParams.get("single") !== "true"
  )
    throw new Error("Expected a published single-worksheet Google CSV URL");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
  try {
    const response = await fetcher(parsed.href, {
      signal: controller.signal,
      next: { revalidate: 60 },
      credentials: "omit",
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/csv")
    )
      throw new Error("Catalog is unavailable");
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("Catalog exceeds size limit");
    return { state: "ready", items: parseCatalog(text) };
  } finally {
    clearTimeout(timeout);
  }
}
