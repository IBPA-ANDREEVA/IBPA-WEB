"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { PreservedText } from "@/components/content/PreservedText";
import { homeTemplateDisplay } from "@/lib/home-template-fonts";
import { cyrillicEditorial } from "@/lib/cyrillic-fonts";
import type { Locale, PartnerCard } from "@/lib/partners";
import styles from "./PartnersShowcase.module.css";

const copy = {
  en: {
    eyebrow: "The IBPA network",
    title: "Our partners",
    featured: "Partner spotlight",
    website: "Visit website",
    partnership: "Become a partner",
    select: "Explore our partners",
  },
  ru: {
    eyebrow: "Вместе с IBPA",
    title: "Наши партнёры",
    featured: "Знакомьтесь с партнёром",
    website: "Перейти на сайт",
    partnership: "Стать партнёром",
    select: "Познакомьтесь с нашими партнёрами",
  },
  uk: {
    eyebrow: "Разом з IBPA",
    title: "Наші партнери",
    featured: "Знайомтеся з партнером",
    website: "Перейти на сайт",
    partnership: "Стати партнером",
    select: "Познайомтеся з нашими партнерами",
  },
};

export function PartnersShowcase({
  locale,
  partners,
}: {
  locale: Locale;
  partners: PartnerCard[];
}) {
  const [selectedId, setSelectedId] = useState(partners[0]?.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const content = copy[locale];
  const selectedIndex = Math.max(
    0,
    partners.findIndex((partner) => partner.id === selectedId),
  );
  const displayFont =
    locale === "en"
      ? homeTemplateDisplay.className
      : cyrillicEditorial.className;

  if (partners.length === 0) return null;

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % partners.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + partners.length) % partners.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = partners.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelectedId(partners[nextIndex].id);
    tabRefs.current[nextIndex]?.focus({ preventScroll: true });
    tabRefs.current[nextIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{content.eyebrow}</p>
          <h2
            id={`${id}-heading`}
            className={`${styles.heading} ${displayFont}`}
          >
            {content.title}
          </h2>
        </header>

        <div className={styles.panels}>
          {partners.map((partner, index) => (
            <div
              key={partner.id}
              id={`${id}-panel-${index}`}
              role={partners.length > 1 ? "tabpanel" : "region"}
              aria-labelledby={
                partners.length > 1
                  ? `${id}-tab-${index}`
                  : `${id}-name-${index}`
              }
              aria-hidden={index !== selectedIndex}
              inert={index !== selectedIndex}
              tabIndex={index === selectedIndex ? 0 : -1}
              className={`${styles.panel} ${index !== selectedIndex ? styles.inactive : ""}`}
            >
              <div className={styles.logoStage}>
                <div className={styles.logoCard}>
                  <ImageWithFallback
                    src={partner.logo}
                    alt={partner.name}
                    width={280}
                    height={140}
                    sizes="(max-width: 640px) 180px, 240px"
                    className={styles.featuredLogo}
                  />
                </div>
              </div>
              <div className={styles.details}>
                <p className={styles.eyebrow}>{content.featured}</p>
                <h3
                  id={`${id}-name-${index}`}
                  className={`${styles.partnerName} ${displayFont}`}
                >
                  {partner.name}
                </h3>
                <PreservedText className={styles.description}>
                  {partner.description}
                </PreservedText>
                {partner.link && (
                  <a
                    className={styles.link}
                    href={partner.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {content.website}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {partners.length > 1 && (
          <div
            className={styles.tabs}
            role="tablist"
            aria-label={content.select}
          >
            {partners.map((partner, index) => (
              <button
                key={partner.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`${id}-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={index === selectedIndex}
                aria-controls={`${id}-panel-${index}`}
                aria-label={partner.name}
                tabIndex={index === selectedIndex ? 0 : -1}
                className={styles.tab}
                onClick={() => setSelectedId(partner.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <ImageWithFallback
                  src={partner.logo}
                  alt=""
                  width={112}
                  height={48}
                  sizes="96px"
                  className={styles.tabLogo}
                />
              </button>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <Link href="/partnership" className={styles.link}>
            {content.partnership}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
