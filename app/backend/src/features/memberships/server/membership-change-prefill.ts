import type { MembershipCategory } from "./membership-change";

type FieldMapping = ReadonlyArray<readonly [target: string, source: string]>;
type CategoryFamily = "individual" | "business" | "brand";

// Keys that describe the previous application's lifecycle, not what the member
// entered. They never travel to the new application.
const LIFECYCLE_KEYS = [
  "applicationKind",
  "isMembershipChange",
  "membershipChange",
  "additionalReview",
  "certificateNumber",
  "promoCode",
  "promoCodeApplied",
  "stripeSubscriptionId",
  "accountType",
] as const;

// Declarations the member must make again for every submission.
const DECLARATION_KEYS = [
  "certifyTrue",
  "understandReview",
  "agreeStandards",
  "privacyConsent",
  "additionalDocumentationConsent",
  "legalName",
  "signature",
] as const;

const INDIVIDUAL_TO_BUSINESS: FieldMapping = [
  ["businessProfilePhotoFiles", "profilePhotoFiles"],
  ["businessInstagram", "instagramLink"],
  ["businessWebsite", "websiteLink"],
  ["professionalBiography", "professionalDesc"],
  ["professionalEducation", "educationDesc"],
  ["professionalAchievements", "achievementsDesc"],
  ["businessProfessionalCertificationFiles", "credentialProofFiles"],
  ["businessPortfolioImages", "portfolioImages"],
];

const INDIVIDUAL_TO_BRAND: FieldMapping = [
  ["brandInstagram", "instagramLink"],
  ["brandWebsite", "websiteLink"],
  ["brandContactEmail", "email"],
  ["brandContactPhone", "phone"],
  ["brandCity", "city"],
  ["brandRegistrationCountry", "country"],
  ["brandIndustryContribution", "contributionDesc"],
];

const BUSINESS_TO_BRAND: FieldMapping = [
  ["brandName", "bizName"],
  ["brandYear", "bizYear"],
  ["brandRegistrationCountry", "businessCountry"],
  ["brandCity", "businessCity"],
  ["brandAddress", "businessAddress"],
  ["brandWebsite", "businessWebsite"],
  ["brandInstagram", "businessInstagram"],
  ["brandFacebook", "businessFacebook"],
  ["brandTikTok", "businessTikTok"],
  ["brandLinkedIn", "businessLinkedIn"],
  ["brandYouTube", "businessYouTube"],
  ["brandDescription", "businessDescription"],
  ["brandMission", "businessMission"],
  ["brandProductsServices", "bizServices"],
  ["brandEmployeeCount", "bizTeamSize"],
  ["brandAchievements", "businessAchievements"],
  ["brandIndustryContribution", "businessIndustryContribution"],
  ["brandContactEmail", "email"],
  ["brandContactPhone", "phone"],
  ["profilePhotoFiles", "businessProfilePhotoFiles"],
];

const FAMILY_BY_CATEGORY: Record<MembershipCategory, CategoryFamily> = {
  Specialist: "individual",
  Professional: "individual",
  Trainer: "individual",
  Business: "business",
  Brand: "brand",
};

function invert(mapping: FieldMapping): FieldMapping {
  return mapping.map(([target, source]) => [source, target] as const);
}

function getMapping(from: CategoryFamily, to: CategoryFamily): FieldMapping {
  if (from === to) return [];
  if (from === "individual" && to === "business") return INDIVIDUAL_TO_BUSINESS;
  if (from === "business" && to === "individual") return invert(INDIVIDUAL_TO_BUSINESS);
  if (from === "individual" && to === "brand") return INDIVIDUAL_TO_BRAND;
  if (from === "brand" && to === "individual") return invert(INDIVIDUAL_TO_BRAND);
  if (from === "business" && to === "brand") return BUSINESS_TO_BRAND;
  return invert(BUSINESS_TO_BRAND);
}

export function isBlankValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

type ProfileFallback = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  instagram?: string | null;
  website?: string | null;
};

/**
 * Builds the starting values for a membership-change application: everything
 * the member already entered, re-keyed for the new category where the forms
 * name the same thing differently, with the sign-off declarations cleared.
 * Existing values in the target form always win over mapped ones.
 */
export function buildMembershipChangePrefill(params: {
  previousData: Record<string, unknown>;
  fromCategory: MembershipCategory;
  toCategory: MembershipCategory;
  email: string;
  profile?: ProfileFallback | null;
}): Record<string, unknown> {
  const { previousData, fromCategory, toCategory, email, profile } = params;
  const next: Record<string, unknown> = { ...previousData };

  for (const key of LIFECYCLE_KEYS) delete next[key];
  for (const key of DECLARATION_KEYS) delete next[key];

  const fill = (key: string, value: unknown) => {
    if (isBlankValue(next[key]) && !isBlankValue(value)) next[key] = value;
  };

  for (const [target, source] of getMapping(FAMILY_BY_CATEGORY[fromCategory], FAMILY_BY_CATEGORY[toCategory])) {
    fill(target, next[source]);
  }

  if (FAMILY_BY_CATEGORY[toCategory] === "brand") {
    fill("brandPrimaryContact", [next.firstName, next.lastName].filter((part) => typeof part === "string" && part.trim()).join(" "));
  }
  if (FAMILY_BY_CATEGORY[fromCategory] === "brand" && FAMILY_BY_CATEGORY[toCategory] !== "brand") {
    const [firstName, ...rest] = String(next.brandPrimaryContact ?? "").trim().split(/\s+/);
    fill("firstName", firstName);
    fill("lastName", rest.join(" "));
    fill("email", next.brandContactEmail);
    fill("phone", next.brandContactPhone);
  }

  fill("email", email);
  fill("firstName", profile?.firstName);
  fill("lastName", profile?.lastName);
  fill("phone", profile?.phone);
  fill("city", profile?.city);
  fill("country", profile?.country);
  fill("instagramLink", profile?.instagram);
  fill("websiteLink", profile?.website);

  next.membershipCategory = toCategory;
  return next;
}
