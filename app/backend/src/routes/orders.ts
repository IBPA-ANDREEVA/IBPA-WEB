import crypto from "crypto";
import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb } from "../lib/db";
import {
  coreApplications,
  coreCertificates,
  coreFiles,
  coreMemberships,
  corePayments,
  coreUsers,
} from "../lib/schema";
import { stripe } from "../services/stripe";
import {
  APPLICATIONS_REPLY_TO,
  APPLICATIONS_SENDER,
  PAYMENTS_REPLY_TO,
  PAYMENTS_SENDER,
  adminNotificationEmail,
  applicationsEmail,
  sendEmail,
  sendEmailOrThrow,
} from "../services/email";
import { adminClerkMiddleware, requireAdminAccess } from "../services/admin";
import { createRateLimiter, getClientAddress } from "../lib/rate-limit";
import { ensureCanonicalUser } from "../features/users/server/user.service";
import { upsertCanonicalApplication, findCanonicalApplicationById, upsertCanonicalApplicationFile, deleteCanonicalApplicationFilesExcept, deleteCanonicalApplicationAggregate, listCanonicalApplicationFileRecords } from "../features/applications/server/application.repository";
import {
  validateApplicationRequirements,
  validateOrganizationApplication,
} from "../features/applications/server/application-requirements";
import { upsertCanonicalPayment } from "../features/payments/server/payment.repository";
import { upsertCanonicalMembership } from "../features/memberships/server/membership.repository";
import { upsertCanonicalCertificate } from "../features/certificates/server/certificate.repository";
import { syncProfileFromApplication } from "../features/profiles/server/application-profile-sync";
import { upsertCanonicalTeam } from "../features/teams/server/team.repository";
import {
  INCLUDED_TEAM_SEATS,
  isBusinessOwnerMembershipType,
} from "../features/teams/server/team-access";
import {
  calculateMembershipBalance,
  getMembershipChangeDetails,
  isMembershipChangeApplicationData,
} from "../features/memberships/server/membership-change";
import { activateMembershipChange } from "../features/memberships/server/membership-change-activation";
import {
  isUuid,
  listAdminTeamMembersByOwnerOrder,
  listAllMailableTeamMemberEmails,
} from "../features/teams/server/admin-team.service";
import {
  describePromoCodeDiscount,
  findRedeemablePromoCode,
  listPromoCodes,
  normalizePromoCodeInput,
  resolveStripeCouponId,
} from "../features/site-settings/server/promo-code.service";
import {
  AdminCertificateError,
  createAdminCertificate,
  listAdminCertificates,
  removeAdminCertificate,
  replaceAdminCertificate,
} from "../features/admin-certificates/server/admin-certificate.service";

export const ordersRouter = Router();

const MEMBERSHIP_PRICE_KEYS = {
  Specialist: "STRIPE_PRICE_SPECIALIST",
  Professional: "STRIPE_PRICE_PROFESSIONAL",
  Trainer: "STRIPE_PRICE_TRAINER",
  Business: "STRIPE_PRICE_BUSINESS",
  Brand: "STRIPE_PRICE_BRAND",
} as const;

const LEGACY_MEMBERSHIP_PACKAGES: Record<string, keyof typeof MEMBERSHIP_PRICE_KEYS> = {
  Student: "Specialist",
};

const MEMBERSHIP_APPLICANT_TYPES: Record<keyof typeof MEMBERSHIP_PRICE_KEYS, string> = {
  Specialist: "Individual",
  Professional: "Individual",
  Trainer: "School",
  Business: "Business",
  Brand: "Brand",
};

const SPONSORSHIP_PRICE_KEYS = {
  Associate: "STRIPE_PRICE_SPONSOR_ASSOCIATE",
  Community: "STRIPE_PRICE_SPONSOR_COMMUNITY",
  Premier: "STRIPE_PRICE_SPONSOR_PREMIER",
} as const;

const ALLOWED_MEMBERSHIP_PACKAGES = new Set(Object.keys(MEMBERSHIP_PRICE_KEYS));
const ALLOWED_ADDITIONAL_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"]);
const applicationLimiter = createRateLimiter(4, 30 * 60 * 1000);
const applicationAgentLimiter = createRateLimiter(8, 30 * 60 * 1000);
const paymentLinkLimiter = createRateLimiter(4, 60 * 60 * 1000);
const paymentLinkAgentLimiter = createRateLimiter(8, 60 * 60 * 1000);

const ADMIN_ORDER_LIST_DEFAULT_LIMIT = 20;
const ADMIN_ORDER_LIST_MAX_LIMIT = 50;
const ADMIN_ORDER_STATUSES = new Set(["pending", "review", "rejected", "approved", "paid"]);

type AdditionalFileInput = {
  fileName: string;
  fileUrl: string;
  fileKey: string | null;
  fileType: string;
};

function normalizeMembershipPackage(category?: unknown) {
  if (typeof category !== "string") {
    return null;
  }

  return (LEGACY_MEMBERSHIP_PACKAGES[category] || category) as keyof typeof MEMBERSHIP_PRICE_KEYS;
}

function normalizeOrderAccountType(value: unknown, fallback: "member" | "partner" = "member") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "partner" ? "partner" : fallback;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_URL || "").replace(/\/$/, "");
}

function getPaymentLinkUrl(secureToken: string) {
  const frontendUrl = getFrontendBaseUrl();
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not configured");
  }
  return `${frontendUrl}/payment-link/${encodeURIComponent(secureToken)}`;
}

function getSuccessUrl(secureToken: string) {
  const frontendUrl = process.env.DASHBOARD_URL || process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error("DASHBOARD_URL or FRONTEND_URL is not configured");
  }
  return `${frontendUrl.replace(/\/$/, "")}/success?token=${encodeURIComponent(secureToken)}&session_id={CHECKOUT_SESSION_ID}`;
}

function getMembershipChangeSuccessUrl(secureToken: string) {
  const frontendUrl = process.env.DASHBOARD_URL || process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new Error("DASHBOARD_URL or FRONTEND_URL is not configured");
  }
  return `${frontendUrl.replace(/\/$/, "")}/dashboard/membership/change/success?token=${encodeURIComponent(secureToken)}&session_id={CHECKOUT_SESSION_ID}`;
}

function getMembershipPriceId(category?: string | null) {
  const normalizedCategory = normalizeMembershipPackage(category) || "Professional";
  const key = MEMBERSHIP_PRICE_KEYS[normalizedCategory as keyof typeof MEMBERSHIP_PRICE_KEYS];
  if (!key) {
    throw new Error(`Unsupported membership category: ${category}`);
  }
  return getRequiredEnv(key);
}

function getSponsorshipPriceId(tier?: string | null) {
  const key = SPONSORSHIP_PRICE_KEYS[(tier || "") as keyof typeof SPONSORSHIP_PRICE_KEYS];
  if (!key) {
    throw new Error(`Unsupported sponsorship tier: ${tier}`);
  }
  return getRequiredEnv(key);
}

function getPaginationParams(query: Record<string, unknown>, defaultLimit: number, maxLimit: number) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

  return { limit, offset };
}

function getSingleValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return null;
}

function normalizeHeaderValue(value: unknown, maxLength = 120) {
  if (typeof value !== "string") {
    return "unknown";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength).toLowerCase() : "unknown";
}

function isValidEmail(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFileExtension(fileNameOrUrl: string) {
  const cleanValue = fileNameOrUrl.split("?")[0]?.split("#")[0] || "";
  return cleanValue.split(".").pop()?.toLowerCase() || "";
}

function isAllowedAdditionalFile(fileName: string, fileUrl: string) {
  return ALLOWED_ADDITIONAL_FILE_EXTENSIONS.has(getFileExtension(fileName))
    || ALLOWED_ADDITIONAL_FILE_EXTENSIONS.has(getFileExtension(fileUrl));
}

function generateCertificateNumber() {
  return `CERT-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function mapCanonicalStatusToLegacy(status: string | null | undefined) {
  switch ((status || "").toUpperCase()) {
    case "UNDER_REVIEW":
      return "review";
    case "REJECTED":
      return "rejected";
    case "APPROVED":
    case "PAYMENT_SENT":
      return "approved";
    case "PAID":
      return "paid";
    default:
      return "pending";
  }
}

function getApplicationPaymentToken(application: typeof coreApplications.$inferSelect) {
  const link = application.paymentLink || "";
  const match = link.match(/\/payment-link\/([^/?#]+)/i);
  return match?.[1] || null;
}

function getApplicationCertificateNumber(application: typeof coreApplications.$inferSelect | null) {
  const payload = asRecord(application?.applicationData);
  const certificateNumber = payload.certificateNumber;
  return typeof certificateNumber === "string" && certificateNumber.trim() ? certificateNumber.trim() : null;
}

/** The promo code an applicant entered on their application, if any. */
function getApplicationPromoCode(application: typeof coreApplications.$inferSelect | null) {
  return normalizePromoCodeInput(asRecord(application?.applicationData).promoCode) || null;
}

/**
 * Keep only a promo code that can still be redeemed. Applicants type the code
 * on the form, but nothing is discounted until an administrator approves the
 * application, so an unknown or disabled code is simply not stored.
 */
async function normalizeSubmittedPromoCode(db: ReturnType<typeof requireDb>, value: unknown) {
  if (!normalizePromoCodeInput(value)) {
    return null;
  }

  try {
    const promoCode = await findRedeemablePromoCode(db, value);
    return promoCode?.code ?? null;
  } catch (error) {
    console.error("[Promo codes] Failed to verify submitted code", error);
    return null;
  }
}

/**
 * What an administrator needs to know about an applicant's promo code before
 * approving: the code itself, and whether it will still discount the invoice.
 */
async function describeApplicationPromoCode(application: typeof coreApplications.$inferSelect) {
  const code = getApplicationPromoCode(application);
  if (!code) {
    return null;
  }

  const applied = asRecord(asRecord(application.applicationData).promoCodeApplied);
  const appliedAt = typeof applied.appliedAt === "string" ? applied.appliedAt : null;

  try {
    const promoCode = (await listPromoCodes(requireDb())).find((item) => item.code === code);

    if (!promoCode) {
      return { code, label: null, status: "removed" as const, appliedAt, message: null };
    }
    if (!promoCode.enabled) {
      return { code, label: promoCode.label, status: "disabled" as const, appliedAt, message: null };
    }

    const discount = await describePromoCodeDiscount(promoCode);
    if (discount.status !== "linked") {
      return {
        code,
        label: promoCode.label,
        status: "unconfigured" as const,
        appliedAt,
        message: discount.message,
      };
    }

    return { code, label: promoCode.label, status: "active" as const, appliedAt, message: null };
  } catch (error) {
    console.error("[Promo codes] Failed to describe application code", error);
    return { code, label: null, status: "unknown" as const, appliedAt, message: null };
  }
}

/**
 * Resolve the Stripe coupon for an approved application. Re-checked at
 * approval time so a code an administrator has since turned off stops
 * discounting, and a code that was added later still applies.
 */
async function resolveApplicationDiscount(application: typeof coreApplications.$inferSelect) {
  const code = getApplicationPromoCode(application);
  if (!code) {
    return null;
  }

  try {
    const promoCode = await findRedeemablePromoCode(requireDb(), code);
    const couponId = promoCode ? resolveStripeCouponId(promoCode) : null;
    if (!promoCode || !couponId) {
      return { code, couponId: null, label: null, applied: false };
    }

    return { code: promoCode.code, couponId, label: promoCode.label, applied: true };
  } catch (error) {
    console.error("[Promo codes] Failed to resolve discount for application", error);
    return { code, couponId: null, label: null, applied: false };
  }
}

function toVerificationResponse(application: typeof coreApplications.$inferSelect, payment: typeof corePayments.$inferSelect | null) {
  return {
    id: application.id,
    email: application.email,
    name: application.fullName,
    membershipCategory: application.packageName,
    applicantType: MEMBERSHIP_APPLICANT_TYPES[(application.packageName || "Professional") as keyof typeof MEMBERSHIP_PRICE_KEYS] || "Individual",
    accountType: "member",
    status: mapCanonicalStatusToLegacy(application.status),
    stripeSessionId: payment?.stripeSessionId ?? null,
    createdAt: application.createdAt,
  };
}

async function sendApplicationReceivedEmail(params: { email: string; name: string; membershipPackage?: string | null; }) {
  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: params.email,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: "IBPA application received",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 24px; color: #0f172a;">
        <h1 style="margin: 0 0 20px; font-size: 28px; line-height: 1.1; text-transform: uppercase;">Your application has been received</h1>
        <p>Hello ${escapeHtml(params.name || "there")},</p>
        <p>Thank you for submitting your application to IBPA${params.membershipPackage ? ` for the <strong>${escapeHtml(params.membershipPackage)}</strong> category` : ""}. Your profile is now under review by our board.</p>
      </div>
    `,
  });
}

async function sendAdminNewApplicationEmail(params: { email: string; name: string; phone?: string | null; membershipPackage?: string | null; applicantType?: string | null; }) {
  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: adminNotificationEmail,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: `New IBPA application: ${params.name || params.email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 24px; color: #0f172a;">
        <h1 style="margin: 0 0 20px; font-size: 28px; line-height: 1.1;">${escapeHtml(params.name || "New applicant")}</h1>
        <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(params.phone || "")}</p>
        <p><strong>Membership:</strong> ${escapeHtml(params.membershipPackage || "")}</p>
        <p><strong>Applicant type:</strong> ${escapeHtml(params.applicantType || "")}</p>
      </div>
    `,
  });
}

async function sendApprovalEmail(params: { email: string; name: string; certificateNumber: string; checkoutUrl?: string | null; paymentLinkUrl?: string | null; }) {
  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: params.email,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: "Your IBPA application has been approved",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
        <h2 style="color: #333; text-transform: uppercase;">Congratulations, ${escapeHtml(params.name)}!</h2>
        <p>Your application for professional certification <b>${escapeHtml(params.certificateNumber)}</b> has been approved.</p>
        <p>To complete the process, please pay the registration fee using the link below:</p>
        <div style="margin: 30px 0;">
          <a href="${escapeHtml(params.checkoutUrl || "#")}" style="background-color: #B9D9EB; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Pay with Stripe</a>
        </div>
        ${params.paymentLinkUrl ? `<p><a href="${escapeHtml(params.paymentLinkUrl)}">Need a fresh payment link?</a></p>` : ""}
      </div>
    `,
  });
}

async function sendMembershipChangeApprovalEmail(params: {
  email: string;
  name: string;
  fromCategory: string;
  toCategory: string;
  balanceDue: number;
  checkoutUrl?: string | null;
  paymentLinkUrl?: string | null;
  activated?: boolean;
}) {
  const formattedBalance = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(params.balanceDue / 100);
  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: params.email,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: params.activated
      ? "Your IBPA membership change is complete"
      : "Your IBPA membership change has been approved",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #dbe7f2; border-radius: 20px; color: #10203b;">
        <p>Hello ${escapeHtml(params.name || "there")},</p>
        <h2 style="margin: 12px 0;">${params.activated ? "Membership changed" : "Change approved"}</h2>
        <p>Your request to move from <strong>${escapeHtml(params.fromCategory)}</strong> to <strong>${escapeHtml(params.toCategory)}</strong> has been approved.</p>
        ${params.activated
          ? `<p>There was no additional balance. Your new membership is active now.</p>`
          : `<p>Only the difference between the memberships is due: <strong>${escapeHtml(formattedBalance)}</strong>.</p>
             <p style="margin: 28px 0;"><a href="${escapeHtml(params.checkoutUrl || "#")}" style="display:inline-block;background:#10203b;color:#fff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;">Pay membership difference</a></p>
             ${params.paymentLinkUrl ? `<p><a href="${escapeHtml(params.paymentLinkUrl)}">Need a fresh payment link?</a></p>` : ""}`}
      </div>
    `,
  });
}

async function sendAdminPaymentLinkSentEmail(params: { email: string; name: string; orderId: string; membershipCategory?: string | null; checkoutUrl?: string | null; }) {
  return sendEmailOrThrow({
    from: PAYMENTS_SENDER,
    to: adminNotificationEmail,
    replyTo: PAYMENTS_REPLY_TO,
    subject: `IBPA payment link sent: ${params.name || params.email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 20px; color: #0f172a;">
        <p><strong>Applicant:</strong> ${escapeHtml(params.name || "Unknown")}</p>
        <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
        <p><strong>Membership:</strong> ${escapeHtml(params.membershipCategory || "N/A")}</p>
        <p><strong>Order ID:</strong> ${escapeHtml(params.orderId)}</p>
        ${params.checkoutUrl ? `<p><a href="${escapeHtml(params.checkoutUrl)}">Stripe checkout link</a></p>` : ""}
      </div>
    `,
  });
}

async function sendReviewEmail(params: { email: string; name: string; requestedChanges: string; editToken: string; isPaidMember?: boolean; }) {
  const frontendUrl = getFrontendBaseUrl();
  if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not configured");
  }
  const editUrl = `${frontendUrl}/application/edit?token=${encodeURIComponent(params.editToken)}`;
  // A paid member keeps their active membership while they update the application.
  const intro = params.isPaidMember
    ? "Our team needs a few additions or updates to your IBPA membership application. Your membership stays active while you make them."
    : "Our review team needs a few updates to your IBPA application before we can continue.";
  const outro = params.isPaidMember
    ? "Please use the button below to open your application. Everything you entered before is already filled in, so you only need to update or add what is requested, then submit it."
    : "Please use the button below to edit your full application and upload any updated files. When you submit it, your application will return to the review queue.";

  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: params.email,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: params.isPaidMember
      ? "Please update your IBPA membership application"
      : "Your IBPA application requires additional review",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 20px; color: #0f172a;">
        <p>Hello ${escapeHtml(params.name || "there")},</p>
        <p>${intro}</p>
        <p style="white-space: pre-wrap; padding: 16px; background: #f8fafc; border-radius: 12px;"><strong>Requested changes:</strong><br>${escapeHtml(params.requestedChanges)}</p>
        <p>${outro}</p>
        <p style="margin: 28px 0;"><a href="${escapeHtml(editUrl)}" style="display: inline-block; background: #1F5D8F; color: #fff; padding: 14px 22px; border-radius: 10px; text-decoration: none; font-weight: bold;">Edit application</a></p>
      </div>
    `,
  });
}

async function sendAdminApplicationUpdatedEmail(params: { email: string; name: string; orderId: string; membershipCategory?: string | null; isPaidMember: boolean; }) {
  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: adminNotificationEmail,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: `IBPA application updated: ${params.name || params.email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 20px; color: #0f172a;">
        <p>${escapeHtml(params.name || params.email)} submitted the changes you requested on their application.</p>
        <p><strong>Email:</strong> ${escapeHtml(params.email)}</p>
        <p><strong>Membership:</strong> ${escapeHtml(params.membershipCategory || "N/A")}</p>
        <p><strong>Status:</strong> ${params.isPaidMember ? "Paid member (membership unchanged)" : "Back in the review queue"}</p>
        <p><strong>Order ID:</strong> ${escapeHtml(params.orderId)}</p>
      </div>
    `,
  });
}

async function sendRejectedEmail(params: { email: string; name: string; }) {
  return sendEmailOrThrow({
    from: APPLICATIONS_SENDER,
    to: params.email,
    replyTo: APPLICATIONS_REPLY_TO,
    subject: "Your IBPA application was not approved",
    html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><p>Hello ${escapeHtml(params.name || "there")},</p><p>After review, we are unable to approve your application at this time.</p></div>`,
  });
}

async function sendDashboardActivationEmail(params: { email: string; name: string; secureToken: string; }) {
  const dashboardUrl = process.env.DASHBOARD_URL || process.env.FRONTEND_URL || "";
  const activationUrl = `${dashboardUrl.replace(/\/$/, "")}/success?token=${encodeURIComponent(params.secureToken)}`;

  return sendEmailOrThrow({
    from: PAYMENTS_SENDER,
    to: params.email,
    replyTo: PAYMENTS_REPLY_TO,
    subject: "Complete your IBPA dashboard access",
    html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><p>Hello ${escapeHtml(params.name || "there")},</p><p>Your payment has been received.</p><p><a href="${escapeHtml(activationUrl)}">Open dashboard access</a></p></div>`,
  });
}

async function sendAdminPaymentReceivedEmail(params: { email: string; name: string; orderId: string; membershipCategory?: string | null; stripeSessionId?: string | null; }) {
  return sendEmailOrThrow({
    from: PAYMENTS_SENDER,
    to: adminNotificationEmail,
    replyTo: PAYMENTS_REPLY_TO,
    subject: `IBPA payment received: ${params.name || params.email}`,
    html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><p><strong>Applicant:</strong> ${escapeHtml(params.name || "Unknown")}</p><p><strong>Email:</strong> ${escapeHtml(params.email)}</p><p><strong>Membership:</strong> ${escapeHtml(params.membershipCategory || "N/A")}</p><p><strong>Order ID:</strong> ${escapeHtml(params.orderId)}</p><p><strong>Stripe session:</strong> ${escapeHtml(params.stripeSessionId || "N/A")}</p></div>`,
  });
}

async function loadMemberApplicationAggregate(db: ReturnType<typeof requireDb>, applicationId: string) {
  const [application, payment, membership, certificate] = await Promise.all([
    db.select().from(coreApplications).where(and(eq(coreApplications.id, applicationId), eq(coreApplications.type, "MEMBER"))).limit(1).then((rows: typeof coreApplications.$inferSelect[]) => rows[0] ?? null),
    db.select().from(corePayments).where(eq(corePayments.id, applicationId)).limit(1).then((rows: typeof corePayments.$inferSelect[]) => rows[0] ?? null),
    db.select().from(coreMemberships).where(eq(coreMemberships.id, applicationId)).limit(1).then((rows: typeof coreMemberships.$inferSelect[]) => rows[0] ?? null),
    db.select().from(coreCertificates).where(eq(coreCertificates.membershipId, applicationId)).limit(1).then((rows: typeof coreCertificates.$inferSelect[]) => rows[0] ?? null),
  ]);

  return { application, payment, membership, certificate };
}

async function ensureCertificateNumber(application: typeof coreApplications.$inferSelect) {
  const current = getApplicationCertificateNumber(application);
  if (current) {
    return current;
  }

  const nextCertificateNumber = generateCertificateNumber();
  const nextPayload = {
    ...asRecord(application.applicationData),
    certificateNumber: nextCertificateNumber,
  };

  const db = requireDb();
  await db
    .update(coreApplications)
    .set({ applicationData: nextPayload })
    .where(eq(coreApplications.id, application.id));

  return nextCertificateNumber;
}

async function createMembershipCheckoutSession(params: { application: typeof coreApplications.$inferSelect; payment?: typeof corePayments.$inferSelect | null; }) {
  const { application, payment } = params;
  const status = mapCanonicalStatusToLegacy(application.status);
  if (status === "paid") {
    throw new Error("This order has already been paid.");
  }

  if (isMembershipChangeApplicationData(application.applicationData)) {
    const change = getMembershipChangeDetails(asRecord(application.applicationData).membershipChange);
    if (!change) throw new Error("The membership change details are invalid.");
    const recalculated = calculateMembershipBalance(change.fromCategory, change.toCategory);
    if (!recalculated || recalculated.balanceDue !== change.balanceDue) {
      throw new Error("The membership difference could not be verified.");
    }

    const token = getApplicationPaymentToken(application) || crypto.randomUUID();
    const paymentLinkUrl = getPaymentLinkUrl(token);
    if (change.balanceDue === 0) {
      const activated = await activateMembershipChange(requireDb(), { application, paidAt: new Date() });
      return {
        session: null,
        certificateNumber: activated.certificateNumber,
        paymentLinkUrl: null,
        membershipChange: change,
        activated: true,
        discount: null,
      };
    }

    const metadata = {
      orderId: application.id,
      orderKind: "membership_change",
      applicationId: application.id,
      applicantEmail: application.email,
      fromMembership: change.fromCategory,
      toMembership: change.toCategory,
      balanceDue: String(change.balanceDue),
      environment: process.env.NODE_ENV || "development",
    };
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: application.email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: change.balanceDue,
          product_data: {
            name: `IBPA membership change: ${change.fromCategory} to ${change.toCategory}`,
            description: "Difference between current and requested annual membership",
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: getMembershipChangeSuccessUrl(token),
      cancel_url: `${process.env.DASHBOARD_URL || process.env.FRONTEND_URL}/dashboard/membership/change`,
      metadata,
    });

    const db = requireDb();
    await upsertCanonicalPayment(db, {
      id: application.id,
      userId: application.userId ?? payment?.userId ?? null,
      type: "membership_change",
      stripeSessionId: session.id,
      amount: change.balanceDue,
      status: "PENDING",
      createdAt: payment?.createdAt ?? application.createdAt,
      paidAt: null,
    });
    await db.update(coreApplications).set({
      status: "PAYMENT_SENT",
      paymentLink: `/payment-link/${token}`,
    }).where(eq(coreApplications.id, application.id));

    return {
      session,
      certificateNumber: getApplicationCertificateNumber(application) || "",
      paymentLinkUrl,
      membershipChange: change,
      activated: false,
      discount: null,
    };
  }

  const certificateNumber = await ensureCertificateNumber(application);
  const token = getApplicationPaymentToken(application) || crypto.randomUUID();
  const paymentLinkUrl = getPaymentLinkUrl(token);
  const priceId = getMembershipPriceId(application.packageName);
  const discount = await resolveApplicationDiscount(application);
  const metadata = {
    orderId: application.id,
    orderKind: "membership",
    certificateNumber,
    applicationId: application.id,
    applicantEmail: application.email,
    applicationType: application.packageName || "membership",
    ...(discount?.applied ? { promoCode: discount.code } : {}),
    environment: process.env.NODE_ENV || "development",
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: application.email,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: getSuccessUrl(token),
    cancel_url: `${process.env.DASHBOARD_URL || process.env.FRONTEND_URL}/`,
    ...(discount?.applied && discount.couponId
      ? { discounts: [{ coupon: discount.couponId }] }
      : {}),
    subscription_data: { metadata },
    metadata,
  });

  const db = requireDb();
  await upsertCanonicalPayment(db, {
    id: application.id,
    userId: application.userId ?? payment?.userId ?? null,
    type: "membership",
    stripeSessionId: session.id,
    amount: 0,
    status: "PENDING",
    createdAt: payment?.createdAt ?? application.createdAt,
    paidAt: null,
  });
  await db
    .update(coreApplications)
    .set({
      status: "PAYMENT_SENT",
      paymentLink: `/payment-link/${token}`,
      applicationData: {
        ...asRecord(application.applicationData),
        certificateNumber,
        promoCodeApplied: discount?.applied
          ? { code: discount.code, appliedAt: new Date().toISOString() }
          : null,
      },
    })
    .where(eq(coreApplications.id, application.id));

  return {
    session,
    certificateNumber,
    paymentLinkUrl,
    membershipChange: null,
    activated: false,
    discount,
  };
}

async function getMembershipSubscriptionExpiry(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  if (!currentPeriodEnd) {
    throw new Error(`Unable to determine current_period_end for subscription ${subscriptionId}`);
  }
  return new Date(currentPeriodEnd * 1000);
}

async function markApplicationPaid(params: {
  application: typeof coreApplications.$inferSelect;
  stripeSessionId: string;
  subscriptionId?: string | null;
}) {
  const db = requireDb();
  const userResult = await ensureCanonicalUser(db, {
    email: params.application.email,
    clerkId: null,
    role: "MEMBER",
    status: "ACTIVE",
  });
  const expiresAt = params.subscriptionId ? await getMembershipSubscriptionExpiry(params.subscriptionId) : null;
  const certificateNumber = getApplicationCertificateNumber(params.application) || generateCertificateNumber();

  await db
    .update(coreApplications)
    .set({
      userId: userResult.record.id,
      status: "PAID",
      applicationData: {
        ...asRecord(params.application.applicationData),
        certificateNumber,
      },
    })
    .where(eq(coreApplications.id, params.application.id));

  await upsertCanonicalPayment(db, {
    id: params.application.id,
    userId: userResult.record.id,
    type: "membership",
    stripeSessionId: params.stripeSessionId,
    amount: 0,
    status: "PAID",
    createdAt: params.application.createdAt,
    paidAt: new Date(),
  });

  await upsertCanonicalMembership(db, {
    id: params.application.id,
    userId: userResult.record.id,
    type: params.application.packageName || "Professional",
    status: "ACTIVE",
    startedAt: new Date(),
    expiresAt,
  });

  await upsertCanonicalCertificate(db, {
    id: params.application.id,
    membershipId: params.application.id,
    certificateNumber,
    issuedAt: new Date(),
    expiresAt,
  });

  // Populate the member profile from the application payload (verify/:token
  // reconciliation path, mirrors the Stripe webhook handler).
  await syncProfileFromApplication(db, {
    userId: userResult.record.id,
    application: {
      id: params.application.id,
      type: params.application.type,
      fullName: params.application.fullName,
      phone: params.application.phone,
      packageName: params.application.packageName,
      applicationData: {
        ...asRecord(params.application.applicationData),
        certificateNumber,
      },
    },
  });

  if (isBusinessOwnerMembershipType(params.application.packageName)) {
    await upsertCanonicalTeam(db, {
      id: params.application.id,
      ownerUserId: userResult.record.id,
      name: params.application.fullName,
      seatCount: INCLUDED_TEAM_SEATS,
      createdAt: params.application.createdAt,
    });
  }

  return {
    user: userResult.record,
    certificateNumber,
    expiresAt,
  };
}

// List/summary projection only. The heavy `applicationData` JSON payload (and the
// derived payment token) are intentionally NOT selected here — the list view never reads
// them, and full detail loads on demand via GET /api/orders/:id. Keeping the list lean
// also keeps /admin/mailing's audience fetch (/api/orders?limit=500) cheap.
async function buildAdminOrderRows(db: ReturnType<typeof requireDb>) {
  const rows = await db
    .select({
      id: coreApplications.id,
      email: coreApplications.email,
      fullName: coreApplications.fullName,
      packageName: coreApplications.packageName,
      status: coreApplications.status,
      createdAt: coreApplications.createdAt,
      applicationKind: sql<string | null>`${coreApplications.applicationData} ->> 'applicationKind'`,
      editRequestPending: sql<boolean>`coalesce(${coreApplications.applicationData} -> 'additionalReview' ->> 'editToken', '') <> ''`,
      editResubmittedAt: sql<string | null>`${coreApplications.applicationData} -> 'additionalReview' ->> 'resubmittedAt'`,
      stripeSessionId: corePayments.stripeSessionId,
      certificateNumber: coreCertificates.certificateNumber,
    })
    .from(coreApplications)
    .leftJoin(corePayments, eq(corePayments.id, coreApplications.id))
    .leftJoin(coreCertificates, eq(coreCertificates.membershipId, coreApplications.id))
    .where(eq(coreApplications.type, "MEMBER"))
    .orderBy(desc(coreApplications.createdAt));

  return rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.fullName,
    membershipCategory: row.packageName,
    applicantType: MEMBERSHIP_APPLICANT_TYPES[(row.packageName || "Professional") as keyof typeof MEMBERSHIP_PRICE_KEYS] || "Individual",
    status: mapCanonicalStatusToLegacy(row.status),
    stripeSessionId: row.stripeSessionId ?? null,
    checkoutUrl: null,
    createdAt: row.createdAt,
    certificateNumber: row.certificateNumber ?? null,
    applicationKind: row.applicationKind ?? null,
    editRequest: row.editRequestPending ? "requested" : row.editResubmittedAt ? "resubmitted" : null,
  })).sort((left: any, right: any) => {
    const leftPriority = left.applicationKind === "MEMBERSHIP_CHANGE" ? 1 : 0;
    const rightPriority = right.applicationKind === "MEMBERSHIP_CHANGE" ? 1 : 0;
    return rightPriority - leftPriority
      || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

ordersRouter.get("/", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  try {
    const db = requireDb();
    const { limit, offset } = getPaginationParams(req.query, ADMIN_ORDER_LIST_DEFAULT_LIMIT, ADMIN_ORDER_LIST_MAX_LIMIT);
    const statusFilter = typeof req.query.status === "string" && ADMIN_ORDER_STATUSES.has(req.query.status) ? req.query.status : null;
    const search = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    const rows = await buildAdminOrderRows(db);
    const filtered = rows.filter((row: any) => {
      const matchesStatus = !statusFilter || row.status === statusFilter;
      const matchesSearch = !search
        || [row.name, row.email, row.membershipCategory, row.certificateNumber]
          .some((value) => String(value || "").toLowerCase().includes(search));
      return matchesStatus && matchesSearch;
    });

    const summary = {
      all: filtered.length,
      pending: filtered.filter((row: any) => row.status === "pending").length,
      review: filtered.filter((row: any) => row.status === "review").length,
      rejected: filtered.filter((row: any) => row.status === "rejected").length,
      approved: filtered.filter((row: any) => row.status === "approved").length,
      paid: filtered.filter((row: any) => row.status === "paid").length,
    };
    const items = filtered.slice(offset, offset + limit);

    return res.json({
      items,
      total: filtered.length,
      summary,
      limit,
      offset,
      hasMore: offset + items.length < filtered.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return res.status(503).json({ error: error.message });
    }
    console.error("Failed to fetch orders:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Mailing audience: every seat across every team, read from the team members
// table (team members are not membership rows, so they are invisible to /cards).
ordersRouter.get("/admin/team-members", adminClerkMiddleware, requireAdminAccess, async (_req, res) => {
  try {
    const emails = await listAllMailableTeamMemberEmails(requireDb());
    return res.json({ emails, count: emails.length });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return res.status(503).json({ error: error.message });
    }
    console.error("Failed to fetch team member audience", error);
    return res.status(500).json({ error: "Failed to fetch team member audience." });
  }
});

ordersRouter.get("/admin/:id/team-members", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!isUuid(id)) {
    return res.status(400).json({ error: "Invalid owner order id." });
  }

  try {
    const result = await listAdminTeamMembersByOwnerOrder(requireDb(), id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return res.status(404).json({ error: "Owner order not found." });
      }
      return res.status(422).json({
        error: "Team members are available only for Business and Partner accounts.",
      });
    }

    return res.json(result.data);
  } catch (error) {
    console.error("Failed to fetch admin team members", error);
    return res.status(500).json({ error: "Failed to fetch team members." });
  }
});

function getAdditionalReviewDetails(application: typeof coreApplications.$inferSelect) {
  const review = asRecord(asRecord(application.applicationData).additionalReview);
  return {
    editToken: textValue(review.editToken),
    requestedChanges: textValue(review.requestedChanges),
    previousApplicationData: review.previousApplicationData && typeof review.previousApplicationData === "object"
      ? review.previousApplicationData as Record<string, unknown>
      : null,
  };
}

// Unpaid applications wait for edits in UNDER_REVIEW; paid ones stay PAID so the
// membership, payment and certificate are untouched while the member edits.
const REVIEW_EDIT_STATUSES = ["UNDER_REVIEW", "PAID"] as const;

// Values the server owns on a paid application. The member's edit never changes them.
const PAID_APPLICATION_SERVER_FIELDS = [
  "certificateNumber",
  "promoCode",
  "promoCodeApplied",
  "stripePaymentIntentId",
  "stripeInvoiceId",
  "stripeSubscriptionId",
  "applicationKind",
  "isMembershipChange",
  "membershipChange",
] as const;

function withoutAdditionalReview(applicationData: unknown) {
  const { additionalReview: _additionalReview, ...rest } = asRecord(applicationData);
  return rest;
}

async function findApplicationForReviewEditToken(db: ReturnType<typeof requireDb>, token: string) {
  const [application] = await db
    .select()
    .from(coreApplications)
    .where(and(
      eq(coreApplications.type, "MEMBER"),
      inArray(coreApplications.status, [...REVIEW_EDIT_STATUSES]),
      sql`${coreApplications.applicationData} -> 'additionalReview' ->> 'editToken' = ${token}`,
    ))
    .limit(1);

  return application ?? null;
}

ordersRouter.get("/review-edit", async (req, res) => {
  const token = getSingleValue(req.query?.token)?.trim() || "";
  if (!token) {
    return res.status(400).json({ error: "Invalid application edit link." });
  }

  try {
    const application = await findApplicationForReviewEditToken(requireDb(), token);
    if (!application) {
      return res.status(404).json({ error: "This application edit link is invalid or has already been used." });
    }

    const review = getAdditionalReviewDetails(application);
    return res.json({
      application: withoutAdditionalReview(application.applicationData),
      requestedChanges: review.requestedChanges,
      // A paid member edits their answers but keeps the membership they paid for.
      isPaidMember: application.status === "PAID",
      membershipCategory: application.packageName,
    });
  } catch (error) {
    console.error("Failed to load application for additional review edit", error);
    return res.status(500).json({ error: "Could not load this application." });
  }
});

ordersRouter.patch("/review-edit", async (req, res) => {
  const token = getSingleValue(req.body?.token)?.trim() || "";
  const applicationData = req.body?.application;
  const membershipPackage = normalizeMembershipPackage(req.body?.package);
  const safeEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const safeName = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!token || !applicationData || typeof applicationData !== "object" || Array.isArray(applicationData)) {
    return res.status(400).json({ error: "Invalid application update." });
  }
  if (!isValidEmail(safeEmail) || safeName.length < 2 || safeName.length > 120) {
    return res.status(400).json({ error: "Please provide a valid name and email address." });
  }
  if (!membershipPackage || !ALLOWED_MEMBERSHIP_PACKAGES.has(membershipPackage)) {
    return res.status(400).json({ error: "Unsupported membership package." });
  }
  const organizationValidationError = validateOrganizationApplication(
    membershipPackage,
    applicationData as Record<string, unknown>,
  );
  if (organizationValidationError) {
    return res.status(400).json({ error: organizationValidationError });
  }
  const requirementsError = validateApplicationRequirements(
    membershipPackage,
    applicationData as Record<string, unknown>,
  );
  if (requirementsError) {
    return res.status(400).json({ error: requirementsError });
  }

  try {
    const db = requireDb();
    const existing = await findApplicationForReviewEditToken(db, token);
    if (!existing) {
      return res.status(404).json({ error: "This application edit link is invalid or has already been used." });
    }

    const isPaidMember = existing.status === "PAID";
    if (isPaidMember && (normalizeMembershipPackage(existing.packageName) ?? membershipPackage) !== membershipPackage) {
      return res.status(400).json({ error: "Your paid membership category cannot be changed from this form." });
    }

    const existingPayload = asRecord(existing.applicationData);
    const isChangeRequest = isMembershipChangeApplicationData(existingPayload);
    const resubmittedAt = new Date().toISOString();
    const additionalReview = {
      ...asRecord(existingPayload.additionalReview),
      editToken: null,
      resubmittedAt,
      // Lets the admin view mark what the member added or edited.
      previousApplicationData: withoutAdditionalReview(existingPayload),
    };

    let normalizedApplication: Record<string, unknown>;
    if (isPaidMember) {
      const serverFieldSet = new Set<string>(PAID_APPLICATION_SERVER_FIELDS);
      const memberAnswers = Object.fromEntries(
        Object.entries(withoutAdditionalReview(applicationData)).filter(([key]) => !serverFieldSet.has(key)),
      );
      const serverFields = Object.fromEntries(
        PAID_APPLICATION_SERVER_FIELDS
          .filter((key) => key in existingPayload)
          .map((key) => [key, existingPayload[key]]),
      );
      normalizedApplication = {
        ...memberAnswers,
        membershipCategory: membershipPackage,
        accountType: "member",
        applicantType: MEMBERSHIP_APPLICANT_TYPES[membershipPackage],
        ...serverFields,
        additionalReview,
      };
    } else {
      normalizedApplication = {
        ...withoutAdditionalReview(applicationData),
        membershipCategory: membershipPackage,
        accountType: "member",
        applicantType: MEMBERSHIP_APPLICANT_TYPES[membershipPackage],
        promoCode: isChangeRequest
          ? null
          : await normalizeSubmittedPromoCode(
            db,
            (applicationData as Record<string, unknown>).promoCode ?? existingPayload.promoCode,
          ),
        // A membership change stays a change after the member edits it.
        ...(isChangeRequest
          ? {
            applicationKind: existingPayload.applicationKind,
            isMembershipChange: true,
            membershipChange: existingPayload.membershipChange,
          }
          : {}),
        additionalReview,
      };
    }
    const applicantPhone = textValue(
      (applicationData as Record<string, unknown>).phone
      ?? (applicationData as Record<string, unknown>).brandContactPhone,
    ).slice(0, 50) || null;

    if (isPaidMember) {
      // The account email and owner stay as they are: the membership, payment and
      // certificate belong to that user, and the status stays PAID.
      await db
        .update(coreApplications)
        .set({
          fullName: safeName,
          phone: applicantPhone,
          applicationData: normalizedApplication,
        })
        .where(eq(coreApplications.id, existing.id));

      if (existing.userId) {
        await syncProfileFromApplication(db, {
          userId: existing.userId,
          application: {
            id: existing.id,
            type: existing.type,
            fullName: safeName,
            phone: applicantPhone,
            packageName: existing.packageName,
            applicationData: normalizedApplication,
          },
        });
      }
    } else {
      const userResult = await ensureCanonicalUser(db, {
        email: safeEmail,
        clerkId: null,
        role: "MEMBER",
        status: "ACTIVE",
      });

      await db
        .update(coreApplications)
        .set({
          fullName: safeName,
          email: safeEmail,
          userId: userResult.record.id,
          packageName: membershipPackage,
          phone: applicantPhone,
          applicationData: normalizedApplication,
          status: "SUBMITTED",
        })
        .where(eq(coreApplications.id, existing.id));
    }

    try {
      await sendAdminApplicationUpdatedEmail({
        email: isPaidMember ? existing.email : safeEmail,
        name: safeName,
        orderId: existing.id,
        membershipCategory: membershipPackage,
        isPaidMember,
      });
    } catch (emailError) {
      console.error("Admin application updated email failed", emailError);
    }

    return res.json({ success: true, status: isPaidMember ? "paid" : "pending" });
  } catch (error) {
    console.error("Failed to save additional review application update", error);
    return res.status(500).json({ error: "Could not save your application changes." });
  }
});

const OPEN_CHANGE_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAYMENT_SENT"]);

type RelatedApplicationRole = "previous" | "update";

function toRelatedApplication(application: typeof coreApplications.$inferSelect, role: RelatedApplicationRole) {
  return {
    id: application.id,
    role,
    name: application.fullName,
    membershipCategory: application.packageName,
    status: mapCanonicalStatusToLegacy(application.status),
    createdAt: application.createdAt,
  };
}

/**
 * The applications an admin should be able to flip between for one member: the
 * application a change was based on, and the open change request built on it.
 */
async function findRelatedApplications(
  db: ReturnType<typeof requireDb>,
  application: typeof coreApplications.$inferSelect,
) {
  if (!application.userId) return { related: [], previous: null as typeof coreApplications.$inferSelect | null };

  const siblings: typeof coreApplications.$inferSelect[] = await db
    .select()
    .from(coreApplications)
    .where(and(eq(coreApplications.userId, application.userId), eq(coreApplications.type, "MEMBER")))
    .orderBy(desc(coreApplications.createdAt));

  const change = isMembershipChangeApplicationData(application.applicationData)
    ? getMembershipChangeDetails(asRecord(application.applicationData).membershipChange)
    : null;

  if (change) {
    const previous = siblings.find((item) =>
      item.id !== application.id
      && (item.id === change.previousApplicationId || item.id === change.previousMembershipId),
    ) ?? null;
    return {
      previous,
      related: previous ? [toRelatedApplication(previous, "previous"), toRelatedApplication(application, "update")] : [],
    };
  }

  const update = siblings.find((item) => {
    if (item.id === application.id || !OPEN_CHANGE_STATUSES.has(item.status)) return false;
    const details = isMembershipChangeApplicationData(item.applicationData)
      ? getMembershipChangeDetails(asRecord(item.applicationData).membershipChange)
      : null;
    return details?.previousApplicationId === application.id || details?.previousMembershipId === application.id;
  });

  return {
    previous: null,
    related: update ? [toRelatedApplication(application, "previous"), toRelatedApplication(update, "update")] : [],
  };
}

ordersRouter.get("/:id", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  try {
    const id = getSingleValue(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid application id" });
    }

    const db = requireDb();
    const { application, payment, certificate } = await loadMemberApplicationAggregate(db, id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const { related, previous } = await findRelatedApplications(db, application);

    return res.json({
      id: application.id,
      email: application.email,
      name: application.fullName,
      membershipCategory: application.packageName,
      applicantType: MEMBERSHIP_APPLICANT_TYPES[(application.packageName || "Professional") as keyof typeof MEMBERSHIP_PRICE_KEYS] || "Individual",
      applicationPayload: application.applicationData,
      // A membership change compares with the application it replaces; an
      // application the member edited after a request compares with its earlier answers.
      previousApplicationPayload: previous?.applicationData
        ?? getAdditionalReviewDetails(application).previousApplicationData,
      relatedApplications: related,
      applicationKind: asRecord(application.applicationData).applicationKind ?? null,
      status: mapCanonicalStatusToLegacy(application.status),
      stripeSessionId: payment?.stripeSessionId ?? null,
      createdAt: application.createdAt,
      certificateNumber: certificate?.certificateNumber ?? getApplicationCertificateNumber(application),
      promoCode: await describeApplicationPromoCode(application),
    });
  } catch (error) {
    console.error("Failed to fetch order detail", error);
    return res.status(500).json({ error: "Failed to fetch order detail" });
  }
});

async function updateMembershipCategory(req: any, res: any) {
  const id = getSingleValue(req.params.id);
  const membershipCategory = normalizeMembershipPackage(req.body?.membershipCategory);
  const accountType = normalizeOrderAccountType(req.body?.accountType);

  if (!id) {
    return res.status(400).json({ error: "Invalid application id" });
  }
  if (typeof membershipCategory !== "string" || !ALLOWED_MEMBERSHIP_PACKAGES.has(membershipCategory)) {
    return res.status(400).json({ error: "Unsupported membership category." });
  }

  try {
    const db = requireDb();
    const [application] = await db.select().from(coreApplications).where(eq(coreApplications.id, id)).limit(1);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const nextPayload = {
      ...asRecord(application.applicationData),
      membershipCategory,
      applicantType: MEMBERSHIP_APPLICANT_TYPES[membershipCategory],
      accountType,
    };

    const [updatedApplication] = await db
      .update(coreApplications)
      .set({
        packageName: membershipCategory,
        applicationData: nextPayload,
      })
      .where(eq(coreApplications.id, id))
      .returning();

    return res.json({ success: true, application: updatedApplication });
  } catch (error) {
    console.error("Failed to update application membership category", error);
    return res.status(500).json({ error: "Failed to update application membership category" });
  }
}

ordersRouter.patch("/admin/applications/:id", adminClerkMiddleware, requireAdminAccess, updateMembershipCategory);
ordersRouter.patch("/:id", adminClerkMiddleware, requireAdminAccess, updateMembershipCategory);

ordersRouter.post("/", async (req, res) => {
  const { email, name, package: rawMembershipPackage, application, phone, honeypot } = req.body;
  const membershipPackage = normalizeMembershipPackage(rawMembershipPackage);
  const secureToken = crypto.randomUUID();

  if (typeof honeypot === "string" && honeypot.trim()) {
    return res.json({ success: true });
  }

  const clientIp = getClientAddress(req);
  const safeEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const safeName = typeof name === "string" ? name.trim() : "";
  const userAgent = normalizeHeaderValue(req.header("user-agent"));

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }
  if (safeName.length < 2 || safeName.length > 120) {
    return res.status(400).json({ error: "Please provide a valid applicant name." });
  }
  if (typeof membershipPackage !== "string" || !ALLOWED_MEMBERSHIP_PACKAGES.has(membershipPackage)) {
    return res.status(400).json({ error: "Unsupported membership package." });
  }
  if (typeof application !== "object" || application === null || Array.isArray(application)) {
    return res.status(400).json({ error: "Application payload is required." });
  }
  const organizationValidationError = validateOrganizationApplication(
    membershipPackage,
    application as Record<string, unknown>,
  );
  if (organizationValidationError) {
    return res.status(400).json({ error: organizationValidationError });
  }
  const requirementsError = validateApplicationRequirements(
    membershipPackage,
    application as Record<string, unknown>,
  );
  if (requirementsError) {
    return res.status(400).json({ error: requirementsError });
  }

  const ipLimit = applicationLimiter.hit(`orders:ip:${clientIp}`);
  const emailLimit = applicationLimiter.hit(`orders:email:${safeEmail}`);
  const agentLimit = applicationAgentLimiter.hit(`orders:agent:${userAgent}`);
  if (!ipLimit.allowed || !emailLimit.allowed || !agentLimit.allowed) {
    return res.status(429).json({ error: "Too many application attempts. Please try again later." });
  }

  try {
    const db = requireDb();
    const existing = await db
      .select({ id: coreApplications.id, createdAt: coreApplications.createdAt })
      .from(coreApplications)
      .where(and(eq(coreApplications.email, safeEmail), eq(coreApplications.type, "MEMBER")))
      .orderBy(desc(coreApplications.createdAt))
      .limit(1);

    if (existing[0] && Date.now() - new Date(existing[0].createdAt).getTime() < 5 * 60 * 1000) {
      return res.status(409).json({ error: "A recent application already exists for this email. Please wait a few minutes before trying again." });
    }

    const userResult = await ensureCanonicalUser(db, {
      email: safeEmail,
      clerkId: null,
      role: "MEMBER",
      status: "ACTIVE",
    });

    const normalizedApplication: Record<string, unknown> = {
      ...(application as Record<string, unknown>),
      membershipCategory: membershipPackage,
      accountType: "member",
      applicantType: MEMBERSHIP_APPLICANT_TYPES[membershipPackage],
      promoCode: await normalizeSubmittedPromoCode(db, (application as Record<string, unknown>).promoCode),
    };

    const applicantPhone =
      typeof (phone ?? normalizedApplication.phone) === "string" && textValue(phone ?? normalizedApplication.phone)
        ? textValue(phone ?? normalizedApplication.phone).slice(0, 50)
        : null;

    const created = await upsertCanonicalApplication(db, {
      id: crypto.randomUUID(),
      userId: userResult.record.id,
      type: "MEMBER",
      packageName: membershipPackage,
      status: "SUBMITTED",
      fullName: safeName,
      email: safeEmail,
      phone: applicantPhone,
      paymentLink: `/payment-link/${secureToken}`,
      applicationData: normalizedApplication,
      applicationFiles: [],
      approvedAt: null,
      createdAt: new Date(),
    });

    try {
      await sendApplicationReceivedEmail({ email: safeEmail, name: safeName, membershipPackage });
      await sendAdminNewApplicationEmail({
        email: safeEmail,
        name: safeName,
        phone: applicantPhone,
        membershipPackage,
        applicantType: MEMBERSHIP_APPLICANT_TYPES[membershipPackage],
      });
    } catch (emailError) {
      console.error("Application emails failed", emailError);
    }

    return res.status(201).json(created.record);
  } catch (error) {
    if (error instanceof Error && error.message.includes("DATABASE_URL")) {
      return res.status(503).json({ error: error.message });
    }
    console.error("[Order Create] failed", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
});

ordersRouter.get("/:id/additional-files", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  try {
    const db = requireDb();
    const [application] = await db.select({ id: coreApplications.id }).from(coreApplications).where(eq(coreApplications.id, id));
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const files = await listCanonicalApplicationFileRecords(db, id);
    return res.json({
      files: files.map((file: any) => ({
        id: file.id,
        applicationId: id,
        fileName: file.fileName || "Attachment",
        fileUrl: file.fileUrl,
        fileKey: null,
        fileType: "attachment",
        createdAt: file.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to list additional files", error);
    return res.status(500).json({ error: "Failed to list additional files" });
  }
});

ordersRouter.post("/:id/additional-files", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  const incomingFiles: unknown[] = Array.isArray(req.body?.files) ? req.body.files : [req.body];
  if (!id) {
    return res.status(400).json({ error: "Invalid application id" });
  }

  const files: AdditionalFileInput[] = incomingFiles
    .map((file) => {
      const record = file && typeof file === "object" ? file as Record<string, unknown> : {};
      const fileName = typeof record.fileName === "string" ? record.fileName.trim() : "";
      const fileUrl = typeof record.fileUrl === "string" ? record.fileUrl.trim() : "";
      const fileType = typeof record.fileType === "string" ? record.fileType.trim() : "attachment";
      const fileKey = typeof record.fileKey === "string" ? record.fileKey.trim() : null;
      if (!fileName || !fileUrl || !isAllowedAdditionalFile(fileName, fileUrl)) {
        return null;
      }
      return { fileName, fileUrl, fileKey, fileType };
    })
    .filter((item): item is AdditionalFileInput => Boolean(item));

  if (files.length === 0) {
    return res.status(400).json({ error: "At least one valid file is required." });
  }

  try {
    const db = requireDb();
    const aggregate = await loadMemberApplicationAggregate(db, id);
    if (!aggregate.application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const createdFiles = [];
    for (const file of files) {
      const created = await upsertCanonicalApplicationFile(db, {
        id: crypto.randomUUID(),
        ownerUserId: aggregate.application.userId ?? null,
        applicationId: id,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
      });
      createdFiles.push(created);
    }

    const allFiles = await listCanonicalApplicationFileRecords(db, id);
    await db
      .update(coreApplications)
      .set({
        applicationFiles: allFiles.map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileType: "attachment",
          createdAt: file.createdAt.toISOString(),
        })),
      })
      .where(eq(coreApplications.id, id));

    return res.status(201).json({
      files: createdFiles.map((file) => ({
        id: file.id,
        applicationId: id,
        fileName: file.fileName || "Attachment",
        fileUrl: file.fileUrl,
        fileKey: null,
        fileType: "attachment",
        createdAt: file.createdAt,
      })),
    });
  } catch (error) {
    console.error("Failed to add additional application file", error);
    return res.status(500).json({ error: "Failed to add additional file" });
  }
});

ordersRouter.delete("/:id/additional-files/:fileId", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  const fileId = getSingleValue(req.params.fileId);
  if (!id || !fileId) {
    return res.status(400).json({ error: "Invalid application file id" });
  }

  try {
    const db = requireDb();
    const allFiles = await listCanonicalApplicationFileRecords(db, id);
    const remaining = allFiles.filter((file: any) => file.id !== fileId);
    if (remaining.length === allFiles.length) {
      return res.status(404).json({ error: "File not found" });
    }

    await deleteCanonicalApplicationFilesExcept(db, {
      applicationId: id,
      keepIds: remaining.map((file: any) => file.id),
    });

    await db
      .update(coreApplications)
      .set({
        applicationFiles: remaining.map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          fileUrl: file.fileUrl,
          fileType: "attachment",
          createdAt: file.createdAt.toISOString(),
        })),
      })
      .where(eq(coreApplications.id, id));

    return res.json({ success: true, deletedFile: { id: fileId } });
  } catch (error) {
    console.error("Failed to delete additional file", error);
    return res.status(500).json({ error: "Failed to delete additional file" });
  }
});

ordersRouter.delete("/:id", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  try {
    const db = requireDb();
    const id = getSingleValue(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid order id" });
    }

    const { application } = await loadMemberApplicationAggregate(db, id);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }

    await deleteCanonicalApplicationAggregate(db, id);
    return res.json({ success: true, deletedOrder: application });
  } catch (error) {
    console.error("Failed to delete order", error);
    return res.status(500).json({ error: "Failed to delete order" });
  }
});

ordersRouter.post("/admin/approve", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const orderId = getSingleValue(req.body?.orderId);
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const db = requireDb();
    const { application, payment } = await loadMemberApplicationAggregate(db, orderId);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }

    const checkout = await createMembershipCheckoutSession({ application, payment });
    const { session, certificateNumber, paymentLinkUrl, membershipChange, activated } = checkout;
    try {
      if (membershipChange) {
        await sendMembershipChangeApprovalEmail({
          email: application.email,
          name: application.fullName,
          fromCategory: membershipChange.fromCategory,
          toCategory: membershipChange.toCategory,
          balanceDue: membershipChange.balanceDue,
          checkoutUrl: session?.url,
          paymentLinkUrl,
          activated,
        });
      } else {
        await sendApprovalEmail({
          email: application.email,
          name: application.fullName,
          certificateNumber,
          checkoutUrl: session?.url,
          paymentLinkUrl,
        });
      }
    } catch (emailError) {
      console.error("Applicant approval email failed", emailError);
      if (!activated) {
        return res.status(502).json({
          error:
            "The application was approved, but the approval email could not be delivered. Verify email delivery and use Resend Payment Link.",
          code: "APPROVAL_EMAIL_FAILED",
        });
      }
    }

    try {
      if (session) {
        await sendAdminPaymentLinkSentEmail({
          email: application.email,
          name: application.fullName,
          orderId: application.id,
          membershipCategory: application.packageName,
          checkoutUrl: session.url,
        });
      }
    } catch (emailError) {
      console.error("Admin approval notification email failed", emailError);
    }

    return res.json({
      success: true,
      certificateNumber,
      checkoutUrl: session?.url ?? null,
      paymentLinkUrl,
      paymentRequired: Boolean(session),
      activated,
      balanceDue: membershipChange?.balanceDue ?? null,
      promoCode: checkout.discount,
    });
  } catch (error) {
    console.error("Failed to approve order", error);
    return res.status(500).json({ error: "Failed to approve order" });
  }
});

ordersRouter.post("/payment-link", async (req, res) => {
  const token = getSingleValue(req.body?.token);
  if (!token) {
    return res.status(400).json({ error: "Invalid verification token" });
  }

  const clientIp = getClientAddress(req);
  const userAgent = normalizeHeaderValue(req.headers["user-agent"]);
  const tokenLimit = paymentLinkLimiter.hit(`payment-link:token:${token}`);
  const ipLimit = paymentLinkLimiter.hit(`payment-link:ip:${clientIp}`);
  const agentLimit = paymentLinkAgentLimiter.hit(`payment-link:agent:${userAgent}`);
  if (!tokenLimit.allowed || !ipLimit.allowed || !agentLimit.allowed) {
    return res.status(429).json({ error: "Too many payment link attempts. Please try again later." });
  }

  try {
    const db = requireDb();
    const [application] = await db
      .select()
      .from(coreApplications)
      .where(and(eq(coreApplications.type, "MEMBER"), eq(coreApplications.paymentLink, `/payment-link/${token}`)))
      .limit(1);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { payment } = await loadMemberApplicationAggregate(db, application.id);
    if (mapCanonicalStatusToLegacy(application.status) === "paid") {
      return res.status(409).json({ error: "This application has already been paid." });
    }
    if (!["approved", "review"].includes(mapCanonicalStatusToLegacy(application.status)) && application.status !== "PAYMENT_SENT") {
      return res.status(409).json({ error: "Payment link can only be regenerated after approval." });
    }

    const { session, certificateNumber, paymentLinkUrl, membershipChange, activated } = await createMembershipCheckoutSession({ application, payment });
    try {
      if (membershipChange) {
        await sendMembershipChangeApprovalEmail({
          email: application.email,
          name: application.fullName,
          fromCategory: membershipChange.fromCategory,
          toCategory: membershipChange.toCategory,
          balanceDue: membershipChange.balanceDue,
          checkoutUrl: session?.url,
          paymentLinkUrl,
          activated,
        });
      } else {
        await sendApprovalEmail({
          email: application.email,
          name: application.fullName,
          certificateNumber,
          checkoutUrl: session?.url,
          paymentLinkUrl,
        });
      }
      if (session) {
        await sendAdminPaymentLinkSentEmail({
          email: application.email,
          name: application.fullName,
          orderId: application.id,
          membershipCategory: application.packageName,
          checkoutUrl: session.url,
        });
      }
    } catch (emailError) {
      console.error("[Payment Link] Failed to send fresh approval email", emailError);
    }

    return res.json({ success: true, checkoutUrl: session?.url ?? null, paymentLinkUrl, certificateNumber, activated });
  } catch (error) {
    console.error("[Payment Link] Failed to regenerate payment link", error);
    return res.status(500).json({ error: "Failed to regenerate payment link" });
  }
});

ordersRouter.post("/admin/review", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const orderId = getSingleValue(req.body?.orderId);
  const requestedChanges = textValue(req.body?.requestedChanges);
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order id" });
  }
  if (requestedChanges.length < 3 || requestedChanges.length > 5000) {
    return res.status(400).json({ error: "Describe the requested changes in 3 to 5,000 characters." });
  }

  try {
    const db = requireDb();
    const [application] = await db.select().from(coreApplications).where(eq(coreApplications.id, orderId)).limit(1);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (application.type !== "MEMBER") {
      return res.status(400).json({ error: "Additional review is only available for member applications." });
    }

    // A paid application keeps its PAID status (and so its membership and
    // certificate); only the edit link is opened for the member.
    const isPaidMember = application.status === "PAID";
    if (!isPaidMember && !["SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
      return res.status(400).json({ error: "Edits can only be requested for pending, in-review or paid applications." });
    }

    const editToken = crypto.randomUUID();
    const nextApplicationData = {
      ...asRecord(application.applicationData),
      additionalReview: {
        requestedChanges,
        editToken,
        requestedAt: new Date().toISOString(),
        isPaidMember,
      },
    };
    await db
      .update(coreApplications)
      .set({
        status: isPaidMember ? "PAID" : "UNDER_REVIEW",
        applicationData: nextApplicationData,
      })
      .where(eq(coreApplications.id, orderId));
    try {
      await sendReviewEmail({
        email: application.email,
        name: application.fullName,
        requestedChanges,
        editToken,
        isPaidMember,
      });
    } catch (emailError) {
      console.error("Additional review email failed", emailError);
      await db
        .update(coreApplications)
        .set({ status: application.status, applicationData: application.applicationData })
        .where(eq(coreApplications.id, orderId));
      return res.status(502).json({ error: "The edit request email could not be sent. The application was left unchanged." });
    }

    return res.json({ success: true, status: isPaidMember ? "paid" : "review" });
  } catch (error) {
    console.error("Failed to move order into additional review", error);
    return res.status(500).json({ error: "Failed to move order into additional review" });
  }
});

ordersRouter.post("/admin/reject", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const orderId = getSingleValue(req.body?.orderId);
  if (!orderId) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const db = requireDb();
    const [application] = await db.select().from(coreApplications).where(eq(coreApplications.id, orderId)).limit(1);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }

    await db.update(coreApplications).set({ status: "REJECTED" }).where(eq(coreApplications.id, orderId));
    try {
      await sendRejectedEmail({ email: application.email, name: application.fullName });
    } catch (emailError) {
      console.error("Rejected application email failed", emailError);
      await db
        .update(coreApplications)
        .set({ status: application.status })
        .where(eq(coreApplications.id, orderId));
      return res.status(502).json({
        error:
          "The rejection email could not be delivered. The application was left unchanged.",
        code: "REJECTION_EMAIL_FAILED",
      });
    }

    return res.json({ success: true, status: "rejected" });
  } catch (error) {
    console.error("Failed to reject order", error);
    return res.status(500).json({ error: "Failed to reject order" });
  }
});

ordersRouter.post("/sponsorship/checkout", async (req, res) => {
  const tier = getSingleValue(req.body?.tier);
  if (!tier) {
    return res.status(400).json({ error: "Invalid sponsorship tier" });
  }

  try {
    const priceId = getSponsorshipPriceId(tier);
    const landingUrl = (process.env.FRONTEND_URL || "https://www.ibpassociations.org").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${landingUrl}/partnership?payment=success&tier=${encodeURIComponent(tier)}`,
      cancel_url: `${landingUrl}/partnership?payment=cancelled&tier=${encodeURIComponent(tier)}`,
      metadata: { orderKind: "sponsorship", sponsorshipTier: tier },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create sponsorship checkout session", error);
    return res.status(500).json({ error: "Failed to create sponsorship checkout session" });
  }
});

ordersRouter.post("/:id/resend-payment-link", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const db = requireDb();
    const { application, payment } = await loadMemberApplicationAggregate(db, id);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (mapCanonicalStatusToLegacy(application.status) === "paid") {
      return res.status(409).json({ error: "This application has already been paid." });
    }

    const { session, certificateNumber, paymentLinkUrl, membershipChange, activated } = await createMembershipCheckoutSession({ application, payment });
    try {
      if (membershipChange) {
        await sendMembershipChangeApprovalEmail({
          email: application.email,
          name: application.fullName,
          fromCategory: membershipChange.fromCategory,
          toCategory: membershipChange.toCategory,
          balanceDue: membershipChange.balanceDue,
          checkoutUrl: session?.url,
          paymentLinkUrl,
          activated,
        });
      } else {
        await sendApprovalEmail({
          email: application.email,
          name: application.fullName,
          certificateNumber,
          checkoutUrl: session?.url,
          paymentLinkUrl,
        });
      }
    } catch (emailError) {
      console.error("[Admin] Failed to send fresh payment link email", emailError);
      return res.status(502).json({
        error:
          "The payment link was regenerated, but the email could not be delivered.",
        code: "PAYMENT_LINK_EMAIL_FAILED",
      });
    }

    try {
      if (session) {
        await sendAdminPaymentLinkSentEmail({
          email: application.email,
          name: application.fullName,
          orderId: application.id,
          membershipCategory: application.packageName,
          checkoutUrl: session.url,
        });
      }
    } catch (emailError) {
      console.error("[Admin] Payment-link notification email failed", emailError);
    }

    return res.json({ success: true, checkoutUrl: session?.url ?? null, paymentLinkUrl, certificateNumber, activated });
  } catch (error) {
    console.error("Failed to resend payment link", error);
    return res.status(500).json({ error: "Failed to resend payment link" });
  }
});

ordersRouter.get("/verify/:token", async (req, res) => {
  const token = getSingleValue(req.params.token);
  const stripeSessionId = getSingleValue(req.query.session_id);
  if (!token) {
    return res.status(400).json({ error: "Invalid verification token" });
  }

  try {
    const db = requireDb();
    const [application] = await db
      .select()
      .from(coreApplications)
      .where(and(eq(coreApplications.type, "MEMBER"), eq(coreApplications.paymentLink, `/payment-link/${token}`)))
      .limit(1);
    if (!application) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { payment } = await loadMemberApplicationAggregate(db, application.id);
    const checkoutSessionId = stripeSessionId || payment?.stripeSessionId;

    if (application.status !== "PAID" && checkoutSessionId?.startsWith("cs_")) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      const sessionOrderId = session.metadata?.orderId;
      const sessionOrderKind = session.metadata?.orderKind;
      const isPaidSession = session.status === "complete"
        && (session.payment_status === "paid" || session.payment_status === "no_payment_required");

      if (
        sessionOrderId === application.id
        && (sessionOrderKind === "membership" || sessionOrderKind === "membership_change")
        && isPaidSession
      ) {
        if (sessionOrderKind === "membership_change") {
          await activateMembershipChange(db, {
            application,
            stripeSessionId: session.id,
            paidAt: new Date(),
          });
        } else {
          await markApplicationPaid({
            application,
            stripeSessionId: session.id,
            subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
          });
        }

        try {
          if (sessionOrderKind === "membership_change") {
            const change = getMembershipChangeDetails(asRecord(application.applicationData).membershipChange);
            if (change) {
              await sendMembershipChangeApprovalEmail({
                email: application.email,
                name: application.fullName,
                fromCategory: change.fromCategory,
                toCategory: change.toCategory,
                balanceDue: change.balanceDue,
                activated: true,
              });
            }
          } else {
            await sendDashboardActivationEmail({
              email: application.email,
              name: application.fullName,
              secureToken: token,
            });
          }
          await sendAdminPaymentReceivedEmail({
            email: application.email,
            name: application.fullName,
            orderId: application.id,
            membershipCategory: application.packageName,
            stripeSessionId: session.id,
          });
        } catch (emailError) {
          console.error("Payment confirmation emails failed", emailError);
        }

        const refreshed = await loadMemberApplicationAggregate(db, application.id);
        if (refreshed.application) {
          return res.json(toVerificationResponse(refreshed.application, refreshed.payment));
        }
      }
    }

    return res.json(toVerificationResponse(application, payment));
  } catch (error) {
    console.error("Failed to verify token", error);
    return res.status(500).json({ error: "Failed to verify token" });
  }
});

ordersRouter.post("/:id/certificate", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  const { url } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const db = requireDb();
    const { application, membership, certificate } = await loadMemberApplicationAggregate(db, id);
    if (!application || !membership) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    await upsertCanonicalCertificate(db, {
      id,
      membershipId: membership.id,
      certificateNumber: certificate?.certificateNumber || getApplicationCertificateNumber(application) || generateCertificateNumber(),
      certificateUrl: url,
      issuedAt: certificate?.issuedAt ?? new Date(),
      expiresAt: certificate?.expiresAt ?? membership.expiresAt ?? null,
    });

    return res.json({ success: true, certificateUrl: url });
  } catch (error) {
    console.error("Failed to save certificate URL:", error);
    return res.status(500).json({ error: "Failed to save certificate URL" });
  }
});

ordersRouter.delete("/:id/certificate", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const db = requireDb();
    const { application, membership, certificate } = await loadMemberApplicationAggregate(db, id);
    if (!application || !membership || !certificate) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    await upsertCanonicalCertificate(db, {
      id,
      membershipId: membership.id,
      certificateNumber: certificate.certificateNumber,
      certificateUrl: null,
      issuedAt: certificate.issuedAt,
      expiresAt: certificate.expiresAt,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Failed to remove certificate URL:", error);
    return res.status(500).json({ error: "Failed to remove certificate URL" });
  }
});

function handleAdminCertificateError(res: any, error: unknown, fallback: string) {
  if (error instanceof AdminCertificateError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof Error && error.message.includes("DATABASE_URL")) {
    return res.status(503).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

// Admin-uploaded additional certificates for an applicant. Kept separate from
// the primary membership certificate (`/:id/certificate`) and from application
// review attachments (`/:id/additional-files`). The applicant reference is the
// order id (= membership id) in the URL; identity is never taken from the body.
ordersRouter.get("/:id/admin-certificates", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid applicant id" });
  }

  try {
    const items = await listAdminCertificates({ orderId: id });
    return res.json({ items });
  } catch (error) {
    return handleAdminCertificateError(res, error, "Failed to list additional certificates");
  }
});

ordersRouter.post("/:id/admin-certificates", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid applicant id" });
  }

  try {
    const item = await createAdminCertificate({
      orderId: id,
      title: req.body?.title,
      fileUrl: req.body?.fileUrl,
      fileKey: req.body?.fileKey,
      fileName: req.body?.fileName,
      fileType: req.body?.fileType,
      issuedAt: req.body?.issuedAt,
    });
    return res.status(201).json({ success: true, item });
  } catch (error) {
    return handleAdminCertificateError(res, error, "Failed to add additional certificate");
  }
});

ordersRouter.patch("/:id/admin-certificates/:certId", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  const certId = getSingleValue(req.params.certId);
  if (!id || !certId) {
    return res.status(400).json({ error: "Invalid certificate id" });
  }

  try {
    const { certificate, previousFileKey } = await replaceAdminCertificate({
      orderId: id,
      certificateId: certId,
      title: req.body?.title,
      fileUrl: req.body?.fileUrl,
      fileKey: req.body?.fileKey,
      fileName: req.body?.fileName,
      fileType: req.body?.fileType,
      issuedAt: req.body?.issuedAt,
    });
    return res.json({ success: true, item: certificate, previousFileKey });
  } catch (error) {
    return handleAdminCertificateError(res, error, "Failed to update additional certificate");
  }
});

ordersRouter.delete("/:id/admin-certificates/:certId", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  const certId = getSingleValue(req.params.certId);
  if (!id || !certId) {
    return res.status(400).json({ error: "Invalid certificate id" });
  }

  try {
    const { certificate, removedFileKey } = await removeAdminCertificate({
      orderId: id,
      certificateId: certId,
    });
    return res.json({ success: true, id: certificate.id, removedFileKey });
  } catch (error) {
    return handleAdminCertificateError(res, error, "Failed to delete additional certificate");
  }
});

ordersRouter.post("/:id/resend-pdf", adminClerkMiddleware, requireAdminAccess, async (req, res) => {
  const id = getSingleValue(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  try {
    const db = requireDb();
    const { application, certificate } = await loadMemberApplicationAggregate(db, id);
    if (!application || !certificate || !certificate.certificateUrl) {
      return res.status(404).json({ error: "Order or certificate URL not found" });
    }

    const emailResult = await sendEmail({
      from: APPLICATIONS_SENDER,
      to: application.email,
      replyTo: APPLICATIONS_REPLY_TO,
      subject: "Your IBPA certificate is ready",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
          <h2 style="color: #333; text-transform: uppercase;">Hello, ${escapeHtml(application.fullName)}!</h2>
          <p>Your digital certificate <b>${escapeHtml(certificate.certificateNumber)}</b> is available for download.</p>
          <div style="margin: 30px 0;">
            <a href="${escapeHtml(certificate.certificateUrl)}" style="background-color: #B9D9EB; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; text-transform: uppercase;">Download certificate (PDF)</a>
          </div>
        </div>
      `,
    });

    if (emailResult.error) {
      throw new Error(emailResult.error.message);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Failed to resend PDF:", error);
    return res.status(500).json({ error: "Failed to resend PDF: " + (error.message || "") });
  }
});
