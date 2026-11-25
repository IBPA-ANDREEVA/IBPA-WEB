import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/lib/locale";
import { CAMPAIGN_MESSAGES } from "./messages";
import styles from "./campaign.module.css";

export function CampaignBanner({ locale }: { locale: Locale }) {
  const copy = CAMPAIGN_MESSAGES[locale];
  return (
    <aside className={styles.banner} aria-label="Beauty Gives Back">
      <div className={`${styles.wrap} ${styles.bannerInner}`}>
        <div>
          <strong>Beauty Gives Back</strong>
          <span>Thanksgiving Edition 2026 · {copy.dates}</span>
        </div>
        <Link href="/beauty-gives-back">
          {copy.join}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
