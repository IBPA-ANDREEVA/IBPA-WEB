import { cookies } from "next/headers";
import { CampaignPage } from "@/features/beauty-gives-back/CampaignPage";
import { getLocalizedPageSeo } from "@/lib/seo/pages";
import { resolveLocale } from "@/lib/locale";
import { buildPageMetadata } from "@/lib/seo/metadata";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  return buildPageMetadata({
    ...getLocalizedPageSeo("beautyGivesBack", locale),
    locale,
    noindex: (await searchParams).preview === "1",
  });
}

export default async function Page({ searchParams }: Props) {
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  return (
    <CampaignPage
      locale={locale}
      preview={(await searchParams).preview === "1"}
    />
  );
}
