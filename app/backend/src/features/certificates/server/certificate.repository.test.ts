import { before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../../../lib/schema";
import { upsertCanonicalCertificate } from "./certificate.repository";

const pg = new PGlite();
const db = drizzle(pg, { schema }) as any;
const userId = crypto.randomUUID();

before(async () => {
  await pg.exec(
    await fs.readFile(new URL("../../../../drizzle/0007_domain_refactor_foundation.sql", import.meta.url), "utf8"),
  );
  await db.insert(schema.coreUsers).values({ id: userId, email: "member@example.test" });
});

beforeEach(async () => {
  await db.delete(schema.coreCertificates);
  await db.delete(schema.coreMemberships);
});

async function createMembership(id = crypto.randomUUID()) {
  await db.insert(schema.coreMemberships).values({ id, userId, type: "Trainer" });
  return id;
}

async function certificatesFor(membershipId: string) {
  return db.select().from(schema.coreCertificates).where(eq(schema.coreCertificates.membershipId, membershipId));
}

test("updates the certificate carried over from a previous membership instead of inserting a duplicate", async () => {
  // Reproduces the production failure: after a membership change the row keeps
  // its original id but now points at the new membership (= application id).
  const membershipId = await createMembership();
  const carriedId = crypto.randomUUID();
  await db.insert(schema.coreCertificates).values({
    id: carriedId,
    membershipId,
    certificateNumber: "CERT-20260420-5E2E",
  });

  const { record, created } = await upsertCanonicalCertificate(db, {
    id: membershipId,
    membershipId,
    certificateNumber: "CERT-20260420-5E2E",
    certificateUrl: "https://example.test/cert.pdf",
  });

  assert.equal(created, false);
  assert.equal(record.id, carriedId);
  const rows = await certificatesFor(membershipId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].certificateUrl, "https://example.test/cert.pdf");
});

test("concurrent first-time writes for one membership both succeed and leave one row", async () => {
  const membershipId = await createMembership();
  const results = await Promise.all([
    upsertCanonicalCertificate(db, { id: membershipId, membershipId, certificateNumber: "CERT-A" }),
    upsertCanonicalCertificate(db, {
      id: crypto.randomUUID(),
      membershipId,
      certificateNumber: "CERT-A",
      certificateUrl: "https://example.test/a.pdf",
    }),
  ]);

  assert.equal(results.length, 2);
  const rows = await certificatesFor(membershipId);
  assert.equal(rows.length, 1);
});

test("null certificateUrl clears the PDF, undefined keeps it", async () => {
  const membershipId = await createMembership();
  await upsertCanonicalCertificate(db, {
    id: membershipId,
    membershipId,
    certificateNumber: "CERT-C",
    certificateUrl: "https://example.test/c.pdf",
  });

  await upsertCanonicalCertificate(db, { id: membershipId, membershipId, certificateNumber: "CERT-C" });
  assert.equal((await certificatesFor(membershipId))[0].certificateUrl, "https://example.test/c.pdf");

  await upsertCanonicalCertificate(db, { id: membershipId, membershipId, certificateNumber: "CERT-C", certificateUrl: null });
  assert.equal((await certificatesFor(membershipId))[0].certificateUrl, null);
});

test("a certificate number owned by another membership does not break the write", async () => {
  const other = await createMembership();
  const membershipId = await createMembership();
  await upsertCanonicalCertificate(db, { id: other, membershipId: other, certificateNumber: "CERT-TAKEN" });
  await upsertCanonicalCertificate(db, { id: membershipId, membershipId, certificateNumber: "CERT-MINE" });

  const { record } = await upsertCanonicalCertificate(db, {
    id: membershipId,
    membershipId,
    certificateNumber: "CERT-TAKEN",
    certificateUrl: "https://example.test/d.pdf",
  });

  assert.equal(record.certificateNumber, "CERT-MINE");
  assert.equal(record.certificateUrl, "https://example.test/d.pdf");
});
