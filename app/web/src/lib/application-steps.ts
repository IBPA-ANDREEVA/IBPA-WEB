import { getOrganizationStepFields, isOrganizationApplication } from "@/lib/organization-application";
import type { MembershipCategory } from "@/lib/membership";

const professionalAchievementFields: string[] = [
  "achievementsYesNo",
  "achievementsDesc",
  "competitionsYesNo",
  "competitionName",
  "competitionYear",
  "competitionResult",
  "speakerEducatorJudge",
  "publicationsYesNo",
  "publicationsLinks",
];

const industryContributionFields: string[] = [
  "professionalCommunityYesNo",
  "otherOrganizationsYesNo",
  "otherOrganizationName",
  "otherOrganizationStatus",
  "otherOrganizationYears",
];

function getCategorySpecificFields(category: MembershipCategory): string[] {
  switch (category) {
    case "Specialist":
      return ["portfolioImages", "studentSchool", "studentProgName", "studentEndDate", "studentMotivation"];
    case "Professional":
      return ["portfolioImages", "workingJurisdictions", ...professionalAchievementFields];
    case "Trainer":
      return [
        "portfolioImages",
        "educatorRole",
        "educatorSubjects",
        "educatorYears",
        "educatorFormat",
        "studentCount",
        "trainerEducationPlanFiles",
        "trainerCertificateFiles",
        "trainerExperienceProofFiles",
        ...professionalAchievementFields,
      ];
    case "Business":
      return ["bizName", "bizType", "bizYear", "bizTeamSize", "bizServices", ...professionalAchievementFields];
    case "Brand":
      return ["brandName", "brandYear", "brandMarket", "brandType"];
    default:
      return [];
  }
}

export function requiresLicenseNumber(category: MembershipCategory) {
  return category !== "Specialist";
}

export function requiresProofDocuments(category: MembershipCategory) {
  return category !== "Specialist";
}

export function includesSubcategorySection(category: MembershipCategory) {
  return category !== "Business" && category !== "Brand";
}

export function getStepFields(step: number, category: MembershipCategory): string[] {
  if (step > 0 && isOrganizationApplication(category)) {
    return getOrganizationStepFields(category, step);
  }

  switch (step) {
    case 0:
      return ["membershipCategory"];
    case 1:
      return category === "Specialist" || category === "Professional" || category === "Trainer"
        ? ["firstName", "lastName", "dateOfBirth", "email", "phone", "citizenship", "city", "country", "profilePhotoFiles"]
        : ["firstName", "lastName", "email", "phone", "citizenship", "city", "country", "profilePhotoFiles"];
    case 2:
      return includesSubcategorySection(category)
        ? ["specialization", "specializationOther", "yearsExperience", "professionalDesc", "workSetting"]
        : ["yearsExperience", "professionalDesc", "workSetting"];
    case 3:
      return requiresLicenseNumber(category)
        ? ["educationDesc", "hasLicense", "licenseNumber", "credentialProofFiles"]
        : ["educationDesc", "hasLicense", "credentialProofFiles"];
    case 4:
      return getCategorySpecificFields(category);
    case 5:
      return category === "Professional" || category === "Trainer" || category === "Business"
        ? category === "Business"
          ? ["instagramLink", "websiteLink", "whyJoin", "contributionDesc", ...industryContributionFields]
          : ["instagramLink", "portfolioLink", "whyJoin", "contributionDesc", ...industryContributionFields]
        : category === "Brand"
          ? ["instagramLink", "websiteLink", "whyJoin", "contributionDesc"]
          : ["instagramLink", "portfolioLink", "whyJoin", "contributionDesc"];
    case 6:
      return ["certifyTrue", "understandReview", "agreeStandards", "privacyConsent", "legalName", "signature"];
    default:
      return [];
  }
}


// Sign-off step. Every submission repeats it, so it is never "new".
const LAST_REVIEWED_STEP = 5;

// Answers that only matter after another answer ("Other", "Yes"), so an empty
// value is not something the member still has to send.
const CONDITIONAL_FIELDS = new Set([
  "specializationOther",
  "achievementsDesc",
  "competitionName",
  "competitionYear",
  "competitionResult",
  "publicationsLinks",
  "otherOrganizationName",
  "otherOrganizationStatus",
  "otherOrganizationYears",
  "bizTypeOther",
  "businessCurrentPositionOther",
  "businessMediaDescription",
  "brandTypeOther",
  "brandContactPositionOther",
  "brandProductCategoryOther",
  "brandCertificationOther",
  "brandCooperationOther",
  "brandMemberBenefitOther",
  "brandPublicationsDetails",
  "brandExhibitionsDetails",
]);

const MINIMUM_FILE_COUNTS: Record<string, number> = {
  portfolioImages: 5,
  trainerExperienceProofFiles: 5,
  businessPortfolioImages: 5,
  businessClientTestimonialFiles: 5,
  brandReviewFiles: 5,
  brandAchievementDocumentFiles: 5,
};

export type NewApplicationField = {
  field: string;
  step: number;
};

/**
 * Fields the application for `to` asks that the one for `from` did not, plus
 * fields both ask but only `to` makes mandatory. Used to point a member at what
 * they still have to add when they switch packages.
 */
export function getNewApplicationFields(from: MembershipCategory, to: MembershipCategory): NewApplicationField[] {
  const previousFields = new Set<string>();
  for (let step = 1; step <= LAST_REVIEWED_STEP; step += 1) {
    getStepFields(step, from).forEach((field) => previousFields.add(field));
  }

  const result: NewApplicationField[] = [];
  const seen = new Set<string>();
  const add = (field: string, step: number) => {
    if (seen.has(field) || CONDITIONAL_FIELDS.has(field)) return;
    seen.add(field);
    result.push({ field, step });
  };

  for (let step = 1; step <= LAST_REVIEWED_STEP; step += 1) {
    for (const field of getStepFields(step, to)) {
      if (!previousFields.has(field)) add(field, step);
    }
  }

  if (!isOrganizationApplication(to)) {
    if (requiresProofDocuments(to) && !requiresProofDocuments(from)) add("credentialProofFiles", 3);
    if (requiresLicenseNumber(to) && !requiresLicenseNumber(from)) add("licenseNumber", 3);
  }

  return result;
}

/** True once the member has supplied enough for the field to count as answered. */
export function isApplicationFieldFilled(field: string, value: unknown) {
  if (Array.isArray(value)) {
    const entries = value.filter((item) => (typeof item === "string" ? item.trim() : item));
    return entries.length >= (MINIMUM_FILE_COUNTS[field] ?? 1);
  }
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined && value !== false;
}

export function getRemainingNewFields(
  newFields: readonly NewApplicationField[],
  values: Record<string, unknown>,
) {
  return newFields.filter(({ field }) => !isApplicationFieldFilled(field, values[field]));
}
