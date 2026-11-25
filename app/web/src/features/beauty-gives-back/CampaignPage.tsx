import { Suspense } from "react";
import { CalendarDays, Check, Mail } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { SectionPattern } from "@/components/landing/SectionPattern";
import { cyrillicEditorial } from "@/lib/cyrillic-fonts";
import {
  homeTemplateAccent,
  homeTemplateDisplay,
} from "@/lib/home-template-fonts";
import type { Locale } from "@/lib/locale";
import { CAMPAIGN_MESSAGES } from "./messages";
import { FormActions } from "./FormActions";
import { CatalogExperience } from "./CatalogExperience";
import styles from "./campaign.module.css";

export async function CampaignPage({
  locale,
  preview,
}: {
  locale: Locale;
  preview: boolean;
}) {
  const copy = CAMPAIGN_MESSAGES[locale];
  const previewItems = preview
    ? (await import("./sample")).SAMPLE_LISTINGS
    : undefined;
  return (
    <div className={`${styles.page} ${cyrillicEditorial.variable}`}>
      <section className={styles.hero} aria-labelledby="campaign-title">
        <SectionPattern variant="right" />
        <div className={`${styles.wrap} ${styles.heroGrid}`}>
          <div>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1
              id="campaign-title"
              className={`${styles.title} ${homeTemplateDisplay.className}`}
              lang="en"
            >
              Beauty
              <br />
              Gives Back
            </h1>
            <div className={styles.edition}>
              <strong lang="en">Thanksgiving Edition 2026</strong>
              <span>
                <CalendarDays size={17} aria-hidden="true" />
                {copy.dates}
              </span>
            </div>
            <p
              className={`${styles.tagline} ${homeTemplateAccent.className}`}
              lang="en"
            >
              Beauty. Gratitude. Community.
            </p>
            <p className={styles.lede}>{copy.description}</p>
            <FormActions copy={copy} />
          </div>
          <div className={styles.photo}>
            <ImageWithFallback
              src="/home/main-hero-section.webp"
              alt={copy.imageAlt}
              width={900}
              height={1000}
              sizes="(min-width: 1024px) 40vw, 100vw"
              priority
            />
          </div>
        </div>
      </section>
      <Suspense fallback={<div className={styles.empty}>{copy.loading}</div>}>
        <CatalogExperience
          copy={copy}
          locale={locale}
          previewItems={previewItems}
        >
          <section className={`${styles.wrap} ${styles.information}`}>
            <div className={styles.infoGrid}>
              <div>
                <p className={styles.eyebrow}>{copy.participation}</p>
                <h2 className={styles.heading}>{copy.how}</h2>
                <ol className={styles.steps}>
                  {copy.steps.map((step, index) => (
                    <li key={step.title}>
                      <span aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className={styles.eyebrow}>{copy.trust}</p>
                <h2 className={styles.heading}>{copy.rulesTitle}</h2>
                <ul className={styles.rules}>
                  {copy.rules.map((rule) => (
                    <li key={rule}>
                      <Check size={16} aria-hidden="true" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={styles.ideas}>
              <h3>{copy.ideasTitle}</h3>
              <ul>
                {copy.ideas.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            </div>
          </section>
        </CatalogExperience>
      </Suspense>
      <div className={`${styles.wrap} ${styles.attribution}`}>
        <p>{copy.attribution}</p>
        <a href="mailto:support@ibpassociations.org">
          <Mail size={17} aria-hidden="true" />
          support@ibpassociations.org
        </a>
      </div>
    </div>
  );
}
