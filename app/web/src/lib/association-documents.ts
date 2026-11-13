import type { Locale } from "./locale";

type DocumentEntry = {
  slug: string;
  title: {
    en: string;
    ru: string;
    uk: string;
  };
  description: {
    en: string;
    ru: string;
    uk: string;
  };
};

export const documents = [
  {
    slug: "bylaws.pdf",
    title: {
      en: "Bylaws",
      ru: "Устав",
      uk: "Статут",
    },
    description: {
      en: "Formal governing rules of the association, including structure, authority, voting, and foundational procedures.",
      ru: "Формальные учредительные правила ассоциации: структура, полномочия, голосование и базовые процедуры.",
      uk: "Формальні установчі правила асоціації: структура, повноваження, голосування та базові процедури.",
    },
  },
  {
    slug: "board-officers-and-committee-governance-policy.pdf",
    title: {
      en: "Board of Directors, Officers and Committees Governance Policy",
      ru: "Политика управления Советом директоров, должностными лицами и комитетами",
      uk: "Політика управління радою, офіцерами та комітетами",
    },
    description: {
      en: "Roles, authority lines, and governance responsibilities for directors, officers, and committee leadership.",
      ru: "Роли, зоны ответственности и линия полномочий для директоров, должностных лиц и руководителей комитетов.",
      uk: "Ролі, зони відповідальності та лінія повноважень для директорів, посадових осіб і керівників комітетів.",
    },
  },
  {
    slug: "governance-policy.pdf",
    title: {
      en: "Governance Policy",
      ru: "Политика управления",
      uk: "Політика управління",
    },
    description: {
      en: "Association governance principles, decision-making structure, and the baseline operating framework.",
      ru: "Принципы управления ассоциацией, структура принятия решений и общая модель внутренней работы.",
      uk: "Принципи управління асоціацією, структура ухвалення рішень і загальна модель внутрішньої роботи.",
    },
  },
  {
    slug: "committee-charters-policy.pdf",
    title: {
      en: "Committee Charters",
      ru: "Положения о комитетах",
      uk: "Політика комітетів і робочих груп",
    },
    description: {
      en: "Committee mandates, scope of work, and how special working groups operate within the association.",
      ru: "Мандаты комитетов, круг задач и порядок работы профильных рабочих групп внутри ассоциации.",
      uk: "Мандати комітетів, коло завдань і порядок роботи профільних робочих груп усередині асоціації.",
    },
  },
  {
    slug: "conflict-of-interest-policy.pdf",
    title: {
      en: "Conflict of Interest Policy",
      ru: "Политика конфликта интересов",
      uk: "Політика конфлікту інтересів",
    },
    description: {
      en: "Standards for identifying, disclosing, and managing personal or business conflicts that may affect decisions.",
      ru: "Правила выявления, раскрытия и урегулирования личных и деловых конфликтов интересов.",
      uk: "Правила виявлення, розкриття та врегулювання особистих і ділових конфліктів інтересів.",
    },
  },
  {
    slug: "code-of-ethics.pdf",
    title: {
      en: "Code of Ethics",
      ru: "Кодекс этики",
      uk: "Кодекс етики",
    },
    description: {
      en: "Guiding principles for professional conduct, respectful communication, client care, and ethical representation.",
      ru: "Принципы профессиональной этики, уважительной коммуникации, заботы о клиентах и корректного позиционирования.",
      uk: "Принципи професійної етики, шанобливої комунікації, турботи про клієнтів і коректного позиціонування.",
    },
  },
  {
    slug: "professional-standards.pdf",
    title: {
      en: "Professional Standards",
      ru: "Профессиональные стандарты",
      uk: "Професійні стандарти",
    },
    description: {
      en: "Core professional expectations, quality benchmarks, and the framework that supports ethical practice across the beauty industry.",
      ru: "Базовый документ с профессиональными ожиданиями, критериями качества и основой ответственной работы в индустрии красоты.",
      uk: "Базовий документ із професійними очікуваннями, критеріями якості та основою відповідальної роботи в індустрії краси.",
    },
  },
  {
    slug: "membership-policy.pdf",
    title: {
      en: "Membership Policy",
      ru: "Политика членства",
      uk: "Політика членства",
    },
    description: {
      en: "Membership framework, eligibility logic, expectations for participants, and baseline policy structure.",
      ru: "Политика участия, логика допуска, ожидания к участникам и базовая структура правил сообщества.",
      uk: "Політика участі, логіка допуску, очікування до учасників і базова структура правил спільноти.",
    },
  },
  {
    slug: "membership-review-procedure.pdf",
    title: {
      en: "Membership Application Review Procedure",
      ru: "Процедура рассмотрения заявок на членство",
      uk: "Процедура розгляду заявок",
    },
    description: {
      en: "Review process, evaluation flow, and the internal structure used to assess applications and supporting materials.",
      ru: "Процедура рассмотрения заявок, этапы оценки и внутренняя логика проверки анкет и приложенных материалов.",
      uk: "Процедура розгляду заявок, етапи оцінювання та внутрішня логіка перевірки анкет і доданих матеріалів.",
    },
  },
  {
    slug: "membership-agreement.pdf",
    title: {
      en: "Membership Agreement",
      ru: "Договор о членстве",
      uk: "Угода про членство",
    },
    description: {
      en: "Agreement covering participant responsibilities, association expectations, and accepted use of membership status.",
      ru: "Соглашение с обязанностями участника, ожиданиями ассоциации и правилами использования статуса.",
      uk: "Угода з обов’язками учасника, очікуваннями асоціації та правилами використання статусу.",
    },
  },
  {
    slug: "cancellation-policy-ibpa.pdf",
    title: {
      en: "Membership Cancellation and Termination Policy",
      ru: "Политика отмены и прекращения членства",
      uk: "Політика скасування",
    },
    description: {
      en: "Cancellation, refund, and policy handling guidance for association-related payments and participation.",
      ru: "Правила отмены, возврата и обработки платежей и участия, связанных с ассоциацией.",
      uk: "Правила скасування, повернення та обробки платежів і участі, пов’язаних з асоціацією.",
    },
  },
  {
    slug: "awards-and-recognition-policy.pdf",
    title: {
      en: "Awards and Recognition Policy",
      ru: "Политика наград и признания",
      uk: "Політика нагород і визнання",
    },
    description: {
      en: "Recognition criteria, honorary distinctions, and the principles used to acknowledge contribution and excellence.",
      ru: "Критерии признания, почетные статусы и принципы, по которым отмечаются вклад и профессиональное качество.",
      uk: "Критерії визнання, почесні статуси та принципи, за якими відзначаються внесок і професійна якість.",
    },
  },
  {
    slug: "record-retention-policy.pdf",
    title: {
      en: "Records Retention Policy",
      ru: "Политика хранения документов",
      uk: "Політика зберігання документів",
    },
    description: {
      en: "Document retention expectations, storage logic, and internal reference rules for organizational records.",
      ru: "Политика хранения документов, логика архивирования и внутренние правила работы с организационными данными.",
      uk: "Політика зберігання документів, логіка архівування та внутрішні правила роботи з організаційними даними.",
    },
  },
  {
    slug: "privacy-policy.pdf",
    title: {
      en: "Privacy Policy",
      ru: "Политика конфиденциальности",
      uk: "Політика конфіденційності",
    },
    description: {
      en: "Privacy notice outlining how information may be collected, stored, processed, and protected.",
      ru: "Политика конфиденциальности с описанием того, как данные могут собираться, храниться, обрабатываться и защищаться.",
      uk: "Політика конфіденційності з описом того, як дані можуть збиратися, зберігатися, оброблятися та захищатися.",
    },
  },
  {
    slug: "terms-of-use.pdf",
    title: {
      en: "Terms of Use",
      ru: "Условия использования",
      uk: "Умови використання",
    },
    description: {
      en: "Platform and website usage terms, including user responsibilities, limitations, and general conditions.",
      ru: "Условия использования сайта и платформы, включая обязанности пользователей, ограничения и общие положения.",
      uk: "Умови використання сайту та платформи, включно з обов’язками користувачів, обмеженнями та загальними положеннями.",
    },
  },
  {
    slug: "membership-review-policy.pdf",
    title: {
      en: "Membership Review Policy",
      ru: "Положение о рассмотрении заявок на членство",
      uk: "Положення про розгляд заявок на членство",
    },
    description: {
      en: "Policy governing how IBPA reviews membership applications and makes decisions.",
      ru: "Правила рассмотрения заявок на членство и принятия решений в IBPA.",
      uk: "Правила розгляду заявок на членство й ухвалення рішень в IBPA.",
    },
  },
] as const satisfies readonly DocumentEntry[];

export type DocumentSlug = (typeof documents)[number]["slug"];

export function documentLocale(locale: Locale) {
  return locale === "ru" ? "ru" : "en";
}

export function documentHref(slug: DocumentSlug, locale: Locale) {
  return `/documents/${documentLocale(locale) === "ru" ? "ru/" : ""}${slug}`;
}
