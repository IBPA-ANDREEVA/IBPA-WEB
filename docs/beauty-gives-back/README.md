# Beauty Gives Back — Thanksgiving Edition 2026

Implemented locally on `feat/beauty-gives-back-2026`. Nothing was deployed or pushed.

## Live integration

Configuration: `app/web/src/features/beauty-gives-back/config.ts`.

- Offer form: https://docs.google.com/forms/d/e/1FAIpQLSdm8h0c9Y6SoQgeUR0N3JBfrjXx_y24iUEXvsoRLyUECIWy8w/viewform
- Request form: https://docs.google.com/forms/d/e/1FAIpQLSeiDV4E_JaJbTFDKe8TP86J-kGHNRW-5sNvxtLK2-cYdVun4w/viewform
- Worksheet: **Каталог**, sheet ID **95794855**.
- Published CSV: https://docs.google.com/spreadsheets/d/e/2PACX-1vQLIYUsXqdvJQRmnYCxek68aoOQE6-Z5cEAdbg5sGLKc66QbB5HXjbclJs-_sBiep4PXkOOSS0PZ-Gj/pub?gid=95794855&single=true&output=csv

On November 24, 2026, anonymous requests verified HTTP 200 for both forms and HTTP 200 / `text/csv; charset=utf-8` for the published CSV. CSV contents exactly matched the 14 expected headers, with no data records. The published HTML also identifies Каталог. The URL and sheet ID came from Anastasiia’s November 24 comment on https://trello.com/c/jgvE10uP (comment `6b05fcda69425a4d665c00f0`). The private spreadsheet itself correctly denies access to the connected account. No permissions were changed, no worksheets were published, and no response tabs or private application data were accessed.

**No remaining integration URL blocker.** The supplied static CSV is not used by application code.

## Behavior

- `/beauty-gives-back` is public and listed in the sitemap, with localized metadata and EN/RU/UK campaign text.
- The existing homepage has a compact campaign banner. Navbar uses its readable white treatment on the new route.
- Hero, four statistics, four instructions, six rules, assistance examples, catalog, campaign attribution and existing footer are present.
- `/api/beauty-gives-back` fetches only the configured published worksheet, without Google credentials. Next caches upstream CSV for 60 seconds; visible browser tabs refresh every 60 seconds and when becoming visible. Google publication propagation can add delay. Moderated rows do not require redeployment.
- CSV handles BOM, Unicode, quoted commas, escaped quotes, multiline descriptions and empty optional cells. It rejects malformed headers, extra/private columns, invalid rows, duplicate IDs and unknown types/statuses.
- Filters are URL-backed and compose across type, specialization, online/offline/hybrid format and completed status. Completed listings are hidden by default. Statistics always use the full dataset. Twelve cards are shown initially; Show more reveals another twelve.
- Only open listings expose validated contact actions. Telegram uses `https://t.me/<handle>`; Instagram uses `https://ig.me/m/<handle>`. External links use a new tab with `noopener noreferrer`.
- No listings means zero statistics and an invitation to submit. Missing configuration, loading, no results, request failures with Retry, and missing contacts have distinct localized states. A refresh error retains any last successfully loaded records. Both forms are independent of catalog requests.
- Preview is explicit: `/beauty-gives-back?preview=1`. It loads the three original Russian examples, marks statistics and cards as demonstrations, disables real contact navigation, and sets noindex. Production never substitutes samples for empty/error/missing live data.

Linking references: [Telegram public username links](https://core.telegram.org/api/links#public-username-links), [Meta Instagram messaging changelog](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/changelog/).

## Implementation files

New feature files under `app/web/src/features/beauty-gives-back/`:

- `CampaignPage.tsx`, `CampaignBanner.tsx`, `FormActions.tsx`: server composition, homepage entry and independent form links.
- `CatalogExperience.tsx`, `CatalogCard.tsx`, `campaign.module.css`: responsive catalog, interaction states and reference styling.
- `config.ts`, `catalog.ts`, `load-catalog.ts`: configuration, validation/normalization/filtering and cached upstream requests.
- `messages.ts`, `sample.ts`, `catalog.test.ts`: translations, explicit preview records and regression tests.

Routes: `app/web/src/app/(public)/beauty-gives-back/page.tsx` and `app/web/src/app/api/beauty-gives-back/route.ts`.

Modified integration files: public homepage, `Navbar.tsx`, `lib/seo/pages.ts`, `lib/seo/routes.ts`, `lib/seo/routes.test.ts`, and `DESIGN.md`.

Reused: public layout and its Navbar/Footer/locale provider, ImageWithFallback, SectionPattern, main-hero-section.webp, Cormorant/Marck Script/Inter font setup, shared Radix Select, Sonner, Lucide icons and metadata utilities. The footer and navigation intentionally retain the actual site's content and typography, which differ slightly from the reference mockups. Cards use the supported Instagram messaging destination.

## Verification

- Web tests: **205 passed**, including 10 campaign tests for CSV, schema/privacy boundaries, contact validation, filters/statistics, no-demo failure behavior, locales and timeout cancellation.
- Backend tests: **101 passed**.
- Web TypeScript: passed. Backend TypeScript build: passed.
- ESLint on all changed application files: passed.
- Full web lint: three existing errors in `AdminDashboardOverview.tsx` and `AdminGlobalSearch.tsx`, plus eight existing warnings. Backend lint: no errors, two existing warnings.
- `npm run build`: initially stopped at sitemap prerendering because configured `http://localhost:3004` was offline. Full backend + production web build subsequently passed with a temporary read-only local proxy supplying the real production site's public content feed via `BACKEND_URL`. No mock content, backend jobs, database writes or project configuration changes were used for this check. The proxy was removed from the running environment after verification.
- Full premium audit: 13 existing findings in sales/notifications areas. Feature-scoped audit reports one false positive: its parser lowercases the imported Radix `<Select>` name and reports it as native `<select>`; the feature imports the canonical authored component and contains no native select markup.
- Chrome: successful public route, real empty catalog and zero statistics; preview cards; combined type/format and specialization filters; no-results reset; sample contact toast without external navigation; keyboard Enter/Escape and focus restoration in Select; EN/RU/UK locale switching; homepage banner navigation.
- Responsive widths: 320, 390, 414, 768, 1024 and 1440 pixels, with no horizontal document overflow.
- Controlled local 503 fault injection: visible error and Retry, both Google Form destinations intact, no demo fallback; restoring the route and pressing Retry recovered the actual empty catalog. Temporary fault code was restored before commit.
- No console/hydration errors observed on the campaign before intentional fault injection. Reduced-motion styles are present; OS-level reduced-motion emulation was not available in the browser tool.
- No real spreadsheet test records were added. Open/in-progress/done and hybrid filtering were verified with local test fixtures; live verification used the actual header-only worksheet.

## Screenshots

- [Actual live empty catalog](desktop-live.jpg)
- [Desktop explicit preview](desktop-preview.jpg)
- [Mobile explicit preview, 390px](mobile-preview.jpg)
- [Catalog card](catalog-card.jpg)

The preview screenshots deliberately show demonstration records, while `desktop-live.jpg` shows the real empty catalog.
