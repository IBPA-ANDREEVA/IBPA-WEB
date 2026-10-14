import crypto from "crypto";
import { and, eq, inArray, ne } from "drizzle-orm";

import { requireDb } from "@/lib/db";
import {
  coreAdminCertificates,
  coreApplications,
  coreCertificates,
  coreFiles,
  coreMemberships,
  corePayments,
} from "@/lib/schema";
import { stripe } from "@/services/stripe";
import { upsertCanonicalPayment } from "@/features/payments/server/payment.repository";
import { upsertCanonicalMembership } from "./membership.repository";
import { upsertCanonicalTeam } from "@/features/teams/server/team.repository";
import { INCLUDED_TEAM_SEATS, isBusinessOwnerMembershipType } from "@/features/teams/server/team-access";
import { syncProfileFromApplication } from "@/features/profiles/server/application-profile-sync";
import { getMembershipChangeDetails } from "./membership-change";

type DbClient = ReturnType<typeof requireDb>;
type ApplicationRecord = typeof coreApplications.$inferSelect;

const MEMBERSHIP_PRICE_KEYS = {
  Specialist: "STRIPE_PRICE_SPECIALIST",
  Professional: "STRIPE_PRICE_PROFESSIONAL",
  Trainer: "STRIPE_PRICE_TRAINER",
  Business: "STRIPE_PRICE_BUSINESS",
  Brand: "STRIPE_PRICE_BRAND",
} as const;

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getMembershipPriceId(category: keyof typeof MEMBERSHIP_PRICE_KEYS) {
  const key = MEMBERSHIP_PRICE_KEYS[category];
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

function generateCertificateNumber() {
  return `CERT-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

async function resolveSubscriptionId(
  rememberedSubscriptionId: string | null,
  previousPayment: typeof corePayments.$inferSelect | null,
) {
  if (rememberedSubscriptionId) return rememberedSubscriptionId;

  const previousSessionId = previousPayment?.stripeSessionId;
  if (!previousSessionId?.startsWith("cs_")) return null;

  const checkoutSession = await stripe.checkout.sessions.retrieve(previousSessionId);
  return typeof checkoutSession.subscription === "string"
    ? checkoutSession.subscription
    : checkoutSession.subscription?.id ?? null;
}

async function updateExistingStripeSubscription(
  subscriptionId: string | null,
  targetCategory: keyof typeof MEMBERSHIP_PRICE_KEYS,
  targetApplicationId: string,
) {
  if (!subscriptionId) return null;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItem = subscription.items.data[0];
  if (!subscriptionItem) {
    throw new Error("The existing membership subscription has no billable item.");
  }

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: subscriptionItem.id, price: getMembershipPriceId(targetCategory) }],
    proration_behavior: "none",
    metadata: {
      ...subscription.metadata,
      applicationId: targetApplicationId,
      orderId: targetApplicationId,
      orderKind: "membership",
      membershipCategory: targetCategory,
    },
  });

  return subscriptionId;
}

/**
 * Promotes a paid membership-change application to the member's default one.
 *
 * Approval only ever created the new application row. Once the balance is paid
 * this moves everything that hung off the previous application and membership
 * (membership identity, certificate, admin certificates, uploaded files) onto
 * the new application id, keeps the original expiry date, and deletes the
 * previous application and membership. Every step is safe to repeat, so a
 * retry after a partial failure finishes the job instead of failing.
 */
export async function activateMembershipChange(
  db: DbClient,
  params: {
    application: ApplicationRecord;
    stripeSessionId?: string | null;
    paidAt?: Date;
  },
) {
  const applicationData = asRecord(params.application.applicationData);
  const change = getMembershipChangeDetails(applicationData.membershipChange);
  if (!change || applicationData.applicationKind !== "MEMBERSHIP_CHANGE") {
    throw new Error("This application is not a valid membership change.");
  }
  if (!params.application.userId) {
    throw new Error("The membership change is not linked to a member.");
  }

  const applicationId = params.application.id;
  const userId = params.application.userId;

  if (params.application.status === "PAID") {
    const [activeMembership, activeCertificate] = await Promise.all([
      db.select().from(coreMemberships).where(eq(coreMemberships.id, applicationId)).limit(1)
        .then((rows: typeof coreMemberships.$inferSelect[]) => rows[0] ?? null),
      db.select().from(coreCertificates).where(eq(coreCertificates.membershipId, applicationId)).limit(1)
        .then((rows: typeof coreCertificates.$inferSelect[]) => rows[0] ?? null),
    ]);
    return {
      balanceDue: change.balanceDue,
      certificateNumber: activeCertificate?.certificateNumber || "",
      expiresAt: activeMembership?.expiresAt ?? null,
      fromCategory: change.fromCategory,
      subscriptionId: null,
      toCategory: change.toCategory,
    };
  }

  const [previousMembership, currentMembership, previousPayment, previousCertificate] = await Promise.all([
    db.select().from(coreMemberships).where(eq(coreMemberships.id, change.previousMembershipId)).limit(1)
      .then((rows: typeof coreMemberships.$inferSelect[]) => rows[0] ?? null),
    db.select().from(coreMemberships).where(eq(coreMemberships.id, applicationId)).limit(1)
      .then((rows: typeof coreMemberships.$inferSelect[]) => rows[0] ?? null),
    db.select().from(corePayments).where(eq(corePayments.id, change.previousMembershipId)).limit(1)
      .then((rows: typeof corePayments.$inferSelect[]) => rows[0] ?? null),
    db.select().from(coreCertificates).where(eq(coreCertificates.membershipId, change.previousMembershipId)).limit(1)
      .then((rows: typeof coreCertificates.$inferSelect[]) => rows[0] ?? null),
  ]);

  // A retry after the previous membership was already replaced finds the new
  // membership in its place; anything else means the request is stale.
  const baseMembership = previousMembership ?? currentMembership;
  if (!baseMembership || baseMembership.userId !== userId) {
    throw new Error("The previous membership could not be verified.");
  }
  if (
    previousMembership
    && previousMembership.type !== change.fromCategory
    && previousMembership.status === "ACTIVE"
  ) {
    throw new Error("The member's active membership has changed since this request was submitted.");
  }

  // The previous application is whichever MEMBER row the change was based on;
  // its data may remember the subscription that renews the membership.
  const previousApplicationIds = Array.from(new Set(
    [change.previousApplicationId, change.previousMembershipId].filter(
      (id): id is string => Boolean(id) && id !== applicationId,
    ),
  ));
  const previousApplications: ApplicationRecord[] = previousApplicationIds.length
    ? await db
      .select()
      .from(coreApplications)
      .where(and(
        inArray(coreApplications.id, previousApplicationIds),
        eq(coreApplications.userId, userId),
        eq(coreApplications.type, "MEMBER"),
      ))
    : [];
  const rememberedSubscriptionId = previousApplications
    .map((record) => asRecord(record.applicationData).stripeSubscriptionId)
    .find((value): value is string => typeof value === "string" && value.length > 0)
    ?? (typeof applicationData.stripeSubscriptionId === "string" ? applicationData.stripeSubscriptionId : null);

  const subscriptionId = await updateExistingStripeSubscription(
    await resolveSubscriptionId(rememberedSubscriptionId, previousPayment),
    change.toCategory,
    applicationId,
  );
  const paidAt = params.paidAt ?? new Date();
  const certificateNumber = previousCertificate?.certificateNumber
    || (typeof applicationData.certificateNumber === "string" ? applicationData.certificateNumber : "")
    || generateCertificateNumber();

  // 1. New membership takes over identity and the original due date.
  await upsertCanonicalMembership(db, {
    id: applicationId,
    userId,
    type: change.toCategory,
    status: "ACTIVE",
    startedAt: paidAt,
    expiresAt: baseMembership.expiresAt,
  });

  // 2. Certificate and admin certificates follow the member to the new id.
  if (previousCertificate) {
    await db
      .update(coreCertificates)
      .set({ membershipId: applicationId, expiresAt: baseMembership.expiresAt })
      .where(eq(coreCertificates.id, previousCertificate.id));
  } else {
    const [existingCertificate] = await db
      .select()
      .from(coreCertificates)
      .where(eq(coreCertificates.membershipId, applicationId))
      .limit(1);
    if (!existingCertificate) {
      await db.insert(coreCertificates).values({
        id: crypto.randomUUID(),
        membershipId: applicationId,
        certificateNumber,
        issuedAt: paidAt,
        expiresAt: baseMembership.expiresAt,
      });
    }
  }
  if (previousMembership) {
    await db
      .update(coreAdminCertificates)
      .set({ orderId: applicationId, updatedAt: paidAt })
      .where(eq(coreAdminCertificates.orderId, previousMembership.id));
  }

  // 3. Files an admin attached to the previous application stay with the member.
  const carriedFiles = previousApplications.flatMap((record) => record.applicationFiles ?? []);
  if (previousApplicationIds.length) {
    await db
      .update(coreFiles)
      .set({ relatedId: applicationId })
      .where(and(eq(coreFiles.type, "APPLICATION"), inArray(coreFiles.relatedId, previousApplicationIds)));
  }

  await upsertCanonicalPayment(db, {
    id: applicationId,
    userId,
    type: "membership_change",
    stripeSessionId: params.stripeSessionId ?? null,
    amount: change.balanceDue,
    status: "PAID",
    createdAt: params.application.createdAt,
    paidAt,
  });

  if (isBusinessOwnerMembershipType(change.toCategory)) {
    await upsertCanonicalTeam(db, {
      id: applicationId,
      ownerUserId: userId,
      name: params.application.fullName,
      seatCount: INCLUDED_TEAM_SEATS,
      createdAt: paidAt,
    });
  }

  // 4. Retire the previous membership and application. The previous payment
  //    row stays: it is the member's billing history.
  if (previousMembership && previousMembership.id !== applicationId) {
    await db.delete(coreMemberships).where(and(
      eq(coreMemberships.id, previousMembership.id),
      ne(coreMemberships.id, applicationId),
    ));
  }
  if (previousApplications.length) {
    await db.delete(coreApplications).where(inArray(
      coreApplications.id,
      previousApplications.map((record) => record.id),
    ));
  }

  const nextData = {
    ...applicationData,
    certificateNumber,
    ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
    membershipChange: {
      ...change,
      activatedAt: paidAt.toISOString(),
      stripeSubscriptionId: subscriptionId,
    },
  };

  await db
    .update(coreApplications)
    .set({
      status: "PAID",
      approvedAt: params.application.approvedAt ?? paidAt,
      applicationData: nextData,
      applicationFiles: Array.isArray(params.application.applicationFiles) && params.application.applicationFiles.length
        ? params.application.applicationFiles
        : carriedFiles,
    })
    .where(eq(coreApplications.id, applicationId));

  // Fill any blank profile fields from the answers added in this application.
  await syncProfileFromApplication(db, {
    userId,
    application: {
      id: applicationId,
      type: params.application.type,
      fullName: params.application.fullName,
      phone: params.application.phone,
      packageName: params.application.packageName,
      applicationData: nextData,
    },
  });

  return {
    balanceDue: change.balanceDue,
    certificateNumber,
    expiresAt: baseMembership.expiresAt,
    fromCategory: change.fromCategory,
    subscriptionId,
    toCategory: change.toCategory,
  };
}
