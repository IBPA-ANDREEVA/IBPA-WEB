import assert from "node:assert/strict";
import test from "node:test";

import {
  getNewApplicationFields,
  getRemainingNewFields,
  isApplicationFieldFilled,
} from "./application-steps";

const fieldNames = (from: Parameters<typeof getNewApplicationFields>[0], to: Parameters<typeof getNewApplicationFields>[1]) =>
  getNewApplicationFields(from, to).map((item) => item.field);

test("Specialist to Professional asks for proof documents, a license number, and jurisdictions", () => {
  const fields = fieldNames("Specialist", "Professional");
  assert.ok(fields.includes("credentialProofFiles"));
  assert.ok(fields.includes("licenseNumber"));
  assert.ok(fields.includes("workingJurisdictions"));
  assert.equal(fields.includes("firstName"), false);
});

test("Professional to Trainer adds the educator documents", () => {
  const fields = fieldNames("Professional", "Trainer");
  for (const field of ["educatorRole", "trainerEducationPlanFiles", "trainerCertificateFiles", "trainerExperienceProofFiles"]) {
    assert.ok(fields.includes(field), `${field} should be new`);
  }
  assert.equal(fields.includes("credentialProofFiles"), false);
});

test("never asks again for sign-off or conditional follow-ups", () => {
  const fields = fieldNames("Specialist", "Trainer");
  assert.equal(fields.includes("certifyTrue"), false);
  assert.equal(fields.includes("competitionName"), false);
});

test("an individual becoming a Business owner has Business-only fields to fill", () => {
  const fields = fieldNames("Professional", "Business");
  assert.ok(fields.includes("bizName"));
  assert.ok(fields.includes("businessSupportingDocumentFiles"));
});

test("a file list counts as filled only at its minimum", () => {
  assert.equal(isApplicationFieldFilled("trainerExperienceProofFiles", ["a", "b"]), false);
  assert.equal(isApplicationFieldFilled("trainerExperienceProofFiles", ["a", "b", "c", "d", "e"]), true);
  assert.equal(isApplicationFieldFilled("trainerCertificateFiles", ["a"]), true);
  assert.equal(isApplicationFieldFilled("licenseNumber", "  "), false);
});

test("remaining fields shrink as the member answers", () => {
  const fields = getNewApplicationFields("Professional", "Trainer");
  const before = getRemainingNewFields(fields, {});
  const after = getRemainingNewFields(fields, { trainerCertificateFiles: ["https://file"], educatorRole: "Lead" });
  assert.equal(before.length - after.length, 2);
});
