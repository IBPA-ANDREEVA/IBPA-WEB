import assert from "node:assert/strict";
import test from "node:test";

import { buildMembershipChangePrefill } from "./membership-change-prefill";

const specialistData = {
  membershipCategory: "Specialist",
  applicantType: "Individual",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@example.com",
  phone: "+1 (415) 555-0100",
  city: "Austin",
  country: "United States",
  instagramLink: "@ana.lash",
  websiteLink: "https://ana.example",
  professionalDesc: "Lash artist for five years.",
  educationDesc: "Academy diploma.",
  profilePhotoFiles: ["https://files/ana.jpg"],
  credentialProofFiles: ["https://files/diploma.pdf"],
  portfolioImages: ["https://files/1.jpg", "https://files/2.jpg"],
  certifyTrue: true,
  agreeStandards: true,
  legalName: "Ana Lopez",
  signature: "Ana Lopez",
  certificateNumber: "CERT-20260101-ABCD",
  promoCode: "FORUM",
  additionalReview: { editToken: "token" },
};

test("keeps what the member already entered and drops lifecycle and sign-off values", () => {
  const prefill = buildMembershipChangePrefill({
    previousData: specialistData,
    fromCategory: "Specialist",
    toCategory: "Professional",
    email: "ana@example.com",
  });

  assert.equal(prefill.firstName, "Ana");
  assert.deepEqual(prefill.portfolioImages, specialistData.portfolioImages);
  assert.equal(prefill.membershipCategory, "Professional");
  for (const key of ["certificateNumber", "promoCode", "additionalReview", "certifyTrue", "agreeStandards", "legalName", "signature"]) {
    assert.equal(key in prefill, false, `${key} should not carry over`);
  }
});

test("re-keys individual answers for a Business application without overwriting existing values", () => {
  const prefill = buildMembershipChangePrefill({
    previousData: { ...specialistData, businessInstagram: "@ana.studio" },
    fromCategory: "Specialist",
    toCategory: "Business",
    email: "ana@example.com",
  });

  assert.deepEqual(prefill.businessProfilePhotoFiles, ["https://files/ana.jpg"]);
  assert.equal(prefill.professionalBiography, "Lash artist for five years.");
  assert.equal(prefill.businessWebsite, "https://ana.example");
  assert.equal(prefill.businessInstagram, "@ana.studio");
  assert.deepEqual(prefill.businessProfessionalCertificationFiles, ["https://files/diploma.pdf"]);
});

test("maps a Brand contact back to an individual applicant", () => {
  const prefill = buildMembershipChangePrefill({
    previousData: {
      membershipCategory: "Brand",
      brandPrimaryContact: "Mira Stone",
      brandContactEmail: "mira@brand.example",
      brandContactPhone: "+1 555 0100",
      brandInstagram: "@brand",
    },
    fromCategory: "Brand",
    toCategory: "Professional",
    email: "mira@account.example",
  });

  assert.equal(prefill.firstName, "Mira");
  assert.equal(prefill.lastName, "Stone");
  assert.equal(prefill.email, "mira@brand.example");
  assert.equal(prefill.instagramLink, "@brand");
});

test("falls back to the member profile and account email for blank answers", () => {
  const prefill = buildMembershipChangePrefill({
    previousData: {},
    fromCategory: "Professional",
    toCategory: "Trainer",
    email: "lee@example.com",
    profile: { firstName: "Lee", lastName: "Kim", city: "Seoul", instagram: "@lee" },
  });

  assert.equal(prefill.email, "lee@example.com");
  assert.equal(prefill.firstName, "Lee");
  assert.equal(prefill.city, "Seoul");
  assert.equal(prefill.instagramLink, "@lee");
});
