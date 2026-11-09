import type { ContentImageMetadata } from "@/lib/content-image";
export type SaleContent = {
  title?: string;
  shortDescription?: string;
  description?: string;
  ctaLabel?: string;
};
export type SaleItem = {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  price: number | null;
  currency: string;
  compareAtPrice: number | null;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  quantityLimit: number | null;
  onePerAccount: boolean;
  ctaLabel: string | null;
  imagePresentation: ContentImageMetadata | null;
  translations: Partial<Record<"en" | "ru" | "uk", SaleContent>>;
  version: number;
  createdAt: string;
  availability: string | null;
  purchases?: number;
  remaining?: number | null;
  events?: {
    id: string;
    title: string;
    eventDate: string | null;
    eventEndDate: string | null;
    eventAddress: string | null;
  }[];
};
export type SaleOrder = {
  id: string;
  saleId: string;
  userId: string;
  buyerEmail: string;
  itemTitle: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  refundedAmount: number;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  returnPath: string;
};
export function localizedSale<
  T extends {
    title: string;
    description: string;
    translations?: Partial<Record<"en" | "ru" | "uk", SaleContent>>;
  },
>(item: T, locale: "en" | "ru" | "uk"): T {
  const content = item.translations?.[locale];
  return {
    ...item,
    ...Object.fromEntries(
      Object.entries(content || {}).filter(([, value]) => Boolean(value)),
    ),
  };
}
export function money(
  amount: number | string,
  currency = "usd",
  locale = "en",
) {
  const cents = BigInt(amount);
  const sign = cents < BigInt(0) ? "-" : "";
  const abs = cents < BigInt(0) ? -cents : cents;
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    `${sign}${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}` as unknown as number,
  );
}
export function parseMoney(value: string) {
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 50 && cents <= 99999999
    ? cents
    : null;
}
export function decimalMoney(value: number | null) {
  return value == null
    ? ""
    : `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
