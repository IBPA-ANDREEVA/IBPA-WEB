"use client";

import {
  Globe,
  Instagram,
  MapPin,
  Monitor,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import type { Listing } from "./catalog";
import type { CampaignCopy } from "./messages";
import styles from "./campaign.module.css";

export function CatalogCard({
  item,
  copy,
}: {
  item: Listing;
  copy: CampaignCopy;
}) {
  const metadata = [
    { value: item.specialization },
    {
      value: [item.city, item.country].filter(Boolean).join(", "),
      Icon: MapPin,
    },
    { value: item.format, Icon: Monitor },
    { value: item.language, Icon: Globe },
    { value: item.spots && `${copy.spots}: ${item.spots}`, Icon: UsersRound },
    { value: item.name && `${copy.author}: ${item.name}`, Icon: UserRound },
  ];
  const contacts = [
    {
      handle: item.telegram,
      label: copy.telegram,
      href: `https://t.me/${encodeURIComponent(item.telegram)}`,
      Icon: Send,
    },
    {
      handle: item.instagram,
      label: copy.instagram,
      href: `https://ig.me/m/${encodeURIComponent(item.instagram)}`,
      Icon: Instagram,
    },
  ].filter((contact) => contact.handle);
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <span
          className={`${styles.kind} ${item.type === "request" ? styles.requestKind : ""}`}
        >
          {copy.type[item.type]}
        </span>
        <span className={`${styles.badge} ${styles[item.status]}`}>
          {copy.status[item.status]}
        </span>
      </div>
      <div className={styles.cardBody}>
        <h3>{item.title}</h3>
        {item.description && (
          <p className={styles.description}>{item.description}</p>
        )}
        <div className={styles.metadata}>
          {metadata
            .filter((m) => m.value)
            .map(({ value, Icon }, i) => (
              <span key={i}>
                {Icon && <Icon size={14} aria-hidden="true" />}
                {value}
              </span>
            ))}
        </div>
        <div className={styles.cardFoot}>
          <p className={styles.id}>{item.id}</p>
          {item.status === "open" &&
            (contacts.length ? (
              <div className={styles.contacts}>
                {contacts.map(({ label, href, Icon }, index) => {
                  const className = `${styles.contact} ${index === 0 ? styles.contactPrimary : ""}`;
                  const content = (
                    <>
                      <Icon size={18} aria-hidden="true" />
                      {label}
                    </>
                  );
                  return item.sample ? (
                    <button
                      key={label}
                      type="button"
                      className={className}
                      onClick={() => toast.info(copy.sampleAction)}
                    >
                      {content}
                    </button>
                  ) : (
                    <a
                      key={label}
                      className={className}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {content}
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className={styles.missingContact}>{copy.noContact}</p>
            ))}
        </div>
      </div>
    </article>
  );
}
