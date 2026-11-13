import { eq } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { coreCertificates } from "@/lib/schema";

type DbClient = ReturnType<typeof requireDb>;
type CertificateRecord = typeof coreCertificates.$inferSelect;

export type UpsertCanonicalCertificateInput = {
  id: string;
  membershipId: string;
  certificateNumber: string;
  /** `undefined` keeps the stored URL, `null` clears it. */
  certificateUrl?: string | null;
  issuedAt?: Date;
  expiresAt?: Date | null;
};

/**
 * Creates or updates the single certificate that belongs to a membership.
 *
 * A membership has at most one certificate (ibpa_certificates_membership_uidx),
 * but the row's id need not match the caller's id: membership changes carry the
 * previous certificate row over to the new membership without changing its id.
 * The row is therefore matched by membership first and by id second, and the
 * insert itself is an atomic `ON CONFLICT (membership_id) DO UPDATE`, so two
 * concurrent writers (Stripe webhook, verify/:token, admin upload) can never
 * fail on the unique index.
 */
export async function upsertCanonicalCertificate(db: DbClient, input: UpsertCanonicalCertificateInput) {
  const [byMembership] = await db
    .select()
    .from(coreCertificates)
    .where(eq(coreCertificates.membershipId, input.membershipId))
    .limit(1);
  const existing: CertificateRecord | undefined = byMembership
    ?? (await db.select().from(coreCertificates).where(eq(coreCertificates.id, input.id)).limit(1))[0];

  const certificateNumber = await resolveCertificateNumber(db, input.certificateNumber, existing);

  if (existing) {
    const [updated] = await db
      .update(coreCertificates)
      .set({
        membershipId: input.membershipId,
        certificateNumber,
        certificateUrl: input.certificateUrl !== undefined ? input.certificateUrl : existing.certificateUrl,
        issuedAt: input.issuedAt ?? existing.issuedAt,
        expiresAt: input.expiresAt ?? existing.expiresAt,
      })
      .where(eq(coreCertificates.id, existing.id))
      .returning();

    if (updated) {
      return { record: updated as CertificateRecord, created: false };
    }
    // The row vanished between the read and the write; fall through and insert.
  }

  // Only the fields the caller actually supplied overwrite a row that a
  // concurrent writer inserted between our read and this insert.
  const conflictSet: Partial<CertificateRecord> = { certificateNumber };
  if (input.certificateUrl !== undefined) conflictSet.certificateUrl = input.certificateUrl;
  if (input.issuedAt !== undefined) conflictSet.issuedAt = input.issuedAt;
  if (input.expiresAt != null) conflictSet.expiresAt = input.expiresAt;

  const [created] = await db
    .insert(coreCertificates)
    .values({
      id: input.id,
      membershipId: input.membershipId,
      certificateNumber,
      certificateUrl: input.certificateUrl ?? null,
      issuedAt: input.issuedAt ?? new Date(),
      expiresAt: input.expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: coreCertificates.membershipId,
      set: conflictSet,
    })
    .returning();

  return { record: created as CertificateRecord, created: !existing };
}

/**
 * Certificate numbers are globally unique (ibpa_certificates_number_uidx). When
 * the requested number already belongs to a different certificate, keep the
 * number this membership already has instead of failing the whole write.
 */
async function resolveCertificateNumber(db: DbClient, requested: string, existing: CertificateRecord | undefined) {
  if (existing && existing.certificateNumber === requested) {
    return requested;
  }
  const [holder] = await db
    .select({ id: coreCertificates.id })
    .from(coreCertificates)
    .where(eq(coreCertificates.certificateNumber, requested))
    .limit(1);
  if (!holder || holder.id === existing?.id) {
    return requested;
  }
  if (existing) {
    return existing.certificateNumber;
  }
  throw new Error(`Certificate number ${requested} is already assigned to another membership.`);
}
