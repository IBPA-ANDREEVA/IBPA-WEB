# Sales and dashboard notifications

Implemented on `feat/sales` for the dashboard Sales/Notifications request. Existing Clerk permissions, canonical `ibpa` PostgreSQL schema, Express API, Next.js proxies, Stripe SDK/webhook, mailing audiences, event editor, image uploader/cropper, and EN/RU/UK locale provider remain the integration points.

The subsequent [UI/UX review](./SALES-NOTIFICATIONS-UI-REVIEW.md) records the refined design, loading behavior, latest checks and test-fixture state.

## Delivered behavior

- `/admin/sales`: statistics, search/status filters, pagination, create/edit/preview, publish/unpublish/archive/duplicate, image editing, optional translated content, integer USD pricing and compare-at price, availability windows, quantity and account limits, purchase ledger, and reconciliation.
- `/dashboard/sales`: catalog, shared item details and purchase confirmation, Stripe Checkout and verified return feedback, and My Purchases. Historical prices/titles remain immutable after editing or archival.
- Dashboard bell: recent notifications, unread count, read/all-read actions, detail dialog, categories and timestamps, and link to the full center. Receipt-backed incoming toasts do not replay after refresh or across devices.
- `/dashboard/notifications`: all/read/unread/category filters, pagination, shared details/actions, and `?notification=<uuid>` direct links.
- `/admin/notifications`: existing recipient/group picker, title/body/translations, information/internal/external/sale/event actions, searchable sale/event selectors, preview, idempotent sending, recipient count, and sending history. Audience pagination now includes records beyond the initial 500.
- Events optionally reference one reusable sale ID; dashboard cards/details show its price and use the same checkout provider. A linked sale is the primary purchase action; a validated external CTA remains secondary. Paid orders atomically register associated dashboard events. Full refunds revoke only sale-created access when no other paid order grants it.

## Data and deployment

Apply migrations **before** deploying code that reads the new columns:

```sh
npm --prefix app/backend run db:migrate:sales
```

- `0021_sales_and_notification_actions.sql`: `ibpa.sales`, `ibpa.sale_orders`, `ibpa.notification_receipts`; notification action/category/translations and stable sale/event FKs; event sale FK; inventory reservation function and indexes.
- `0022_sale_inventory_guards.sql`: capacity-update guard and atomic paid/refunded event-registration fulfillment.
- The SQL runner applies each migration plus journal entry in one Neon HTTP transaction. Drizzle journal entries make re-running the command safe. No existing notification, event, membership, or payment records are reset or removed. Legacy notification `metadata.readBy` remains honored.
- Roll back application code without dropping these additive tables/columns. Do not delete sale/order records to undo a release; archive products and retain payment history.

Required existing configuration: `DATABASE_URL`, Clerk keys/admin configuration, `STRIPE_SECRET_KEY`, a matching Stripe webhook signing secret, and `DASHBOARD_URL` or `FRONTEND_URL`. No secrets or environment files are committed.

Keep the existing `/api/webhooks/stripe` endpoint and subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, and `charge.refunded`, alongside existing membership events. The raw-body signature verification and webhook event ledger remain shared.

The persistent Express server runs a bounded expired-order sweep every minute; signed expiration webhooks are primary. Admin reconciliation is also available. Stripe outages keep inventory reserved, rather than risk overselling. A paid session awaiting its signed completion webhook remains PENDING; Stripe redelivery/resend recovers it. A return URL or read-only session retrieval never fulfills an order.

## APIs

Next.js authenticated proxies expose the same Sales paths as the backend:

| Method | Route | Purpose |
| --- | --- | --- |
| GET, POST | `/api/admin/sales` | List/statistics, create |
| GET, PATCH | `/api/admin/sales/:id` | Read/edit with optimistic version |
| POST | `/api/admin/sales/:id/duplicate` | New draft copy |
| GET | `/api/admin/sales/orders` | Admin purchase ledger |
| POST | `/api/admin/sales/reconcile` | Reconcile expired reservations |
| GET | `/api/dashboard/sales` | Eligible published catalog |
| GET | `/api/dashboard/sales/:id` | Item/availability/linked events |
| POST | `/api/dashboard/sales/:id/checkout` | Reserve/reuse order, create/resume Stripe Checkout |
| GET | `/api/dashboard/sales/orders` | Current account purchase history |
| GET | `/api/dashboard/sales/orders/:id` | Owned payment status |
| POST | `/api/dashboard/sales/orders/:id/cancel` | Expire Stripe session before releasing inventory |
| GET, PATCH | `/api/dashboard/notifications` | Recipient-scoped feed and durable read/toast receipts |
| GET, POST | `/api/admin/notifications` | History/send; proxies existing `/api/mailing/notifications` and `/api/mailing/notifications/send` |
| POST | `/api/webhooks/stripe` | Authenticated payment/refund/expiration processing |

Existing event admin routes accept optional `linkedSaleId`. `/api/dashboard/events` enriches linked events with sale availability. Existing free registrations require a PAID sale order when the event is linked to a sale.

Checkout requires a client UUID `requestKey`; prices, identity, currency, limits, and availability come from the server. Sale row locks serialize reservations across connections. Pending retries reuse one order and one Stripe idempotency key. Pending buyers can resume their own reserved last slot. Fulfillment verifies immutable amount/currency/user/sale/session identity and mode. Refund totals are monotonic; stale failure/expiration/completion events cannot undo a paid/full-refunded outcome. Refunds do not automatically restock quantity or reset the one-purchase-per-account rule.

## Principal changed components

- Backend: canonical Drizzle schema, Sales validation/catalog/checkout/reconciliation services and router; dashboard-notification service and routes; shared webhook dispatch; event service/repository.
- Web: `AdminSalesPage`, `SaleEditor`, `SaleSelector`, `DashboardSales`, `SalePurchaseProvider`, `SaleSummary`, `SaleCheckoutButton`, `DashboardEventDetails`, `NotificationProvider`, `DashboardNotifications`, `AdminNotificationsPage`, Sales proxy, commerce controls/types/messages.
- Existing integration surfaces: dashboard header/content/navigation/data hooks, admin navigation, event editor/cards, mailing audience repository, and notification proxies. Runtime design tokens and existing UI primitives remain canonical; `UX-CONTRACT.md` records the new flows.

## Verification (2026-11-09)

Automated tests exercise migration SQL in isolated PGlite PostgreSQL, real service calls with test-only Stripe stubs, field/link validation, ownership, recipient isolation, read/all-read/toast receipts, legacy compatibility, immutable snapshots, retry idempotency, limited inventory, one-per-account rules, payment identity/mode checks, duplicate/out-of-order events, partial/full refunds, event access and repeated purchases, exact currency formatting, translation fallback, and paginated audiences. No tests use simulated purchases as application behavior.

Live integration verification used the user-designated test database and Stripe/Clerk test credentials:

- Admin browser created a draft, published it, linked it to a targeted notification and dashboard event, edited its price, and archived it.
- Three browser Stripe sandbox payments completed: Sales, notification, and event entry points, all referencing the same sale and `sale_orders` model. Each charged 790 cents. Event checkout returned to its event context; registration was created once.
- A declined card produced a signed failure webhook; retrying the same session with a successful test card completed it. Cancel/back expired a separate session and recorded CANCELED. A full sandbox refund recorded REFUNDED and reduced revenue from $23.70 to $15.80. Editing the catalog price to $9.90 left all historical order amounts at $7.90.
- Invalid webhook signatures returned 400; replaying an actual completed Stripe event twice returned 200 with `duplicate: true` without adding orders.
- Twelve concurrent Neon requests for one available slot created exactly one order; six same-buyer retries reused it and six competing-buyer requests were rejected as SOLD_OUT.
- Separate temporary Clerk MEMBER and PARTNER sessions each verified catalog 200, admin access 403, another account's order 404, recipient isolation, server pricing despite forged frontend prices, checkout retry reuse, cancellation, blocked-account 403, and anonymous 401. Temporary Clerk identities were removed; their test order history remains durable in archived test fixtures.
- Browser checks covered incoming toast/bell update, read persistence after navigation/refresh, shared details, direct links, desktop and 390px mobile dialogs, keyboard Escape/focus, and unavailable archived sale actions.

The test Stripe webhook listener forwards to the local backend during verification. Test fixture products are archived; production publishing and live-mode charges were not performed.

### Check results and limits

Final verification completed successfully for the feature. Full-project lint has three pre-existing `react-hooks/set-state-in-effect` errors in `AdminDashboardOverview.tsx` and `AdminGlobalSearch.tsx`, plus existing warnings; feature-scoped lint is checked separately.

The premium static auditor is now scoped to all four new feature directories as well as the prior webinar scope. Its eight findings are parser false positives: seven valid Radix `asChild`/Popover-trigger controls and the imported authored `Select` interpreted as a native HTML select. Runtime keyboard/navigation checks verified these actions; the canonical owners were preserved instead of changing product code to satisfy that parser.

Live-mode payments, external image-storage uploads, assistive-technology testing, and physical mobile devices were not exercised. Existing membership/partner payment dispatch remains unchanged and the existing automated suites pass; fresh membership charges were not made.


| Check | Final result |
| --- | --- |
| `npm --prefix app/backend test` | 97 passed, 0 failed |
| `npm --prefix app/web test` | 191 passed, 0 failed |
| `npm --prefix app/backend run build` | Passed |
| `npm --prefix app/web run typecheck` | Passed |
| `npm --prefix app/backend run lint` | Passed; 2 existing unused-directive warnings in `src/lib/db.ts` |
| Web ESLint on Sales, Notifications, admin Sales/Notifications, changed mailing files and dashboard navigation hook | Passed, no findings |
| `npm --prefix app/web run lint` | 3 pre-existing errors, 8 existing warnings; files described above |
| `NEXT_PUBLIC_API_URL=http://localhost:3004 NEXT_PUBLIC_BACKEND_URL=http://localhost:3004 BACKEND_URL=http://localhost:3004 npm run build` | Passed backend compilation, Next.js production compilation/type checking and static generation using the test backend |
| `npm --prefix app/backend run db:migrate:sales` | Applied both migrations; repeat run reported both already applied |
| Premium strict static audit | 8 reviewed Radix-wrapper parser false positives, described above |
| `git diff --check` | Passed |

Browser EN/RU/UK checks passed; default English and the original viewport were restored. Screenshot evidence is available in the local verification artifacts `/tmp/ibpa-proof/stripe-test-success.jpg`, `/tmp/ibpa-proof/event-purchase-success.jpg`, and `/tmp/ibpa-proof/mobile-notifications-uk.jpg`.

## Implementation commits

| Commit | Stage |
| --- | --- |
| `01679f3` | Sales/order/notification schema and migrations |
| `064a507` | Authorized Sales catalog, reserved checkout and Stripe lifecycle |
| `cf213a0` | Recipient isolation and durable notification receipts |
| `1252f60` | Localized admin/dashboard Sales and shared purchase flow |
| `a39ce44` | Notification center and shared dashboard actions |
| `3866f5e` | Reusable event links and atomic registration fulfillment |
| `513f114` | Atomic Neon migrations and refund/access guards |
| `8687c35` | Checkout recovery, reserved-buyer resume, dialog fixes, audience pagination and background reconciliation |
| `b480bd0` | Database, payment, notification, money/localization and audience tests |

This report, UX contract and audit scope are committed separately after these implementation stages. No changes were pushed or deployed to production.
