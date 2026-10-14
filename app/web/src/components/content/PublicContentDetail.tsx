import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { InteractiveContentImage } from "./InteractiveContentImage";
import { PreservedText } from "./PreservedText";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicContentItem } from "@/lib/public-content-server";
import { contentJsonLd, contentPath, publicHttpUrl } from "@/lib/seo/content";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { resolveLocale } from "@/lib/locale";
import { homeTemplateDisplay } from "@/lib/home-template-fonts";

export async function PublicContentDetail({ type, id }: { type: "news" | "events"; id: string }) {
  const item = await getPublicContentItem(type, id);
  if (!item) notFound();
  if (item.canonicalPath) redirect(item.canonicalPath);
  const locale = resolveLocale((await cookies()).get("ibpa-locale")?.value);
  const copy = locale === "ru"
    ? { home: "Главная", news: "Новости", events: "События", more: "Подробнее", date: "Дата события", membership: "Членство в IBPA" }
    : locale === "uk"
      ? { home: "Головна", news: "Новини", events: "Події", more: "Докладніше", date: "Дата події", membership: "Членство в IBPA" }
      : { home: "Home", news: "News", events: "Events", more: "Learn more", date: "Event date", membership: "IBPA membership" };
  const parent = { name: copy[type], path: `/${type}` };
  const cta = publicHttpUrl(item.ctaUrl);
  return (
    <div className="min-h-screen bg-[#F1F3F5] pt-40 pb-24">
      <JsonLd data={breadcrumbJsonLd([parent, { name: item.title, path: contentPath(item) }])} />
      <JsonLd data={contentJsonLd(item)} />
      <article className="mx-auto max-w-4xl space-y-8 px-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-600">
          <Link href="/" className="underline underline-offset-4">{copy.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href={parent.path} className="underline underline-offset-4">{parent.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="break-words">{item.title}</span>
        </nav>
        <h1 className={`${homeTemplateDisplay.className} break-words text-4xl font-bold uppercase leading-tight text-slate-900 sm:text-6xl`}>
          {item.title}
        </h1>
        {type === "events" && item.eventAddress ? <p className="text-slate-600">{item.eventAddress}</p> : null}
        {item.imageMetadata?.url || item.coverImage ? (
          <InteractiveContentImage alt={item.imageMetadata?.alt || item.title} metadata={item.imageMetadata}
            legacyUrl={item.coverImage} legacyAspect={item.coverAspect} priority sizes="(min-width: 896px) 848px, 100vw" className="rounded-[28px]" />
        ) : null}
        <PreservedText as="div" className="text-lg leading-relaxed text-slate-700">{item.body}</PreservedText>
        <div className="flex flex-wrap gap-4">
          {cta ? <a href={cta} className="rounded-full bg-black px-8 py-4 text-sm font-semibold text-white hover:bg-[#21466D]">{item.ctaLabel || copy.more}</a> : null}
          <Link href="/membership" className="rounded-full border border-slate-300 px-8 py-4 text-sm font-semibold hover:bg-white">{copy.membership}</Link>
        </div>
      </article>
    </div>
  );
}
