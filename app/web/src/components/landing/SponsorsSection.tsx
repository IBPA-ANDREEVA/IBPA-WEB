import { fetchPublicContentServer } from "@/lib/public-content-server";
import {
  getDefaultPartnerCards,
  mergePartnerCards,
  type Locale,
} from "@/lib/partners";
import { PartnersShowcase } from "./PartnersShowcase";

export const SponsorsSection = async ({ locale }: { locale: Locale }) => {
  let partners = getDefaultPartnerCards(locale);

  try {
    const items = (await fetchPublicContentServer("partners")) ?? [];
    partners = mergePartnerCards(locale, items);
  } catch {
    // Keep the established partners visible if the content service is unavailable.
  }

  return <PartnersShowcase locale={locale} partners={partners} />;
};
