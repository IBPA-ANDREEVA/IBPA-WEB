import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { resolveLocale } from "@/lib/locale";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getLocalizedPageSeo } from "@/lib/seo/pages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  return buildPageMetadata({ ...getLocalizedPageSeo("standards", locale), locale });
}

export default async function StandardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  const pageSeo = getLocalizedPageSeo("standards", locale);
  return (
    <>
      <BreadcrumbJsonLd page={pageSeo} />
      {children}
    </>
  );
}
