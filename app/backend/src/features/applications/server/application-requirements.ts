const INSTAGRAM_HANDLE_PATTERN = /^@?[A-Za-z0-9._]{1,30}$/;
const INSTAGRAM_URL_PATTERN = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/@?[A-Za-z0-9._]{1,30}\/?(?:[?#].*)?$/i;

// Business and Brand proof documents are checked with their other category files.
const PROOF_DOCUMENT_PACKAGES = new Set(["Professional", "Trainer"]);

const INSTAGRAM_FIELD_BY_PACKAGE: Record<string, string> = {
  Business: "businessInstagram",
  Brand: "brandInstagram",
};

function hasFiles(value: unknown, minimum: number) {
  return Array.isArray(value)
    && value.filter((item) => typeof item === "string" && item.trim()).length >= minimum;
}

/** Accepts an Instagram handle (`@name` or `name`) or a profile link. */
export function isInstagramProfile(value: unknown) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return INSTAGRAM_HANDLE_PATTERN.test(trimmed) || INSTAGRAM_URL_PATTERN.test(trimmed);
}

/**
 * Requirements every membership application must meet regardless of category.
 * Returns the first problem as an applicant-facing message, or null.
 */
export function validateApplicationRequirements(
  membershipPackage: string,
  payload: Record<string, unknown>,
) {
  const instagramField = INSTAGRAM_FIELD_BY_PACKAGE[membershipPackage] ?? "instagramLink";
  if (!isInstagramProfile(payload[instagramField])) {
    return "Instagram is required. Enter your Instagram handle or profile link.";
  }

  const profilePhotoField = membershipPackage === "Business" ? "businessProfilePhotoFiles" : "profilePhotoFiles";
  if (!hasFiles(payload[profilePhotoField], 1)) {
    return "A profile photo is required.";
  }

  if (PROOF_DOCUMENT_PACKAGES.has(membershipPackage) && !hasFiles(payload.credentialProofFiles, 1)) {
    return "Upload at least one proof document, such as a certificate, license, or proof of education.";
  }

  return null;
}

function humanizeApplicationField(field: string) {
  return field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

/**
 * Business and Brand applications carry their own required-field rules.
 * Returns the first problem as an applicant-facing message, or null.
 */
export function validateOrganizationApplication(
  membershipPackage: string,
  payload: Record<string, unknown>,
) {
  if (membershipPackage !== "Business" && membershipPackage !== "Brand") {
    return null;
  }

  const requiredText = (fields: string[]) => {
    const missing = fields.find((field) => typeof payload[field] !== "string" || !String(payload[field]).trim());
    return missing ? `${humanizeApplicationField(missing)} is required.` : null;
  };
  const requiredFiles = (field: string, minimum: number) => {
    const value = payload[field];
    return Array.isArray(value) && value.filter((item) => typeof item === "string" && item.trim()).length >= minimum
      ? null
      : `${humanizeApplicationField(field)} requires at least ${minimum} file${minimum === 1 ? "" : "s"}.`;
  };
  const requiredSelections = (field: string) => {
    const value = payload[field];
    return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim())
      ? null
      : `Select at least one ${humanizeApplicationField(field).toLowerCase()}.`;
  };
  const requiredAgreements = [
    "certifyTrue",
    "additionalDocumentationConsent",
    "agreeStandards",
    "understandReview",
    "privacyConsent",
  ];
  const missingAgreement = requiredAgreements.find((field) => payload[field] !== true);
  if (missingAgreement) {
    return `${humanizeApplicationField(missingAgreement)} must be accepted.`;
  }

  if (membershipPackage === "Business") {
    const textError = requiredText([
      "firstName", "lastName", "dateOfBirth", "country", "city", "phone", "email", "businessCurrentPosition",
      "yearsExperience", "professionalBiography", "professionalExperience", "professionalEducation", "professionalAchievements",
      "bizName", "bizType", "bizYear", "businessCountry", "businessCity", "businessAddress", "businessWebsite",
      "businessInstagram", "bizTeamSize", "businessDescription", "bizServices", "businessAchievements", "businessMission",
      "businessIndustryContribution", "businessMediaFeatured", "businessPublications", "businessSpeakingExperience",
      "businessJudgingExperience", "whyJoin", "contributionDesc",
    ]);
    if (textError) return textError;
    if (payload.businessCurrentPosition === "Other") {
      const error = requiredText(["businessCurrentPositionOther"]);
      if (error) return error;
    }
    if (payload.bizType === "Other") {
      const error = requiredText(["bizTypeOther"]);
      if (error) return error;
    }
    if (payload.businessMediaFeatured === "Yes") {
      const error = requiredText(["businessMediaDescription"]);
      if (error) return error;
    }
    return requiredFiles("businessProfilePhotoFiles", 1)
      || requiredFiles("businessProfessionalCertificationFiles", 1)
      || requiredFiles("businessSupportingDocumentFiles", 1)
      || requiredFiles("businessPortfolioImages", 5)
      || requiredFiles("businessClientTestimonialFiles", 5);
  }

  const textError = requiredText([
    "brandName", "brandType", "brandYear", "brandRegistrationCountry", "brandCity", "brandAddress", "brandWebsite",
    "brandInstagram", "brandSocialWebsite", "brandPrimaryContact", "brandContactPosition", "brandContactEmail", "brandContactPhone",
    "brandDescription", "brandMission", "brandValues", "brandProductsServices", "brandOperatingCountries", "brandEmployeeCount",
    "brandAchievements", "brandPublicationsYesNo", "brandExhibitionsYesNo", "brandIndustryContribution", "whyJoin",
  ]);
  if (textError) return textError;
  if (payload.brandType === "Other") {
    const error = requiredText(["brandTypeOther"]);
    if (error) return error;
  }
  if (payload.brandContactPosition === "Other") {
    const error = requiredText(["brandContactPositionOther"]);
    if (error) return error;
  }
  if (payload.brandPublicationsYesNo === "Yes") {
    const error = requiredText(["brandPublicationsDetails"]);
    if (error) return error;
  }
  if (payload.brandExhibitionsYesNo === "Yes") {
    const error = requiredText(["brandExhibitionsDetails"]);
    if (error) return error;
  }

  const selectionError = requiredSelections("brandProductCategories")
    || requiredSelections("brandCertifications")
    || requiredSelections("brandCooperationMethods")
    || requiredSelections("brandMemberBenefits");
  if (selectionError) return selectionError;
  if ((payload.brandProductCategories as unknown[]).includes("Other")) {
    const error = requiredText(["brandProductCategoryOther"]);
    if (error) return error;
  }
  if ((payload.brandCertifications as unknown[]).includes("Other")) {
    const error = requiredText(["brandCertificationOther"]);
    if (error) return error;
  }
  if ((payload.brandCooperationMethods as unknown[]).includes("Other")) {
    const error = requiredText(["brandCooperationOther"]);
    if (error) return error;
  }
  if ((payload.brandMemberBenefits as unknown[]).includes("Other")) {
    const error = requiredText(["brandMemberBenefitOther"]);
    if (error) return error;
  }

  return requiredFiles("brandReviewFiles", 5)
    || requiredFiles("brandProductFiles", 1)
    || requiredFiles("brandAchievementDocumentFiles", 5)
    || requiredFiles("brandSupportingDocumentFiles", 1);
}
