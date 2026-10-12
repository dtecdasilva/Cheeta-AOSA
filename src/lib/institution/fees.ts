/**
 * The kinds of fee an institution can put on its schedule, and who each
 * applies to. Shared by the billing screens and the API that checks them.
 *
 * The web fee is deliberately absent: it is the platform's charge, set by
 * the Cheeta administrator, not something an institution schedules.
 */
export const FEE_TYPES = ["application", "tuition", "registration", "examination", "medical", "accommodation", "other"] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  application: "Application",
  tuition: "Tuition",
  registration: "Registration",
  examination: "Examination",
  medical: "Medical",
  accommodation: "Accommodation",
  other: "Other",
};

export const FEE_CATEGORIES = ["national", "international"] as const;
export type FeeCategory = (typeof FEE_CATEGORIES)[number];

export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  national: "National",
  international: "International",
};

/** A fee as the API returns it. */
export interface Fee {
  id: string;
  institutionId: string;
  name: string;
  type: FeeType;
  category: FeeCategory;
  currency: string;
  amount: number;
  /** First day the fee applies (YYYY-MM-DD). */
  effectiveDate: string;
  /** Last day it applies, or null for "until further notice". */
  effectiveTo: string | null;
  notes: string;
  status: "ACTIVE" | "INACTIVE";
  /** Where today falls relative to the fee's period. */
  period: "UPCOMING" | "CURRENT" | "ENDED";
}
