export const CATALOG_COLUMNS = [
  "id",
  "type",
  "title",
  "description",
  "name",
  "city",
  "country",
  "specialization",
  "format",
  "language",
  "spots",
  "telegram",
  "instagram",
  "status",
] as const;
export type ListingType = "offer" | "request";
export type ListingStatus = "open" | "in_progress" | "done";
export type Listing = Record<(typeof CATALOG_COLUMNS)[number], string> & {
  type: ListingType;
  status: ListingStatus;
  sample?: boolean;
};
export type CatalogResult = {
  state: "ready" | "unconfigured";
  items: Listing[];
};
export type CatalogFilters = {
  type: "all" | ListingType;
  specialization: string;
  format: string;
  showDone: boolean;
};

export function safeHttpsUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/** Only actual profile hosts and one handle are accepted; never arbitrary URLs. */
export function cleanHandle(
  value: string,
  service: "telegram" | "instagram",
): string {
  let handle = value.trim();
  if (
    /^(https?:\/\/|(?:www\.)?(?:t\.me|telegram\.me|instagram\.com|ig\.me)\/)/i.test(
      handle,
    )
  ) {
    try {
      const url = new URL(
        handle.includes("://") ? handle : `https://${handle}`,
      );
      if (!safeHttpsUrl(url.href) || url.port) return "";
      const hosts =
        service === "telegram"
          ? ["t.me", "telegram.me"]
          : ["instagram.com", "www.instagram.com", "ig.me"];
      if (!hosts.includes(url.hostname)) return "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        service === "instagram" &&
        url.hostname === "ig.me" &&
        parts[0] === "m"
      )
        parts.shift();
      if (parts.length !== 1) return "";
      handle = parts[0];
    } catch {
      return "";
    }
  } else handle = handle.replace(/^@/, "");
  const valid =
    service === "telegram"
      ? /^[A-Za-z][A-Za-z0-9_]{4,31}$/
      : /^(?!\.)(?!.*\.\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;
  const reserved =
    service === "telegram"
      ? ["share", "proxy", "socks", "login", "joinchat", "addstickers"]
      : ["p", "reel", "reels", "stories", "explore", "direct", "accounts"];
  return valid.test(handle) && !reserved.includes(handle.toLowerCase())
    ? handle
    : "";
}

/** RFC 4180-style records, including BOM, escaped quotes and multiline cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        rows.push(row);
        row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else if (c === '"') {
      if (cell || closed) throw new Error("Invalid CSV quoting");
      quoted = true;
    } else {
      if (closed) throw new Error("Invalid CSV after quote");
      cell += c;
    }
  }
  if (quoted) throw new Error("Unterminated CSV field");
  if (cell || row.length || closed) rows.push([...row, cell]);
  return rows;
}

export function parseCatalog(text: string): Listing[] {
  const [header = [], ...rows] = parseCsv(text);
  const columns = header.map((v) => v.trim().toLowerCase());
  // Reject unrelated response tabs and any extra private columns rather than forwarding them.
  if (
    columns.length !== CATALOG_COLUMNS.length ||
    new Set(columns).size !== columns.length ||
    CATALOG_COLUMNS.some((c) => !columns.includes(c))
  )
    throw new Error("Unexpected catalog schema");
  const seen = new Set<string>();
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((row) => {
      if (row.length !== columns.length) throw new Error("Invalid catalog row");
      const raw = Object.fromEntries(
        columns.map((key, i) => [key, row[i].trim()]),
      );
      const types: Record<string, ListingType> = {
        offer: "offer",
        request: "request",
        "предлагаю помощь": "offer",
        "предлагает помощь": "offer",
        "ищу помощь": "request",
        "ищет помощь": "request",
      };
      const statuses: Record<string, ListingStatus> = {
        open: "open",
        in_progress: "in_progress",
        done: "done",
        открыто: "open",
        в_работе: "in_progress",
        завершено: "done",
      };
      const type = types[raw.type.toLowerCase()];
      const status = statuses[raw.status.toLowerCase().replace(/\s+/g, "_")];
      if (!raw.id || !raw.title || !type || !status || seen.has(raw.id))
        throw new Error("Invalid listing identity, type or status");
      seen.add(raw.id);
      return {
        ...raw,
        type,
        status,
        telegram: cleanHandle(raw.telegram, "telegram"),
        instagram: cleanHandle(raw.instagram, "instagram"),
      } as Listing;
    });
}

export function matchesFormat(value: string, filter: string) {
  if (!filter) return true;
  const normalized = value.toLowerCase();
  if (
    ["не важно", "неважно", "будь-який", "any", "hybrid"].includes(normalized)
  )
    return true;
  return (
    filter === "online" ? /онлайн|online/ : /офлайн|оффлайн|offline/
  ).test(normalized);
}
export function filterCatalog(items: Listing[], filters: CatalogFilters) {
  return items.filter(
    (item) =>
      (filters.type === "all" || item.type === filters.type) &&
      (!filters.specialization ||
        item.specialization === filters.specialization) &&
      matchesFormat(item.format, filters.format) &&
      (filters.showDone || item.status !== "done"),
  );
}
export function catalogStats(items: Listing[]) {
  return [
    items.length,
    items.filter((i) => i.type === "offer").length,
    items.filter((i) => i.type === "request").length,
    items.filter((i) => i.status === "done").length,
  ];
}
