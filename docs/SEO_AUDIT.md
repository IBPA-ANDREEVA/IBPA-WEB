# IBPA SEO audit and implementation roadmap

**Audit date:** October 13, 2026 (America/Los_Angeles). **Production:** https://ibpassociations.org. **Implementation:** local working tree; not deployed. “Fixed” means implemented and locally verified, not live on production.

## Executive summary

The primary domain has a sound technical foundation: all 16 existing sitemap pages return 200, have unique titles/descriptions, use the intended canonical host, and expose their principal content in initial HTML. robots.txt and sitemap.xml work, unknown URLs return 404, and transactional pages are excluded from indexing. The brand appears in the search results inspected during this audit; the older report's suggestion that it is absent from search is not current evidence.

The largest code opportunity was discovery of published content. News and events previously existed only inside listing pages and linked primarily to external destinations. This implementation adds stable detail URLs, server-rendered copy, page-specific metadata/share images, visible breadcrumbs, applicable Article/WebPage structured data, sitemap entries, and internal links. An announcement duplicated across news and events now leads to one event URL. Local data produces **23 canonical sitemap URLs: 16 existing pages, six distinct stories, and one event**. Production has an additional news item, so its deployed count must be recalculated from the actual feed.

The most urgent external issue is an **expired TLS certificate on `www.ibpassociations.org`**. The apex domain works; HTTP and the Vercel mirror redirect correctly. Repair the www certificate before assessing that host's final redirect.

Content quality and freshness are the next major constraints. The forum's API schedule conflicts with its announcement, expired application deadlines still read as open, and the standards library describes its files as structural placeholders. Event rich-result markup is deliberately withheld until its facts are corrected. No dates, authors, ratings, endorsements, or search statistics were invented.

Local Lighthouse mobile SEO/accessibility improved from **92/86 to 100/100**. Performance was variable and did **not establish an LCP improvement**; the comparison below includes unfavorable runs. Traffic, rankings and field Core Web Vitals cannot be inferred from lab scores. Search Console and analytics access are still required.

## Scope, architecture, and method

The working tree was clean before editing. No credentials, database records, dependencies, production configuration, deployments, or unrelated work were modified. Generated build-file changes were removed from the final diff.

- **Web:** Next.js 16.1.6 App Router, React 19.2.3, TypeScript, Tailwind 4, Motion, Clerk, Next Image/Font, UploadThing images, GA, Meta Pixel, Vercel Analytics/Speed Insights.
- **Backend:** Express 5, Drizzle and Neon. Published content comes from `/api/content/public?type=...&target=site`. Drafts and dashboard-only content are not sources for the new pages.
- **Rendering:** public content is server rendered, including client-component initial output. Cookies make public HTML dynamic. English, Russian and Ukrainian share URLs. Ukrainian cookie `ua` maps to HTML language `uk`.
- **SEO infrastructure:** existing centralized `lib/seo` helpers, Metadata API, robots and sitemap were retained and extended.
- **Coverage:** inventoried the entire route tree, public layouts/pages/components, navigation, image/font/animation behavior, content services, backend publication filters, membership/profile discovery, API/auth boundaries, cache invalidation, deployment configuration and manifests. Authenticated dashboards were inspected for indexing/auth boundaries; no login, purchase, form submission or admin mutation was performed.
- **Methods:** production browser desktop/mobile inspection, every sitemap page's initial HTML, first-party/external link checks, host/TLS/redirect checks, official research, local production build/browser checks, regression tests, Lighthouse 13.5.0, and frontend skill static review.
- **Tool evaluation:** reviewed skills.sh SEO listings and local skills before implementation. No community SEO skill/MCP was installed: existing tools covered the work, and some listings had security warnings or external-service requirements. Used installed find-skills, frontend-design/premium and computer-use guidance. Official Lighthouse was installed in a temporary directory with lifecycle scripts disabled; no project dependency was added.

Evidence is in [seo/](seo/). Portable metrics are in [lighthouse-summary.json](seo/lighthouse-summary.json); full reports/logs remain locally in ignored `seo/raw/`. Temporary authentication redirect tokens were removed from retained full reports. The historical root `SEO_REPORT.md` is superseded by these dated observations.

### Route coverage and indexing intent

| Route/family | Purpose and result |
| --- | --- |
| `/` | Brand/entity hub; existing Organization + WebSite markup verified. |
| `/about`, `/governance` | Background, leadership and trust; indexable. |
| `/membership`, `/criteria`, `/apply` | Benefits/categories, eligibility, application journey; distinct indexable intents. Submitted personal data is not indexed. |
| `/standards` | Public document library; indexable, but placeholder language needs correction. |
| `/members` | Server-rendered public directory; client filters do not create URL combinations. |
| `/news`, `/events` | Server-rendered discovery hubs; indexable. |
| `/news/[id]`, `/events/[id]` | New published-site-only detail routes; missing/unpublished IDs return 404. Backend outage produces an error, not false removal. |
| `/partnership`, `/contact`, `/faq` | Partner/contact/information intents; indexable. No unsupported FAQ rich-result promise. |
| `/privacy`, `/terms`, `/cancellation-policy` | Existing public policies and indexing intent retained. |
| `/profile-preview/[id]` | Public preview remains intentionally noindex; profile indexing needs consent/publication decisions. |
| `/success`, `/payment-link/[token]`, `/application/edit`, `/sign-in`, `/team-invite` | Transactional/auth/token flows; noindex, absent from sitemap. |
| `/admin/**`, `/dashboard/**`, `/api/**` | Auth/authorization and noindex preserved; APIs excluded from sitemap and robots crawl allowance. |
| Public assets and 15 linked PDFs | First-party link checks passed. PDF approval/accessibility/content validity requires more than an HTTP check. |

## Findings

| Issue | Evidence | Impact | Recommendation | Status |
| --- | --- | --- | --- | --- |
| www TLS certificate expired | Live certificate verification fails; `seo/runtime-checks.json` | Critical on www; apex unaffected | Repair hosting certificate/DNS, then verify permanent HTTPS apex redirect | Requires external action |
| No individual content destinations | Original news/event cards and 16-page sitemap | High | Stable detail routes, internal links, metadata, sitemap discovery | Fixed |
| Duplicate forum announcement | Identical published news/event title and body | High | Prefer event URL; exclude duplicate from sitemap and redirect detail request | Fixed |
| Event schedule contradicts announcement | Event `fe5ba953-3412-4bec-a84e-70eb12c684d1`: API June 27 start/September 24 end; body September 25–26, 2026; live and local | High | Correct source schedule, venue timezone, status/availability before Event schema | Requires external action; generated date labels/markup withheld |
| Past events called upcoming; creation timestamp used as event date | `EventsSection.tsx`, `EventsPageClient.tsx` | High | Neutral labels, no creation-date inference; retain published copy | Fixed for generated labels; stale title/CTAs require external action |
| Inconsistent backend precedence on home | Old News/Events/Sponsors fetchers versus listing fetcher | High | Shared cached server access, 8-second timeout, explicit outage result | Fixed |
| Listing metadata would leak into detail pages | Old news/events layouts | High | Move listing metadata/breadcrumbs to listing page; generate detail-specific output | Fixed |
| Sitemap can lose content during backend outage | New dynamic sitemap depends on content feed | High | Fail generation instead of caching partial results; preserve last successful ISR generation | Fixed; build-time backend access needs release verification |
| No story-level structured/share data | Original content had no detail URLs | Medium | Article/WebPage/BreadcrumbList, title/excerpt/canonical and actual image | Fixed; editorial author/date model pending |
| Content invisible without JavaScript | Initial opacity zero on ten production routes | Medium | Scoped noscript visibility/full-text fallback; preserve animations | Fixed; full JS-disabled browser matrix not run |
| Initial language always English | Root layout fixed lang, later client effect | Medium | Resolve locale cookie on server | Fixed; en/ru/ua initial responses checked |
| Cookie languages lack separate search targeting | Shared URLs, English metadata, no hreflang | High for multilingual growth | Complete translated URL architecture before reciprocal hreflang/self canonicals | Pending |
| Semantic/keyboard issues | LH invalid definition lists, member name mismatch, tiny carousel targets; no skip link | Medium | Valid dt/dd, natural link names, 32px controls, focus-revealed text, skip link and inert collapsed menu | Fixed |
| Contrast and generic link name | Homepage LH contrast and Read More failures | Medium | Darker small labels within current palette, descriptive links | Fixed for measured homepage; not a WCAG certification |
| Light detail page header unreadable | Mobile browser showed white header on pale new detail page | Medium | Apply existing readable-header styling to descendants | Fixed and rechecked |
| Unnecessary resource priority | Below-fold event/member images eager, Raleway globally preloaded, logos assumed 100vw/default aspect | Medium | Lazy previews, retain hero priority, omit unused font preload, real logo dimensions/sizes | Fixed |
| Protected-link prefetch 401s | Production LH console and Navbar login link | Low | Disable prefetch to protected destination | Fixed |
| Public HTML incurs auth handshake | Local baseline three development Clerk redirects | Medium | GET/HEAD allowlist of session-independent public pages; preserve auth elsewhere | Fixed; protected API/page checks pass |
| Mobile LCP/TBT unresolved | Production mobile LCP 3.70s/TBT 375ms; variable local simulated LCP | High | Controlled deployed benchmarks, field data and critical-path/third-party profiling | Pending; no LCP gain claimed |
| Third-party performance/measurement issues | GA/Meta/Vercel; LH cookies/console/inspector issues | Medium | Review necessary tracking and consent-controlled loading with owner | Requires external action; integrations preserved |
| Stale or unsupported content | Awards Aug 10 deadline still open; standards “structural placeholders”; criteria 10+ experts/5 committees/40+ countries | High | Verified status/recaps, approved documents and substantiation | Requires external action |
| Empty/error event feed shows historical fallback | Hard-coded TB Champions, season dates without year | Medium | Confirm archival intent; use distinct unavailable/empty states after decision | Pending |
| Missing editorial dates/bylines | createdAt is row creation; updatedAt includes pinning; no author | Medium | Verified publishedAt/meaningful modifiedAt/byline, visible and structured | Pending; invented dates omitted |
| Limited topic coverage/unknown authority | Small announcement feed, no query/backlink exports | High growth hypothesis | Useful reviewed guidance/resources; validate demand using query data | Requires external action |
| Existing frontend lint failures | Same six errors/eight warnings before and after | Medium engineering risk | Separate admin/dashboard effect/compiler and apostrophe cleanup | Pending, unrelated |

### Verified strengths and non-issues

The original 16 pages already had unique metadata, one H1/main, image alt attributes, parseable JSON-LD and a canonical. HTTP apex and the Vercel mirror reach HTTPS apex. `/news/` redirects to `/news`; UTM variants canonicalize to the clean path. No tested first-party page/PDF was broken. Fourteen external targets returned 200 after redirects; Instagram 200 does not prove anonymous access to individual post content. Forum links redirect from Vercel to `ibpa-forum.com`; update editorial destinations during the next review.

No current paginated/faceted crawl trap or orphan among the 16 sitemap pages was found. New detail pages are linked from hubs. Existing AVIF/WebP generation, image size caps/cache TTL, organization facts and safe JSON-LD serialization were retained. No arbitrary keyword-density, minimum-word-count, LocalBusiness or FAQ schema requirement was imposed.

## Implementation behavior

Stable record IDs avoid redirects on title edits. Exact duplicate news/event records use an event URL and **307**, because a future copy edit may make them distinct; a permanently cached redirect would be inappropriate for this computed relationship. Existing external CTAs and published body copy remain intact.

Content changes use the existing `public-content` cache tag and 300-second revalidation. Clean builds now need the public backend for the sitemap. Backend failure stops generation instead of reporting a successful truncated sitemap; existing ISR can retain its last successful version. Confirm deployment backend settings before release.

Local `.env` configures SEO origin as `http://localhost:3000`; the test server used 3012. Thus local metadata uses the configured development origin while paths are validated against the test server. Production metadata currently uses the correct HTTPS origin. No environment setting was changed.

Change groups: detail routes and shared rendering/metadata; list metadata scoping and internal links; cached publication-aware content lookup; sitemap and duplicate handling; public rendering allowlist; progressive enhancement/language/accessibility; evidence-backed resource loading changes. The exact file inventory appears below.

## Verification results

### Automated checks

| Check | Result and limit |
| --- | --- |
| Web tests | **174 passed**, zero failed. |
| Backend tests | **78 passed**, zero failed. |
| Web TypeScript | Passed `npm run typecheck --prefix app/web`. |
| Production builds | Web `next build` and backend `tsc` passed. |
| Web lint | Existing **6 errors, 8 warnings**, unchanged. Errors: dashboard membership-change memo/compiler rule, ApplicationDetailsPanel apostrophes, AdminDashboardOverview effect, AdminGlobalSearch effects. No new error. |
| Backend lint | Passed with two existing warnings. |
| Frontend skill static audit | Strict run passed with zero findings; not a substitute for browser testing. |
| Initial-HTML crawl | Production baseline 16 pages; local **23 pages, zero audit errors**, plus auth/transactional/missing-route checks. Unique titles/descriptions, single H1/main, canonical paths, alt attributes, JSON syntax, fragments, sitemap uniqueness and expected noindex checked. |
| Host/links | HTTP and Vercel mirror resolve to apex; www TLS fails. 31 first-party pages/PDFs and 14 external links returned 200 after redirects. |
| Auth boundaries | Anonymous `/api/admin/content`, `/api/dashboard/me`: 401 JSON. `/admin`, `/dashboard`: 307 into Clerk. No protected data returned; authenticated success flows not exercised. |
| Locale HTML | Cookie en -> lang en; ru -> ru; ua -> uk before JavaScript. |
| Duplicate | `/news/fae7972e-23f8-4e95-b694-993b112795d8` -> 307 to preferred event and absent from sitemap. |
| Structured data | Initial HTML/browser DOM parsed; escaping and content shape covered by tests. Article: Article/WebPage/BreadcrumbList. Event: WebPage/BreadcrumbList only. No external Rich Results certification claimed. |
| Field metrics | PageSpeed API returned **429** without a key. No CrUX/INP/Search Console field result available. |
| Runtime | Local Node 25.9.0; web specifies Node 22.x. Repeat release checks on the production runtime. |

Evidence: [production baseline](seo/production-baseline.json), [local before](seo/local-before.json), [local after](seo/local-after.json), [runtime checks](seo/runtime-checks.json), [first-party links](seo/link-checks.json), [external links](seo/external-link-checks.json), [PageSpeed limitation](seo/pagespeed-check.json).

### Browser verification

Inspected production home on desktop and news on mobile; inspected local listings and new article/event pages at 390x844 and 1440x1000. No horizontal overflow in tested details (375px/1425px document widths with scrollbars). Verified story navigation, DOM title/canonical/description/JSON-LD, image load completion, viewer open/close, mobile menu open/close, collapsed links removed from accessibility tree, readable detail header, cookie choice and locale switching. Existing editorial typography, pale backgrounds, image viewer, animations and external CTAs were retained.

Initial HTML was crawled separately from hydrated DOM. Noscript CSS was checked in source/response; a globally JS-disabled browser session and full reduced-motion matrix were not run. No destructive form, payment, authenticated admin or publication action was used as a test. Development Clerk configuration emits handshake warnings on certain transactional checks; authentication flows and credentials were not changed.

### Lighthouse comparison

Lighthouse 13.5.0, headless installed Chrome, production `next start` locally, default simulated mobile throttling or desktop preset. Runs were sequential. Live and local content differ; these are not a controlled field experiment. Settings and every run, including unfavorable results, are in [lighthouse-summary.json](seo/lighthouse-summary.json).

| Home run | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | Transferred |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Production mobile baseline | 80 | 86 | 73 | 92 | 3.70s | 375ms | 0 | 1,043,736 B |
| Production desktop baseline | 97 | 86 | 73 | 92 | 1.00s | 2ms | 0 | 1,041,357 B |
| Local mobile baseline | 79 | 86 | 73 | 92 | 2.71s | 554ms | 0 | 1,124,509 B |
| Local intermediate mobile | 63 | 96 | 73 | 100 | 5.78s | 285ms | 0 | 1,039,949 B |
| Local mobile after public middleware change | 55 | 100 | 73 | 100 | 7.68s | 419ms | 0 | 1,035,152 B |
| Local mobile after lazy member portraits | 67 | 100 | 73 | 100 | 5.22s | 323ms | 0 | 990,803 B |
| Local mobile with logo sizing/date guard | 60 | 100 | 73 | 100 | 7.58s | 359ms | 0 | 988,024 B |
| Local desktop with logo sizing/date guard | 97 | 96 | 73 | 100 | 1.04s | 7ms | 0 | 1,020,001 B |

Two desktop-only eyebrow contrast failures in Benefits/Community were corrected after that desktop run, with a new production build; **the measured desktop score remains 96**, not an assumed 100. Mobile transferred bytes decreased 12.1% from the local baseline. Blocking time decreased in these runs and measured CLS remained zero. These improvements do not prove better real-user performance.

Simulated mobile LCP worsened despite fewer bytes and less blocking. The trace's LCP node is the hero paragraph. One later run's observed document-plus-render timing was about 837ms while simulated LCP was 5.22s. Auth redirect cost disappeared. The discrepancy and variance need repeatable deployed measurement; mobile performance remains a release-validation item. Best Practices includes third-party cookies/issues and local Vercel analytics endpoints absent outside Vercel. Do not remove existing tracking or animation solely to raise a score.

Transferred JavaScript stayed essentially flat (603,662 B before; 603,952 B after, including third-party scripts). Font transfer fell from 158,348 B to 114,928 B; CSS remained about 40 KB. No large hydration rewrite or speculative dependency removal was made. Final browser inspection confirmed the corrected desktop labels use `rgb(85, 112, 141)`, the header logo requests a 128px rendition at its displayed size, and keyboard activation of the skip link focuses `main-content`.

TBT is a lab diagnostic, **not INP**. Use field p75 LCP <=2.5s, INP <=200ms and CLS <=0.1, by device, when enough data exists. [Core Web Vitals guidance](https://web.dev/articles/vitals).

## Search research and realistic growth strategy

### Evidence versus hypotheses

The exact organization-name search returned IBPA's domain. This establishes visibility for the inspected result, not a rank, traffic level, index count or trend. Broader beauty-association, esthetician and lash-professional searches exposed established competitors with specialty/role benefits and educational resources. Results vary by time, location and personalization. No keyword volume, difficulty, backlink or traffic numbers are claimed.

Limited informational coverage, previously absent story destinations, stale event messaging, incomplete language targeting and unknown authority are plausible growth constraints. These are **hypotheses about performance**, not conclusions from Search Console. Establish page/query impressions, non-brand clicks, indexed canonicals and application conversions first.

### Competitor patterns

| Competitor / primary source | Observed pattern | IBPA opportunity |
| --- | --- | --- |
| [Professional Beauty Association membership](https://www.probeauty.org/become-a-member/) | Role/community membership presentation and benefits | Explain category fit for specialists, educators, salons and brands with approved concrete deliverables. |
| [American Lash Association](https://americanlashassociation.org/) and [mission](https://americanlashassociation.org/ala-mission/) | Lash specialization and professional resources | Qualified lash/brow standards resources; do not invent insurance or accreditation benefits. |
| [Associated Skin Care Professionals](https://www.ascpskincare.com/faq) | Esthetician-focused practical membership questions | Clear eligibility, documents, renewal, category and recognition answers. |
| [CIDESCO membership](https://cidesco.com/applications-for-cidesco-membership/) | International professional/education positioning | Distinguish actual IBPA membership/recognition from regulated qualifications and document the review process. |
| [Esthetics Association Florida membership](https://estheticsassociation.com/membership-levels/) | Regional and membership-level relevance | Geographic event content only where real events/communities exist; avoid city doorway pages. |

These are competitors for overlapping search intent, not evidence of comparable size, quality or market share.

### Keyword clusters and destination mapping

| Cluster / illustrative queries | Intent and destination | Content/internal linking opportunity |
| --- | --- | --- |
| IBPA; International Beauty Professionals Association; IBPA membership | Navigational -> `/`, `/about`, `/membership` | Consistent full name/abbreviation, entity/contact details, verified partner links. |
| professional beauty association; beauty industry association membership | Comparison -> `/membership` | Approved benefits, categories, renewal/cancellation; link criteria, standards and application. |
| beauty association for educators / salon owners / beauty professionals | Role comparison -> membership sections first | Separate pages only when each has substantial distinct benefits and evidence. |
| beauty professional membership requirements; documents for association membership | Eligibility -> `/criteria`, `/faq`, `/apply` | Reviewed checklist and actual process; no invented approval guarantees/timelines. |
| beauty industry professional standards; beauty professional code of ethics | Information -> `/standards` | Approved HTML explanations, owner/version/effective date, accessible PDFs. |
| Beauty Business Forum Los Angeles; beauty networking events Los Angeles; IBPA Beauty Awards | Event/brand -> detail pages | Accurate year/schedule/venue/status, approved registration destination, recaps and actual results. |
| beauty business education; salon business networking; professional recognition | Education -> reviewed articles/guides | Real expertise, practical examples and sources; link relevant membership content when useful. |
| RU/UK equivalents of approved membership/criteria/event topics | Multilingual -> future language URLs | Native review and localized metadata first; validate phrasing/demand with query data. |

### Proposed editorial work — not published by this audit

1. **Membership guide:** proposed heading “Which IBPA membership category fits your work?” Intro: “Review the membership categories, eligibility requirements and application documents before choosing the option that matches your professional role.” Follow with approved benefits/costs/renewal details.
2. **Eligibility checklist:** “Preparing your IBPA membership application.” Explain current evidence requirements, link criteria and relevant form, and include turnaround time only if operations can substantiate it.
3. **Standards library:** proposed intro “Explore IBPA's published standards, governance documents and membership policies.” Use only after owners approve public documents. Add effective date/version/review owner, readable HTML summaries and a clear distinction from internal procedures.
4. **Event/award updates:** replace open-registration messaging with accurate archived status or recaps after organizer confirmation. Verify September forum dates; publish actual agenda/outcomes/photos and any approved next-event link. Do not invent attendance, winners or testimonials.
5. **Expert resources:** commission reviewed guides on documented professional standards, portfolio preparation, ethical recognition, educator development and beauty-business networking. Use real bylines/dates and contextual links to one relevant hub.

## Prioritized implementation plan

### P0 — critical access and release correctness

- **Hosting owner, immediate:** repair www TLS and verify HTTPS www -> HTTPS apex for paths and queries. The apex is currently healthy.
- **Completed:** published-site boundaries, missing-detail 404s, noindex exclusions, auth regression checks and outage-aware sitemap/detail handling.
- **Release owner, before deployment:** verify production canonical origin, reachable public backend and Node 22.x; review changes and run build/tests in CI. New detail URLs cannot be externally validated until an authorized deployment. This audit did not deploy.

### P1 — high impact technical and editorial work

- **Completed locally:** canonical detail routes, internal discovery, metadata/share images, Article/WebPage/breadcrumb markup, duplicate handling, sitemap integration, consistent fetches, truthful generated event labels, initial language, accessibility/resource corrections.
- **Content/event owner, before promotion:** reconcile event schedule and expired messaging, approve public documents and substantiate claims. Add editorial dates/bylines. Implement Event schema only after complete, consistent eligible-event data is available.
- **SEO/release owner, after deployment:** production crawl; inspect representative Google-selected canonicals; validate live Article/BreadcrumbList output; submit sitemap and monitor indexing after subsequent crawls.
- **Performance owner:** investigate mobile LCP using at least three comparable deployed runs and field telemetry. Profile third-party CPU, CSS/font critical path and hydration. Fewer eager resources do not establish an LCP fix.

### P2 — further optimization

- Confirm the historical event fallback's intent, then distinguish unavailable, loading and empty states instead of substituting an unrelated event.
- Scope complete language URLs/translations before cache architecture changes. Add reciprocal `en`, `ru`, `uk` hreflang, optional x-default and localized self canonicals only when real equivalents exist.
- Add crawlable numbered pagination when feed size warrants it; each page self-canonical. Seven/eight stories do not justify introducing pagination now. Avoid indexable empty filter combinations.
- Add real publishedAt/meaningful modifiedAt/byline and venue timezone/status fields. Database pinning/order changes should not manufacture freshness.
- Review PDF metadata, tags, selectable text and HTML equivalents after content approval. Do not indiscriminately noindex/canonicalize all PDFs.
- Audit remaining forms/secondary pages for contrast, keyboard operation and reduced motion. Homepage Lighthouse is not whole-site accessibility certification.
- Fix baseline lint errors separately. Split large public form bundles only after route-level profiling demonstrates benefit.

### P3 — long-term organic growth

- **First 30 days:** repair hosting/content issues, establish measurement, deploy verified changes, index approved new URLs and record query/page baselines.
- **Days 30–60:** publish membership-selection/eligibility guidance, two qualified standards/education resources and an accurate forum recap; link from relevant hubs.
- **Days 60–90:** compare query/device impressions and clicks, improve pages with demonstrated demand, commission useful follow-up topics and decide language/profile priorities from evidence.
- Seek legitimate links from actual partners, speakers, member organizations and contributors to relevant useful pages. Keep identity/contact details consistent. Avoid purchased links, invented reviews, scaled doorway pages and unsupported accreditation claims.
- Profile indexing requires a consent/product decision: opted-in public fields, useful biographies, directory links and accurate Person/ProfilePage markup. Preserve privacy controls.

## Manual action checklist

- [ ] Repair www certificate/DNS and verify redirect after TLS succeeds.
- [ ] Review/deploy through the existing release process; verify canonical origin, public backend, Node version and preview indexing controls.
- [ ] Correct event dates/timezone/status/CTA and expired award announcements before promotion. Enable Event markup only after facts align.
- [ ] Approve/version standards PDFs, remove placeholder/internal-team wording and substantiate numerical/institutional claims.
- [ ] Verify a Search Console Domain property with the owner's DNS account; submit `https://ibpassociations.org/sitemap.xml` after deployment.
- [ ] Inspect home, membership, one story, one event and a noindex transactional URL; compare declared/Google-selected canonical and rendered content. Review Page indexing, Sitemaps, Crawl stats, manual actions and security issues.
- [ ] Export available query/page/device/country performance, separating brand/non-brand. Track impressions, clicks, CTR and application conversions without assuming traffic/rank targets.
- [ ] Review CrUX/Search Console Core Web Vitals across sufficient field-data windows. Obtain PageSpeed API access for repeatable automation; TBT is not INP.
- [ ] Validate live Article/BreadcrumbList and Organization in Google Rich Results Test / Schema validator. Valid markup does not guarantee display.
- [ ] Confirm analytics access, conversion events and cookie-choice behavior with its owner. The current banner does not gate GA/Meta script loading; this audit preserved tracking integrations and makes no legal compliance determination.
- [ ] Decide language URL coverage and member publication consent; assign qualified editorial/translation owners.
- [ ] Update forum/partner destinations to verified final domains during editorial review and periodically check external links.

### Repeatable checks

```powershell
npm run test --prefix app/web
npm run typecheck --prefix app/web
npm run build --prefix app/web
npm run lint --prefix app/web
npm run test --prefix app/backend
npm run build --prefix app/backend
npm run lint --prefix app/backend
# Existing backend + production web server on port 3012:
python scripts/audit-seo.py http://localhost:3012 docs/seo/local-after.json --check
# After an authorized deployment:
python scripts/audit-seo.py https://ibpassociations.org docs/seo/production-after.json --check
```

The crawler uses Python's standard library, follows redirects/cookies without authentication and never submits forms. It checks canonical paths while allowing the configured origin to differ from the local test port; also verify the production host. It is not a full link checker, security scan, index report or rich-result certification. Lighthouse was run from a temporary official installation with `--only-categories=performance,accessibility,best-practices,seo`, JSON output, and `--preset=desktop` for desktop runs; full settings are in the summary evidence.

## Official research and rationale

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide): useful content, clear structure and crawlable links; metadata alone cannot establish authority.
- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): initial HTML, accessible links and accurate status codes motivated server detail pages and distinct missing/outage behavior.
- [Canonical consolidation](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls): align links, sitemap and canonical preferences; these do not compel Google's selection.
- [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): canonical published URLs and truthful modification dates; inclusion is not an indexing guarantee.
- [Article markup](https://developers.google.com/search/docs/appearance/structured-data/article), [Event markup](https://developers.google.com/search/docs/appearance/structured-data/event), [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): describe real visible content; omit unsupported facts and conflicting dates.
- [Multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites): crawlable language URLs before meaningful alternate-language targeting.
- [Next.js metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images), [JSON-LD](https://nextjs.org/docs/app/guides/json-ld), [sitemap convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap), [proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy): framework APIs, not client-only head mutations or a rendering rewrite.
- [Clerk middleware](https://clerk.com/docs/reference/nextjs/clerk-middleware): protected-link prefetch behavior and distinction between public rendering and authorization.
- [Official Lighthouse](https://github.com/GoogleChrome/lighthouse), [Core Web Vitals](https://web.dev/articles/vitals): official tooling and field/lab distinction; no project credentials sent to an SEO service.

## File responsibilities

| Implementation area | Files (exact paths listed below) and effect |
| --- | --- |
| Detail rendering | Both `[id]/page.tsx` files resolve published records and metadata; `PublicContentDetail.tsx` renders full content, breadcrumbs and existing CTA/image interactions. |
| SEO/data helpers | `seo/content.ts` builds canonical paths, safe metadata and truthful schemas; `public-content.ts` recognizes exact duplicates; `public-content-server.ts` centralizes caching, timeout and published-only lookup. |
| Listing scopes | News/events page files own list metadata, their layouts are passthrough, and client lists gain descriptive detail links while keeping existing interactions. |
| Discovery/auth | `sitemap.ts` adds canonical published URLs; `seo/routes.ts` defines the public allowlist; `proxy.ts` skips Clerk only for those session-independent GET/HEAD requests. |
| Progressive enhancement | Root/public layouts set initial language, tune font preload and add a skip link/noscript fallback. `i18n.tsx` improves the About link label. |
| Homepage feeds | News, Events and Sponsors sections share the server fetcher; news/event headings link to details; event labels no longer imply future timing. |
| Accessibility | EventCard corrects dt/dd semantics; AudienceSection improves keyboard/target behavior; MemberCard restores natural accessible naming; Benefits/Community/Governance/News/member-preview labels use readable colors; Hero marks decorative art correctly. |
| Images/navigation | MembersPreviewSection removes eager portraits; Navbar/Footer use actual logo sizing; Navbar handles detail contrast, inert collapsed menu and protected-link prefetch. |
| Regression coverage | Content, routes and public-content-server tests protect publication, metadata/schema, redirects, sitemap and auth boundaries; `audit-seo.py` checks actual initial HTML. |

## Exact implementation file inventory

The following code files implement the change groups described above. `docs/seo/` contains dated evidence, and `scripts/audit-seo.py` provides the reusable crawl check. No backend source or package/lockfile was changed.

- `app/web/src/app/(public)/events/EventsPageClient.tsx`
- `app/web/src/app/(public)/events/[id]/page.tsx`
- `app/web/src/app/(public)/events/layout.tsx`
- `app/web/src/app/(public)/events/page.tsx`
- `app/web/src/app/(public)/layout.tsx`
- `app/web/src/app/(public)/news/NewsPageClient.tsx`
- `app/web/src/app/(public)/news/[id]/page.tsx`
- `app/web/src/app/(public)/news/layout.tsx`
- `app/web/src/app/(public)/news/page.tsx`
- `app/web/src/app/layout.tsx`
- `app/web/src/app/sitemap.ts`
- `app/web/src/components/content/EventCard.tsx`
- `app/web/src/components/content/PublicContentDetail.tsx`
- `app/web/src/components/landing/AudienceSection.tsx`
- `app/web/src/components/landing/BenefitsSection.tsx`
- `app/web/src/components/landing/CommunitySection.tsx`
- `app/web/src/components/landing/EventsSection.tsx`
- `app/web/src/components/landing/GovernancePreviewSection.tsx`
- `app/web/src/components/landing/Hero.tsx`
- `app/web/src/components/landing/NewsSection.tsx`
- `app/web/src/components/landing/SponsorsSection.tsx`
- `app/web/src/components/layout/Footer.tsx`
- `app/web/src/components/layout/Navbar.tsx`
- `app/web/src/features/members/components/MemberCard.tsx`
- `app/web/src/features/members/components/MembersPreviewSection.tsx`
- `app/web/src/lib/i18n.tsx`
- `app/web/src/lib/public-content-server.test.ts`
- `app/web/src/lib/public-content-server.ts`
- `app/web/src/lib/public-content.ts`
- `app/web/src/lib/seo/content.test.ts`
- `app/web/src/lib/seo/content.ts`
- `app/web/src/lib/seo/routes.test.ts`
- `app/web/src/lib/seo/routes.ts`
- `app/web/src/proxy.ts`
- `scripts/audit-seo.py`
