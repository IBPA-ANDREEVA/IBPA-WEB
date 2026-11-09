# Sales and Notifications UI review

Reviewed and refined on 2026-11-09 using the frontend-design-premium and GSAP React workflows. This extends the implementation and payment verification in [SALES-AND-NOTIFICATIONS.md](./SALES-AND-NOTIFICATIONS.md). No backend, payment, migration, or authorization behavior was changed in this UI pass.

## Direction and changes

The existing IBPA dashboard and admin surfaces remain the reference: navy actions, pale blue borders, white rounded surfaces, restrained typography, and established spacing. `DESIGN.md` and `UX-CONTRACT.md` now record the commerce variants and interaction contracts.

| Reviewed drift | Implemented correction |
| --- | --- |
| Generic controls and inconsistent portal styling | Shared commerce variants of existing Button, Radix controls, dashboard action recipes and admin status badges |
| Dense, ungrouped sale form | Existing AdminSheet with grouped sections, persistent action footer, localized close, adjacent validation and focus recovery |
| Crowded row actions | Canonical AdminTable, compact Edit and a keyboard-operable action menu |
| Financial table unsuitable for member mobile views | Member purchase cards with expandable transaction details; admin retains the canonical ledger table |
| Shifting or misleading pending states | Reserved initial loading regions, unknown metrics shown as dashes, retained results during refresh, stable busy buttons, disabled duplicate submissions |
| Nested notification cards and stacked detail/purchase modals | Separated notification rows; one visible modal, with source details restored after canceling purchase |
| Weak recovery from direct-link failures | Explicit loading and retry states for notification details and linked sales |
| Inconsistent motion | Scoped 180ms GSAP view fades with cleanup and reduced-motion media handling; refreshes do not replay transitions |

New interface text supports English, Russian and Ukrainian through the existing commerce dictionary. Existing mailing recipient controls retain their established language and behavior. Authored content retains its default-language fallback.

Principal components: `CommerceUi`, commerce controls/messages, `AdminSalesPage`, `SaleEditor`, `SaleSelector`, `DashboardSales`, `PurchaseHistory`, `SalePurchaseProvider`, `DashboardEventDetails`, `NotificationProvider`, `DashboardNotifications`, and `AdminNotificationsPage`. Shared Dialog and AdminSheet gained optional disabled-close behavior; their defaults preserve existing consumers.

## Verified in the browser

- Desktop/laptop layouts and 390px mobile layouts; mobile catalog and purchase history had no horizontal page overflow.
- Admin draft creation, publishing, archive, invalid title/price focus, preserved form values, unsaved-change recovery, busy controls, and return focus after saving.
- Notification bell, Escape/focus restoration, notification details, linked-sale confirmation, cancel back to notification details, direct-link loading/error/retry.
- Event details opened the same confirmation and reached a real Stripe sandbox Checkout for $9.90. Cancel returned to the event context and recorded CANCELED. No new payment was captured in this UI pass; the earlier three-entry-point payment/refund verification is recorded in the implementation report.
- Purchase history displayed stored amounts and PAID, REFUNDED and CANCELED states.
- Russian notification layout and Ukrainian mobile catalog; English was restored afterward.
- The new disposable consultation fixture was archived after validation. The existing QA Sales Masterclass fixture remains published in the designated test database for review. No production publishing or live charges occurred.

Local screenshots: `/tmp/ibpa-proof/ui-admin-sales-desktop.png`, `/tmp/ibpa-proof/ui-sales-desktop.png` and `/tmp/ibpa-proof/ui-sales-mobile-uk.png`. The mobile screenshot was captured before the disposable consultation was archived.

## Automated checks

| Check | Result |
| --- | --- |
| Web tests | 195 passed, 0 failed, including four new control/SSR regression tests |
| Backend tests | 97 passed, 0 failed |
| Web type checking | Passed |
| Feature and changed shared-component ESLint | Passed, no findings |
| Full web ESLint | Three existing errors in AdminDashboardOverview/AdminGlobalSearch; eight existing warnings |
| Backend ESLint | No errors; two existing unused-directive warnings in db.ts |
| Production backend and web build | Passed |
| DESIGN.md lint | No errors; six existing orphaned-token warnings |
| Premium strict static audit | 13 reviewed parser false positives, detailed below |
| Git whitespace check | Passed |

Commands used: `npm --prefix app/web test`, `npm --prefix app/backend test`, `npm --prefix app/web run typecheck`, feature-scoped `npx eslint`, both packages' lint scripts, and `NEXT_PUBLIC_API_URL=http://localhost:3004 NEXT_PUBLIC_BACKEND_URL=http://localhost:3004 BACKEND_URL=http://localhost:3004 npm run build`. The build used the local test backend for API-dependent generation.

The premium auditor reports eight actionless buttons that actually use Radix delegation or `asChild` links, four textarea resize findings where the shared class constant supplies `resize-none`, and one authored Radix Select interpreted as a native select. These were inspected against the source; no canonical component was replaced to satisfy the parser. The audit exits nonzero and is not reported as a clean pass.

Reduced-motion behavior was inspected in source; browser preference emulation, physical devices, screen readers and browser zoom were not independently verified in this pass. External image upload/cropping integrations and fresh membership/partner charges were not repeated. A transient development Clerk-provider error appeared during hot updates; the final clean dashboard load rendered correctly with no captured console errors. No authentication code was changed.

## Commits

- `a962520` — shared commerce controls, loading, locale copy and GSAP integration.
- `bec5a6e` — admin/member page refinements, sale editor, notification states and shared purchase overlays.
- A separate documentation commit records this review and updates the design and interaction contracts.

Nothing was pushed or deployed.
