import type { Locale } from "@/lib/locale";

export type PageSeo = {
  /** Canonical, site-relative path. */
  path: string;
  /** Title without the " | IBPA" suffix (added by the `(public)` title template). */
  title: string;
  description: string;
  /** Label used for this page in BreadcrumbList structured data. */
  breadcrumb: string;
};

/**
 * Search metadata for every public page, in one place so titles stay unique
 * and so tests can enforce length and uniqueness rules.
 *
 * Keyword targeting (see SEO_REPORT.md):
 * - Homepage: the organization and "international beauty association".
 * - /membership: "beauty association membership" (transactional).
 * Do not repeat those phrases on the other pages.
 */
export const PAGE_SEO = {
  home: {
    path: "/",
    // Rendered with `absoluteTitle`: the full brand name must stay in the title.
    title: "International Beauty Professionals Association | IBPA",
    description:
      "IBPA is a beauty professional association for specialists, educators, salon owners, and brands, with education, standards, events, and networking.",
    breadcrumb: "Home",
  },
  about: {
    path: "/about",
    title: "About the International Beauty Professionals Association",
    description:
      "Learn how the International Beauty Professionals Association supports standards, education, collaboration, and responsible beauty industry growth.",
    breadcrumb: "About",
  },
  membership: {
    path: "/membership",
    title: "Beauty Association Membership & Benefits",
    description:
      "Compare beauty association membership options for specialists, professionals, educators, salon owners, and brands, including benefits and application steps.",
    breadcrumb: "Membership",
  },
  criteria: {
    path: "/criteria",
    title: "Membership Criteria & Review Process",
    description:
      "See how the IBPA Membership Review Board evaluates applications, including experience, training, achievements, and professional reputation.",
    breadcrumb: "Criteria",
  },
  standards: {
    path: "/standards",
    title: "Beauty Industry Professional Standards & Ethics",
    description:
      "Review IBPA beauty industry professional standards, ethics, membership policies, governance documents, and public association policies.",
    breadcrumb: "Standards",
  },
  governance: {
    path: "/governance",
    title: "Governance: Board of Directors & Officers",
    description:
      "Meet the IBPA board of directors and officers, and see how the association's governance, committees, and policies are structured.",
    breadcrumb: "Governance",
  },
  members: {
    path: "/members",
    title: "Members Directory",
    description:
      "Browse active members of the International Beauty Professionals Association — beauty specialists, educators, and brands from around the world.",
    breadcrumb: "Members",
  },
  events: {
    path: "/events",
    title: "Beauty Industry Events & Professional Networking",
    description:
      "Explore IBPA beauty industry events for education, competitions, professional networking, and international collaboration among beauty professionals.",
    breadcrumb: "Events",
  },
  news: {
    path: "/news",
    title: "News & Insights for Beauty Professionals",
    description:
      "IBPA updates, industry developments, educational initiatives, and professional commentary for the international beauty community.",
    breadcrumb: "News",
  },
  partnership: {
    path: "/partnership",
    title: "Partner & Sponsor: Brand Membership vs Sponsorship",
    description:
      "Brands, media, and educators can support the IBPA professional community through sponsorship packages, separate from verified Brand Membership.",
    breadcrumb: "Partnership",
  },
  faq: {
    path: "/faq",
    title: "Membership FAQ: Application, Payment & Certificates",
    description:
      "Answers about IBPA membership categories, the application and review process, payment, certificates, the member dashboard, and professional standards.",
    breadcrumb: "FAQ",
  },
  contact: {
    path: "/contact",
    title: "Contact IBPA: Membership & Partnership Questions",
    description:
      "Reach the IBPA team about membership, applications, partnerships, or standards. Email, phone, and our Roseville, California office address.",
    breadcrumb: "Contact",
  },
  apply: {
    path: "/apply",
    title: "Apply for IBPA Membership",
    description:
      "Start your IBPA membership application. Choose a category and submit your profile for review by the Membership Review Board.",
    breadcrumb: "Apply",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "How the International Beauty Professionals Association collects, uses, stores, and protects personal information.",
    breadcrumb: "Privacy Policy",
  },
  terms: {
    path: "/terms",
    title: "Terms of Use",
    description:
      "Terms for using the IBPA website and member platform, including user responsibilities, limitations, and general conditions.",
    breadcrumb: "Terms of Use",
  },
  cancellationPolicy: {
    path: "/cancellation-policy",
    title: "Cancellation Policy",
    description:
      "IBPA's cancellation, refund, and policy handling guidance for association-related payments and participation.",
    breadcrumb: "Cancellation Policy",
  },
} as const satisfies Record<string, PageSeo>;

export type LocalizedPageSeoKey = "home" | "about" | "membership" | "standards" | "events";

const LOCALIZED_CORE_PAGE_SEO = {
  en: {
    home: PAGE_SEO.home,
    about: PAGE_SEO.about,
    membership: PAGE_SEO.membership,
    standards: PAGE_SEO.standards,
    events: PAGE_SEO.events,
  },
  ru: {
    home: {
      path: "/",
      title: "Международная ассоциация beauty-профессионалов | IBPA",
      description:
        "IBPA — международная ассоциация для beauty-специалистов, преподавателей, владельцев салонов и брендов: образование, стандарты, события и нетворкинг.",
      breadcrumb: "Главная",
    },
    about: {
      path: "/about",
      title: "О Международной ассоциации beauty-профессионалов",
      description:
        "Узнайте, как International Beauty Professionals Association развивает стандарты, образование, сотрудничество и ответственное развитие beauty-индустрии.",
      breadcrumb: "Об ассоциации",
    },
    membership: {
      path: "/membership",
      title: "Членство в beauty-ассоциации: категории и преимущества",
      description:
        "Сравните категории членства IBPA для специалистов, профессионалов, преподавателей, владельцев салонов и брендов, включая преимущества и этапы заявки.",
      breadcrumb: "Членство",
    },
    standards: {
      path: "/standards",
      title: "Профессиональные стандарты beauty-индустрии",
      description:
        "Изучите профессиональные стандарты, этический кодекс, правила членства, документы управления и публичные политики IBPA.",
      breadcrumb: "Стандарты",
    },
    events: {
      path: "/events",
      title: "События beauty-индустрии и профессиональный нетворкинг",
      description:
        "Откройте события IBPA для образования, профессионального нетворкинга, соревнований и международного сотрудничества beauty-профессионалов.",
      breadcrumb: "События",
    },
  },
  uk: {
    home: {
      path: "/",
      title: "Міжнародна асоціація beauty-професіоналів | IBPA",
      description:
        "IBPA — міжнародна асоціація для beauty-фахівців, викладачів, власників салонів і брендів: освіта, стандарти, події та професійний нетворкінг.",
      breadcrumb: "Головна",
    },
    about: {
      path: "/about",
      title: "Про Міжнародну асоціацію beauty-професіоналів",
      description:
        "Дізнайтеся, як International Beauty Professionals Association розвиває стандарти, освіту, співпрацю та відповідальне зростання beauty-індустрії.",
      breadcrumb: "Про асоціацію",
    },
    membership: {
      path: "/membership",
      title: "Членство в beauty-асоціації: категорії та переваги",
      description:
        "Порівняйте категорії членства IBPA для фахівців, професіоналів, викладачів, власників салонів і брендів, з перевагами та етапами подання заявки.",
      breadcrumb: "Членство",
    },
    standards: {
      path: "/standards",
      title: "Професійні стандарти beauty-індустрії",
      description:
        "Ознайомтеся з професійними стандартами, етичним кодексом, правилами членства, документами управління та публічними політиками IBPA.",
      breadcrumb: "Стандарти",
    },
    events: {
      path: "/events",
      title: "Події beauty-індустрії та професійний нетворкінг",
      description:
        "Відкрийте події IBPA для освіти, професійного нетворкінгу, змагань і міжнародної співпраці beauty-професіоналів.",
      breadcrumb: "Події",
    },
  },
} as const satisfies Record<Locale, Record<LocalizedPageSeoKey, PageSeo>>;

export function getLocalizedPageSeo(key: LocalizedPageSeoKey, locale: Locale): PageSeo {
  return LOCALIZED_CORE_PAGE_SEO[locale][key];
}
