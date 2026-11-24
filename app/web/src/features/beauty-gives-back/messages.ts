import type { Locale } from "@/lib/locale";

export type CampaignCopy = {
  eyebrow: string;
  dates: string;
  description: string;
  offer: string;
  request: string;
  imageAlt: string;
  stats: string[];
  participation: string;
  how: string;
  trust: string;
  rulesTitle: string;
  steps: { title: string; text: string }[];
  rules: string[];
  ideasTitle: string;
  ideas: string[];
  catalog: string;
  catalogDescription: string;
  shown: string;
  typeLabel: string;
  all: string;
  offers: string;
  requests: string;
  specialization: string;
  allSpecializations: string;
  format: string;
  allFormats: string;
  online: string;
  offline: string;
  showDone: string;
  type: { offer: string; request: string };
  status: { open: string; in_progress: string; done: string };
  spots: string;
  author: string;
  telegram: string;
  instagram: string;
  noContact: string;
  loading: string;
  updating: string;
  empty: string;
  noResults: string;
  reset: string;
  error: string;
  retry: string;
  unconfigured: string;
  preview: string;
  sampleAction: string;
  formUnavailable: string;
  loadMore: string;
  attribution: string;
  join: string;
};
export const CAMPAIGN_MESSAGES: Record<Locale, CampaignCopy> = {
  ru: {
    eyebrow: "Инициатива сообщества IBPA",
    dates: "24 ноября – 6 декабря",
    description:
      "Неделя благодарности и профессиональной взаимопомощи в индустрии красоты. Мастера, преподаватели, салоны и бренды бесплатно делятся опытом и ресурсами с теми, кому сейчас нужна поддержка. Участвовать могут и члены IBPA, и все желающие.",
    offer: "Хочу помочь",
    request: "Ищу помощь",
    imageAlt: "Сообщество профессионалов IBPA",
    stats: ["объявления", "предлагают помощь", "ищут помощь", "уже помогли"],
    participation: "Участие",
    how: "Как это работает",
    trust: "Взаимное доверие",
    rulesTitle: "Правила участия",
    steps: [
      {
        title: "Заполните заявку",
        text: "Нажмите «Хочу помочь» или «Ищу помощь», опишите предложение или запрос и укажите Telegram или Instagram для связи.",
      },
      {
        title: "Модерация",
        text: "Координатор проверяет заявку и публикует её в каталоге вместе с вашим Telegram или Instagram.",
      },
      {
        title: "Напишите автору",
        text: "Найдите подходящее объявление и нажмите «Написать в Telegram» или «Написать в Instagram».",
      },
      {
        title: "Договоритесь напрямую",
        text: "Обсудите детали лично. Когда договорились, сообщите координатору, и объявление получит статус «В работе».",
      },
    ],
    rules: [
      "Вся помощь бесплатная. Сборы денег и продажа услуг не допускаются.",
      "Пишите от сердца, без рекламы. Объявления с саморекламой не публикуются.",
      "Для связи в объявлении публикуется только Telegram или Instagram, который вы указали в заявке. Телефоны, адреса и другие ссылки не публикуются.",
      "Не переводите деньги и не пересылайте личные документы людям из каталога.",
      "Регулируемые услуги оказываются только в пределах квалификации и разрешений специалиста.",
      "IBPA помогает участникам познакомиться. Дальнейшие договорённости участники выполняют сами.",
    ],
    ideasTitle: "Чем можно помочь",
    ideas: [
      "Разбор портфолио",
      "Час наставничества",
      "Мастер-класс",
      "Консультация по развитию салона",
      "Помощь с поиском работы",
      "Общая информация о лицензировании",
      "Стартовый набор материалов",
      "Место на обучении",
    ],
    catalog: "Каталог",
    catalogDescription: "Предложения и запросы о профессиональной помощи",
    shown: "Показано",
    typeLabel: "Тип объявления",
    all: "Все",
    offers: "Предлагают",
    requests: "Ищут",
    specialization: "Специализация",
    allSpecializations: "Все специализации",
    format: "Формат",
    allFormats: "Любой формат",
    online: "Онлайн",
    offline: "Офлайн",
    showDone: "Показывать завершённые",
    type: { offer: "Предлагает помощь", request: "Ищет помощь" },
    status: { open: "Открыто", in_progress: "В работе", done: "Завершено" },
    spots: "Мест",
    author: "Автор",
    telegram: "Написать в Telegram",
    instagram: "Написать в Instagram",
    noContact: "Контакт для связи не указан.",
    loading: "Загружаем объявления…",
    updating: "Обновляем объявления…",
    empty:
      "Объявлений пока нет. Станьте первыми: нажмите «Хочу помочь» или «Ищу помощь».",
    noResults: "По этим фильтрам объявлений нет. Попробуйте изменить фильтры.",
    reset: "Сбросить фильтры",
    error:
      "Не удалось обновить каталог. Попробуйте ещё раз. Формы заявок по-прежнему доступны.",
    retry: "Повторить",
    unconfigured:
      "Каталог готовится к открытию. Вы уже можете предложить помощь или оставить запрос через формы выше.",
    preview:
      "Это предпросмотр с примерами карточек и статистики. Объявления демонстрационные, связаться с их авторами нельзя.",
    sampleAction:
      "Это пример. В настоящем объявлении кнопка откроет чат с автором.",
    formUnavailable: "Форма заявки скоро будет подключена.",
    loadMore: "Показать ещё",
    attribution:
      "Beauty Gives Back — проект International Beauty Professionals Association, Inc. (IBPA).",
    join: "Присоединиться к инициативе",
  },
  en: {
    eyebrow: "An IBPA community initiative",
    dates: "November 24 – December 6",
    description:
      "A week of gratitude and professional mutual support in the beauty industry. Professionals, educators, salons and brands share their experience and resources free of charge with those who need support. Everyone is welcome, including IBPA members and non-members.",
    offer: "Offer help",
    request: "Find help",
    imageAlt: "IBPA community of beauty professionals",
    stats: ["listings", "offering help", "seeking help", "completed"],
    participation: "Participate",
    how: "How it works",
    trust: "Mutual trust",
    rulesTitle: "Participation guidelines",
    steps: [
      {
        title: "Submit an application",
        text: "Select “Offer help” or “Find help”, describe your offer or request, and include your Telegram or Instagram contact.",
      },
      {
        title: "Moderation",
        text: "A coordinator reviews your application and publishes it in the catalog with your Telegram or Instagram contact.",
      },
      {
        title: "Contact the author",
        text: "Find a suitable listing and select “Message on Telegram” or “Message on Instagram”.",
      },
      {
        title: "Arrange the details directly",
        text: "Discuss the details privately. Once you agree, tell the coordinator so the listing can be marked “In progress”.",
      },
    ],
    rules: [
      "All help is free. Fundraising and selling services are not permitted.",
      "Write from the heart, without advertising. Self-promotional listings are not published.",
      "Only the Telegram or Instagram contact you provided is published. Phone numbers, addresses and other links are not published.",
      "Do not send money or personal documents to people in the catalog.",
      "Regulated services must stay within the professional’s qualifications and authorizations.",
      "IBPA helps participants connect. Participants are responsible for their subsequent arrangements.",
    ],
    ideasTitle: "Ways to help",
    ideas: [
      "Portfolio review",
      "An hour of mentoring",
      "Masterclass",
      "Salon development consultation",
      "Help finding work",
      "General licensing information",
      "Starter supplies",
      "A place on a training course",
    ],
    catalog: "Community catalog",
    catalogDescription: "Offers and requests for professional support",
    shown: "Showing",
    typeLabel: "Listing type",
    all: "All",
    offers: "Offers",
    requests: "Requests",
    specialization: "Specialization",
    allSpecializations: "All specializations",
    format: "Format",
    allFormats: "Any format",
    online: "Online",
    offline: "Offline",
    showDone: "Show completed",
    type: { offer: "Offering help", request: "Seeking help" },
    status: { open: "Open", in_progress: "In progress", done: "Completed" },
    spots: "Places",
    author: "Author",
    telegram: "Message on Telegram",
    instagram: "Message on Instagram",
    noContact: "No contact information provided.",
    loading: "Loading listings…",
    updating: "Updating listings…",
    empty: "No listings yet. Be the first: select “Offer help” or “Find help”.",
    noResults: "No listings match these filters. Try changing your filters.",
    reset: "Clear filters",
    error:
      "We couldn’t update the catalog. Please try again. The application forms are still available.",
    retry: "Try again",
    unconfigured:
      "The catalog is getting ready to open. You can already offer help or submit a request using the forms above.",
    preview:
      "This is a preview with sample listings and statistics. These are demonstrations; their authors cannot be contacted.",
    sampleAction:
      "This is a sample. A real listing will open a conversation with its author.",
    formUnavailable: "The application form will be available soon.",
    loadMore: "Show more",
    attribution:
      "Beauty Gives Back is a project of International Beauty Professionals Association, Inc. (IBPA).",
    join: "Join the initiative",
  },
  uk: {
    eyebrow: "Ініціатива спільноти IBPA",
    dates: "24 листопада – 6 грудня",
    description:
      "Тиждень вдячності та професійної взаємодопомоги в індустрії краси. Майстри, викладачі, салони й бренди безкоштовно діляться досвідом і ресурсами з тими, кому зараз потрібна підтримка. Долучитися можуть як члени IBPA, так і всі охочі.",
    offer: "Хочу допомогти",
    request: "Шукаю допомогу",
    imageAlt: "Спільнота професіоналів IBPA",
    stats: [
      "оголошення",
      "пропонують допомогу",
      "шукають допомогу",
      "уже допомогли",
    ],
    participation: "Участь",
    how: "Як це працює",
    trust: "Взаємна довіра",
    rulesTitle: "Правила участі",
    steps: [
      {
        title: "Заповніть заявку",
        text: "Натисніть «Хочу допомогти» або «Шукаю допомогу», опишіть пропозицію чи запит і вкажіть Telegram або Instagram для зв’язку.",
      },
      {
        title: "Модерація",
        text: "Координатор перевіряє заявку та публікує її в каталозі разом із вашим Telegram або Instagram.",
      },
      {
        title: "Напишіть автору",
        text: "Знайдіть відповідне оголошення та натисніть «Написати в Telegram» або «Написати в Instagram».",
      },
      {
        title: "Домовтеся напряму",
        text: "Обговоріть деталі особисто. Коли домовилися, повідомте координатора, і оголошення отримає статус «У роботі».",
      },
    ],
    rules: [
      "Уся допомога безкоштовна. Збір коштів і продаж послуг не допускаються.",
      "Пишіть від серця, без реклами. Оголошення із саморекламою не публікуються.",
      "Для зв’язку в оголошенні публікується лише Telegram або Instagram, який ви вказали в заявці. Телефони, адреси та інші посилання не публікуються.",
      "Не переказуйте гроші та не надсилайте особисті документи людям із каталогу.",
      "Регульовані послуги надаються лише в межах кваліфікації та дозволів фахівця.",
      "IBPA допомагає учасникам познайомитися. Подальші домовленості учасники виконують самостійно.",
    ],
    ideasTitle: "Чим можна допомогти",
    ideas: [
      "Розбір портфоліо",
      "Година наставництва",
      "Майстер-клас",
      "Консультація з розвитку салону",
      "Допомога з пошуком роботи",
      "Загальна інформація про ліцензування",
      "Стартовий набір матеріалів",
      "Місце на навчанні",
    ],
    catalog: "Каталог",
    catalogDescription: "Пропозиції та запити щодо професійної допомоги",
    shown: "Показано",
    typeLabel: "Тип оголошення",
    all: "Усі",
    offers: "Пропонують",
    requests: "Шукають",
    specialization: "Спеціалізація",
    allSpecializations: "Усі спеціалізації",
    format: "Формат",
    allFormats: "Будь-який формат",
    online: "Онлайн",
    offline: "Офлайн",
    showDone: "Показувати завершені",
    type: { offer: "Пропонує допомогу", request: "Шукає допомогу" },
    status: { open: "Відкрито", in_progress: "У роботі", done: "Завершено" },
    spots: "Місць",
    author: "Автор",
    telegram: "Написати в Telegram",
    instagram: "Написати в Instagram",
    noContact: "Контакт для зв’язку не вказано.",
    loading: "Завантажуємо оголошення…",
    updating: "Оновлюємо оголошення…",
    empty:
      "Оголошень поки немає. Станьте першими: натисніть «Хочу допомогти» або «Шукаю допомогу».",
    noResults: "За цими фільтрами оголошень немає. Спробуйте змінити фільтри.",
    reset: "Скинути фільтри",
    error:
      "Не вдалося оновити каталог. Спробуйте ще раз. Форми заявок залишаються доступними.",
    retry: "Повторити",
    unconfigured:
      "Каталог готується до відкриття. Ви вже можете запропонувати допомогу або залишити запит через форми вище.",
    preview:
      "Це попередній перегляд із прикладами карток і статистики. Оголошення демонстраційні, зв’язатися з їхніми авторами неможливо.",
    sampleAction:
      "Це приклад. У справжньому оголошенні кнопка відкриє чат з автором.",
    formUnavailable: "Форма заявки незабаром буде доступна.",
    loadMore: "Показати ще",
    attribution:
      "Beauty Gives Back — проєкт International Beauty Professionals Association, Inc. (IBPA).",
    join: "Долучитися до ініціативи",
  },
};
