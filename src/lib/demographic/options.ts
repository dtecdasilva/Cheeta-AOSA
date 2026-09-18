/**
 * Canonical option lists for every dropdown on the demographic form.
 * Kept in one file, the same pattern already used for INSTITUTION_TYPES
 * (src/lib/data.ts) — a single source of truth that a future Admin
 * "Parameters" module can source from or override, rather than a value
 * baked separately into each place it's used.
 */

export const SEX_OPTIONS = ["Male", "Female"] as const;
export type Sex = (typeof SEX_OPTIONS)[number];

export const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed"] as const;
export type MaritalStatus = (typeof MARITAL_STATUS_OPTIONS)[number];

export const YES_NO_OPTIONS = ["Yes", "No"] as const;
export type YesNo = (typeof YES_NO_OPTIONS)[number];

export const RELIGION_OPTIONS = [
  "Christianity",
  "Islam",
  "Traditional / Indigenous",
  "Other",
  "Prefer not to say",
] as const;

export const LANGUAGE_OPTIONS = ["English", "French", "Bilingual (English & French)"] as const;

/** Cameroon's 10 regions, source of truth for the Division dropdown below. */
export const CAMEROON_REGIONS = [
  "Adamawa",
  "Centre",
  "East",
  "Far North",
  "Littoral",
  "North",
  "Northwest",
  "South",
  "Southwest",
  "West",
] as const;

/** Administrative divisions per region — the Division dropdown filters to
 * whichever region is currently selected. */
export const DIVISIONS_BY_REGION: Record<(typeof CAMEROON_REGIONS)[number], string[]> = {
  Adamawa: ["Djerem", "Faro-et-Déo", "Mayo-Banyo", "Mbéré", "Vina"],
  Centre: [
    "Haute-Sanaga",
    "Lekié",
    "Mbam-et-Inoubou",
    "Mbam-et-Kim",
    "Méfou-et-Afamba",
    "Méfou-et-Akono",
    "Mfoundi",
    "Nyong-et-Kellé",
    "Nyong-et-Mfoumou",
    "Nyong-et-So'o",
  ],
  East: ["Boumba-et-Ngoko", "Haut-Nyong", "Kadey", "Lom-et-Djérem"],
  "Far North": ["Diamaré", "Logone-et-Chari", "Mayo-Danay", "Mayo-Kani", "Mayo-Sava", "Mayo-Tsanaga"],
  Littoral: ["Moungo", "Nkam", "Sanaga-Maritime", "Wouri"],
  North: ["Bénoué", "Faro", "Mayo-Louti", "Mayo-Rey"],
  Northwest: ["Boyo", "Bui", "Donga-Mantung", "Menchum", "Mezam", "Momo", "Ngo-Ketunjia"],
  South: ["Dja-et-Lobo", "Mvila", "Océan", "Vallée-du-Ntem"],
  Southwest: ["Fako", "Koupé-Manengouba", "Lebialem", "Manyu", "Meme", "Ndian"],
  West: ["Bamboutos", "Haut-Nkam", "Hauts-Plateaux", "Koung-Khi", "Menoua", "Mifi", "Ndé", "Noun"],
};

/**
 * Country list for Country of Residence, Nationality, and Parent's Country
 * now lives in one shared place, not duplicated here: src/lib/countries/data.ts.
 * Re-exported under the same name so nothing else in this file (or
 * validation.ts, which imports COUNTRIES from here) has to change.
 */
export { COUNTRIES } from "@/lib/countries/data";
