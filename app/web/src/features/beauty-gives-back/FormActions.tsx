"use client";

import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { BEAUTY_GIVES_BACK_CONFIG } from "./config";
import { safeHttpsUrl } from "./catalog";
import type { CampaignCopy } from "./messages";
import styles from "./campaign.module.css";

export function FormActions({ copy }: { copy: CampaignCopy }) {
  return (
    <div className={styles.actions}>
      {(["offer", "request"] as const).map((type) => {
        const url = safeHttpsUrl(
          BEAUTY_GIVES_BACK_CONFIG[
            type === "offer" ? "offerFormUrl" : "requestFormUrl"
          ],
        );
        const className = `${styles.button} ${type === "offer" ? styles.primary : styles.secondary}`;
        const content = (
          <>
            {copy[type]}
            <ArrowRight size={17} aria-hidden="true" />
          </>
        );
        return url ? (
          <a
            key={type}
            className={className}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content}
          </a>
        ) : (
          <button
            key={type}
            type="button"
            className={className}
            onClick={() => toast.info(copy.formUnavailable)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
