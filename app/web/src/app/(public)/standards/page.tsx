"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { cyrillicDisplay } from "@/lib/cyrillic-fonts";
import { homeTemplateAccent, homeTemplateDisplay } from "@/lib/home-template-fonts";
import { documentHref, documentLocale, documents } from "@/lib/association-documents";
import { useI18n } from "@/lib/i18n";

export default function Standards() {
  const { locale } = useI18n();
  const isRu = locale === "ru";
  const isUk = locale === "uk";
  const useEnglishTypography = true;
  const headlineClassName = useEnglishTypography
    ? `${homeTemplateDisplay.className} font-bold tracking-[-0.045em]`
    : `${cyrillicDisplay.className} font-light tracking-[-0.03em]`;
  const bodyClassName = "font-sans font-medium tracking-[-0.01em]";
  const uiClassName = "font-sans font-semibold tracking-[0.08em]";

  const copy = {
    eyebrow: isRu ? "Библиотека документов" : isUk ? "Бібліотека документів" : "Document Library",
    title: isRu ? "Профессиональные стандарты" : isUk ? "Професійні стандарти" : "Professional Standards",
    subtitle: isRu
      ? "Профессиональные стандарты, этический кодекс, правила участия, документы управления и публичные политики IBPA в одной библиотеке. Каждый файл открывается в новой вкладке."
      : isUk
        ? "Професійні стандарти, етичний кодекс, правила членства, документи управління та публічні політики IBPA в одній бібліотеці. Кожен файл відкривається в новій вкладці."
        : "IBPA professional standards, ethics, membership rules, governance documents, and public policies in one library. Each file opens in a new tab.",
    introTitle: isRu ? "Стандарты и политики beauty-индустрии" : isUk ? "Стандарти та політики beauty-індустрії" : "Beauty Industry Professional Standards & Policies",
    introBody: isRu
      ? "Библиотека объединяет профессиональные стандарты IBPA, этический кодекс, правила участия, документы управления и политики организации. Откройте PDF, чтобы ознакомиться с полным текстом, областью применения и указанной датой вступления в силу."
      : isUk
        ? "Бібліотека об’єднує професійні стандарти IBPA, етичний кодекс, правила членства, документи управління та політики організації. Відкрийте PDF, щоб ознайомитися з повним текстом, сферою застосування та вказаною датою набрання чинності."
        : "This library brings together IBPA professional standards, its code of ethics, membership rules, governance documents, and organizational policies. Open each PDF to review its full scope and stated effective date.",
    archiveLabel: isRu ? "Документов в библиотеке" : isUk ? "Документів у бібліотеці" : "Documents in the library",
    archiveValue: `${documents.length}`,
    cta: isRu ? "Открыть PDF" : isUk ? "Відкрити PDF" : "Open PDF",
    helper: isRu
      ? "Откройте документ, чтобы проверить полный текст, область применения и указанную дату вступления в силу."
      : isUk
        ? "Відкрийте документ, щоб перевірити повний текст, сферу застосування та вказану дату набрання чинності."
        : "Open a document to review its full text, scope, and stated effective date.",
  };

  return (
    <div className="min-h-screen bg-white selection:bg-[#B9D9EB] selection:text-black">
      <section className="relative flex h-[calc(60vh+70px)] items-center justify-center overflow-hidden bg-[#F1F3F5]">
        <div className="absolute inset-0">
          <ImageWithFallback
            src="/home/website-9.webp"
            className="h-full w-full object-cover md:object-[center_28%]"
            alt={isRu ? "Документы IBPA" : isUk ? "Документи IBPA" : "IBPA documents"}
          />
        </div>
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-24 md:py-32">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`max-w-5xl text-6xl sm:text-7xl uppercase leading-[0.92] text-[#B9D9EB] md:text-9xl ${headlineClassName}`}
          >
            {copy.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className={`max-w-3xl text-3xl lowercase text-slate-400 md:-mt-6 md:text-5xl ${homeTemplateAccent.className}`}
          >
            {isRu ? "архив документов" : isUk ? "архів документів" : "document archive"}
          </motion.p>
        </div>
      </section>

      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className={`text-4xl uppercase leading-[0.94] text-slate-900 md:text-[4.85rem] ${headlineClassName}`}>
              {copy.introTitle}
            </h2>
            <p className={`max-w-2xl text-lg leading-relaxed text-slate-600 md:text-[1.18rem] ${bodyClassName}`}>{copy.introBody}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="rounded-[36px] bg-[#F1F3F5] p-8 shadow-[0_18px_55px_rgba(39,54,72,0.08)]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#72A0C1] shadow-[0_12px_34px_rgba(39,54,72,0.05)]">
                <ShieldCheck size={24} />
              </div>
              <div className="space-y-1">
                <p className={`text-[10px] uppercase text-slate-400 ${uiClassName}`}>{copy.archiveLabel}</p>
                <p className={`text-5xl leading-none text-slate-900 ${headlineClassName}`}>{copy.archiveValue}</p>
              </div>
            </div>
            <p className={`mt-6 text-sm leading-relaxed text-slate-500 md:text-base ${bodyClassName}`}>{copy.helper}</p>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#F1F3F5] py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document, index) => {
              const title = document.title[locale];
              const description = document.description[locale];
              const href = documentHref(document.slug, locale);

              return (
                <motion.div
                  key={document.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.03 }}
                  className="group flex h-full flex-col rounded-[34px] bg-white p-7 shadow-[0_18px_55px_rgba(39,54,72,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(39,54,72,0.12)] md:p-8"
                >
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F3F5] text-[#72A0C1] transition-colors group-hover:bg-[#72A0C1] group-hover:text-white">
                      <FileText size={24} />
                    </div>
                    <span className={`text-[10px] uppercase text-slate-300 ${uiClassName}`}>
                      PDF · {documentLocale(locale).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col">
                    <h3 className={`text-2xl uppercase leading-[0.96] text-slate-900 md:text-[2rem] ${headlineClassName}`}>
                      {title}
                    </h3>
                    <p className={`mt-5 flex-1 text-base leading-relaxed text-slate-600 md:text-[1.04rem] ${bodyClassName}`}>{description}</p>
                  </div>

                  <div className="mt-8">
                    <Link
                      href={href}
                      aria-label={`${copy.cta}: ${title} (PDF · ${documentLocale(locale).toUpperCase()})`}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-3 text-sm uppercase text-slate-900 transition-colors hover:text-[#72A0C1] ${uiClassName}`}
                    >
                      {copy.cta}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
