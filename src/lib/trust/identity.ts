/**
 * Trust & Identity — company tag gating and tier resolution.
 * See CITADEL_LAUNCH_VAULT/TRUST_IDENTITY_SPEC.md
 */

export type TrustTier =
  | "unverified"
  | "domain"
  | "work-email"
  | "kyc"
  | "sovereign";

export const RESERVED_BRANDS = [
  "GOOGLE",
  "META",
  "APPLE",
  "AMAZON",
  "MICROSOFT",
  "NETFLIX",
  "STRIPE",
  "OPENAI",
  "ANTHROPIC",
  "FACEBOOK",
  "INSTAGRAM",
  "TWITTER",
  "X",
  "TESLA",
  "NVIDIA",
  "ORACLE",
  "IBM",
  "SALESFORCE",
] as const;

export type ReservedBrand = (typeof RESERVED_BRANDS)[number];

export interface TrustProfileFields {
  company_tag?: string | null;
  domain_verified?: boolean | null;
  company_domain?: string | null;
  work_email_verified?: boolean | null;
  identity_verified?: boolean | null;
  sovereign_pending?: boolean | null;
  clearance_tier?: string | null;
  email?: string | null;
}

export function formatTagLabel(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith("[") ? trimmed : `[${trimmed}]`;
}

export function extractBrandFromTag(tag: string): string {
  const cleaned = tag.replace(/^\[|\]$/g, "").trim().toUpperCase();
  return cleaned.replace(/\s+SEC$/, "").split(/\s+/)[0] ?? cleaned;
}

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function brandMatchesDomain(brand: string, domain: string): boolean {
  const d = normalizeDomain(domain);
  const brandNorm = brand.trim().toLowerCase();
  const firstLabel = d.split(".")[0] ?? "";
  if (firstLabel === brandNorm) return true;
  if (d === `${brandNorm}.com`) return true;
  if (d.endsWith(`.${brandNorm}.com`)) return true;
  return d.includes(`.${brandNorm}.`);
}

export function isReservedBrand(brand: string): boolean {
  return RESERVED_BRANDS.includes(brand.toUpperCase() as ReservedBrand);
}

export function validateReservedTagForDomain(
  tag: string,
  domain: string,
): string | null {
  const brand = extractBrandFromTag(tag);
  if (!isReservedBrand(brand)) return null;
  if (!brandMatchesDomain(brand, domain)) {
    return `${brand} is a reserved tag — verify DNS on the official ${brand.toLowerCase()} corporate domain first.`;
  }
  return null;
}

export function companyTagFromDomain(domain: string): string {
  const cleaned = normalizeDomain(domain);
  const label = cleaned.split(".")[0]?.toUpperCase() ?? "CORP";
  return `${label} SEC`;
}

export function resolveVerifiedCompanyTag(
  profile: TrustProfileFields,
): string | null {
  if (!profile.domain_verified) return null;
  const tag = profile.company_tag?.trim();
  if (!tag) return null;
  if (profile.company_domain) {
    const reservedErr = validateReservedTagForDomain(tag, profile.company_domain);
    if (reservedErr) return null;
  }
  return tag;
}

export function resolveTrustTier(
  profile: TrustProfileFields,
  isSovereignBypass = false,
): TrustTier {
  if (
    isSovereignBypass ||
    profile.sovereign_pending ||
    profile.clearance_tier?.toUpperCase() === "SOVEREIGN"
  ) {
    return "sovereign";
  }
  if (profile.identity_verified) return "kyc";
  if (profile.domain_verified && profile.work_email_verified) return "work-email";
  if (profile.domain_verified) return "domain";
  return "unverified";
}

export function emailMatchesCompanyDomain(
  email: string,
  companyDomain: string,
): boolean {
  const e = email.trim().toLowerCase();
  const d = normalizeDomain(companyDomain);
  return e.endsWith(`@${d}`);
}

export type SelfTypedTagResult =
  | { ok: true; tag: string | null; previewUnverified?: string | null }
  | { ok: false; error: string; previewUnverified?: string | null };

export function validateSelfTypedCompanyTag(
  rawTag: string,
  profile: TrustProfileFields,
): SelfTypedTagResult {
  const tag = rawTag.trim().toUpperCase();
  if (!tag) return { ok: true, tag: null };

  if (profile.domain_verified) {
    return { ok: true, tag: resolveVerifiedCompanyTag(profile) };
  }

  const brand = extractBrandFromTag(tag);
  if (isReservedBrand(brand)) {
    const domain = profile.company_domain;
    if (!domain || !brandMatchesDomain(brand, domain)) {
      return {
        ok: false,
        error: `"${brand}" is reserved — verify corporate DNS on the official domain first.`,
        previewUnverified: tag,
      };
    }
  }

  return {
    ok: false,
    error:
      "Company tags require DNS domain verification. Verify your domain in Settings.",
    previewUnverified: tag,
  };
}
