import { createCollection } from "./store";
import type { ParamStatus } from "./parameters";
import { COUNTRIES } from "@/lib/countries/data";
import { CURRENCIES, MOCK_EXCHANGE_RATES } from "@/lib/currency/data";

/**
 * Countries, currencies and exchange rates as the System section of the
 * Administration portal manages them. Seeded from the read-only lists in
 * src/lib/countries and src/lib/currency, which the student forms still
 * read today.
 */

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

export type WorldRegion = "CENTRAL_AFRICA" | "WEST_AFRICA" | "EAST_AFRICA" | "NORTH_AFRICA" | "SOUTHERN_AFRICA" | "EUROPE" | "AMERICAS" | "ASIA_MIDDLE_EAST" | "OTHER";

export const WORLD_REGION_LABELS: Record<WorldRegion, string> = {
  CENTRAL_AFRICA: "Central Africa",
  WEST_AFRICA: "West Africa",
  EAST_AFRICA: "East Africa",
  NORTH_AFRICA: "North Africa",
  SOUTHERN_AFRICA: "Southern Africa",
  EUROPE: "Europe",
  AMERICAS: "Americas",
  ASIA_MIDDLE_EAST: "Asia and Middle East",
  OTHER: "Other",
};

export interface AdminCountry {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2. */
  iso2: string;
  dialCode: string;
  region: WorldRegion;
  currencyCode: string;
  /** Offered in the Nationality field. */
  nationality: boolean;
  /** Offered in the Country of residence field. */
  residence: boolean;
  status: ParamStatus;
  updatedAt: string;
}

const COUNTRY_META: Record<string, [iso2: string, dial: string, region: WorldRegion, currency: string]> = {
  Cameroon: ["CM", "+237", "CENTRAL_AFRICA", "XAF"],
  Nigeria: ["NG", "+234", "WEST_AFRICA", "NGN"],
  Chad: ["TD", "+235", "CENTRAL_AFRICA", "XAF"],
  "Central African Republic": ["CF", "+236", "CENTRAL_AFRICA", "XAF"],
  "Equatorial Guinea": ["GQ", "+240", "CENTRAL_AFRICA", "XAF"],
  Gabon: ["GA", "+241", "CENTRAL_AFRICA", "XAF"],
  "Republic of the Congo": ["CG", "+242", "CENTRAL_AFRICA", "XAF"],
  "Democratic Republic of the Congo": ["CD", "+243", "CENTRAL_AFRICA", "CDF"],
  Benin: ["BJ", "+229", "WEST_AFRICA", "XOF"],
  Togo: ["TG", "+228", "WEST_AFRICA", "XOF"],
  Ghana: ["GH", "+233", "WEST_AFRICA", "GHS"],
  "Ivory Coast": ["CI", "+225", "WEST_AFRICA", "XOF"],
  Senegal: ["SN", "+221", "WEST_AFRICA", "XOF"],
  Mali: ["ML", "+223", "WEST_AFRICA", "XOF"],
  "Burkina Faso": ["BF", "+226", "WEST_AFRICA", "XOF"],
  Niger: ["NE", "+227", "WEST_AFRICA", "XOF"],
  Guinea: ["GN", "+224", "WEST_AFRICA", "GNF"],
  "Sierra Leone": ["SL", "+232", "WEST_AFRICA", "SLE"],
  Liberia: ["LR", "+231", "WEST_AFRICA", "LRD"],
  "The Gambia": ["GM", "+220", "WEST_AFRICA", "GMD"],
  "Guinea-Bissau": ["GW", "+245", "WEST_AFRICA", "XOF"],
  Mauritania: ["MR", "+222", "WEST_AFRICA", "MRU"],
  Morocco: ["MA", "+212", "NORTH_AFRICA", "MAD"],
  Algeria: ["DZ", "+213", "NORTH_AFRICA", "DZD"],
  Tunisia: ["TN", "+216", "NORTH_AFRICA", "TND"],
  Libya: ["LY", "+218", "NORTH_AFRICA", "LYD"],
  Egypt: ["EG", "+20", "NORTH_AFRICA", "EGP"],
  Sudan: ["SD", "+249", "NORTH_AFRICA", "SDG"],
  "South Sudan": ["SS", "+211", "EAST_AFRICA", "SSP"],
  Ethiopia: ["ET", "+251", "EAST_AFRICA", "ETB"],
  Eritrea: ["ER", "+291", "EAST_AFRICA", "ERN"],
  Somalia: ["SO", "+252", "EAST_AFRICA", "SOS"],
  Kenya: ["KE", "+254", "EAST_AFRICA", "KES"],
  Uganda: ["UG", "+256", "EAST_AFRICA", "UGX"],
  Rwanda: ["RW", "+250", "EAST_AFRICA", "RWF"],
  Burundi: ["BI", "+257", "EAST_AFRICA", "BIF"],
  Tanzania: ["TZ", "+255", "EAST_AFRICA", "TZS"],
  Zambia: ["ZM", "+260", "SOUTHERN_AFRICA", "ZMW"],
  Malawi: ["MW", "+265", "SOUTHERN_AFRICA", "MWK"],
  Mozambique: ["MZ", "+258", "SOUTHERN_AFRICA", "MZN"],
  Zimbabwe: ["ZW", "+263", "SOUTHERN_AFRICA", "ZWG"],
  Botswana: ["BW", "+267", "SOUTHERN_AFRICA", "BWP"],
  Namibia: ["NA", "+264", "SOUTHERN_AFRICA", "NAD"],
  "South Africa": ["ZA", "+27", "SOUTHERN_AFRICA", "ZAR"],
  Angola: ["AO", "+244", "SOUTHERN_AFRICA", "AOA"],
  Madagascar: ["MG", "+261", "SOUTHERN_AFRICA", "MGA"],
  "United States": ["US", "+1", "AMERICAS", "USD"],
  Canada: ["CA", "+1", "AMERICAS", "CAD"],
  "United Kingdom": ["GB", "+44", "EUROPE", "GBP"],
  France: ["FR", "+33", "EUROPE", "EUR"],
  Germany: ["DE", "+49", "EUROPE", "EUR"],
  Belgium: ["BE", "+32", "EUROPE", "EUR"],
  Switzerland: ["CH", "+41", "EUROPE", "CHF"],
  Italy: ["IT", "+39", "EUROPE", "EUR"],
  Spain: ["ES", "+34", "EUROPE", "EUR"],
  Portugal: ["PT", "+351", "EUROPE", "EUR"],
  Netherlands: ["NL", "+31", "EUROPE", "EUR"],
  Sweden: ["SE", "+46", "EUROPE", "SEK"],
  China: ["CN", "+86", "ASIA_MIDDLE_EAST", "CNY"],
  India: ["IN", "+91", "ASIA_MIDDLE_EAST", "INR"],
  "United Arab Emirates": ["AE", "+971", "ASIA_MIDDLE_EAST", "AED"],
  "Saudi Arabia": ["SA", "+966", "ASIA_MIDDLE_EAST", "SAR"],
  Qatar: ["QA", "+974", "ASIA_MIDDLE_EAST", "QAR"],
  Turkey: ["TR", "+90", "ASIA_MIDDLE_EAST", "TRY"],
  Lebanon: ["LB", "+961", "ASIA_MIDDLE_EAST", "LBP"],
  Brazil: ["BR", "+55", "AMERICAS", "BRL"],
};

export const countryStore = createCollection<AdminCountry>("countries", () =>
  COUNTRIES.filter((name) => name !== "Other").map((name) => {
    const [iso2, dialCode, region, currencyCode] = COUNTRY_META[name] ?? ["", "", "OTHER" as const, ""];
    return {
      id: `country-${iso2.toLowerCase() || name.toLowerCase().replace(/\W+/g, "-")}`,
      name,
      iso2,
      dialCode,
      region,
      currencyCode,
      nationality: true,
      residence: true,
      status: "ACTIVE" as const,
      updatedAt: "2026-01-01T09:00:00.000Z",
    };
  })
);

// ---------------------------------------------------------------------------
// Currencies
// ---------------------------------------------------------------------------

export const BASE_CURRENCY = "XAF";

export interface AdminCurrency {
  /** Same as `code`, so a currency can't be added twice. */
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalDigits: number;
  symbolPosition: "prefix" | "suffix";
  /** Applicants can choose it to view fees. */
  displayToApplicants: boolean;
  status: ParamStatus;
  updatedAt: string;
}

export const currencyStore = createCollection<AdminCurrency>("currencies", () =>
  CURRENCIES.map((c) => ({
    id: c.code,
    ...c,
    displayToApplicants: true,
    status: "ACTIVE" as const,
    updatedAt: "2026-01-01T09:00:00.000Z",
  }))
);

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

export interface AdminExchangeRate {
  /** Same as the currency code. */
  id: string;
  code: string;
  /** How many XAF equal one unit of `code`. */
  xafPerUnit: number;
  source: string;
  asOf: string;
  updatedBy: string;
}

export interface RateChange {
  id: string;
  code: string;
  from: number;
  to: number;
  at: string;
  by: string;
}

export const rateStore = createCollection<AdminExchangeRate>("exchange-rates", () =>
  MOCK_EXCHANGE_RATES.map((r) => ({
    id: r.code,
    code: r.code,
    xafPerUnit: r.xafPerUnit,
    source: r.code === "EUR" ? "Fixed peg (BEAC)" : "BEAC reference rate",
    asOf: `${r.asOf}T08:00:00.000Z`,
    updatedBy: "AOSA administrator",
  }))
);

export const rateHistoryStore = createCollection<RateChange>("exchange-rate-history", () => [
  { id: "rc-3", code: "USD", from: 604.2, to: 610.5, at: "2026-09-01T08:00:00.000Z", by: "AOSA administrator" },
  { id: "rc-2", code: "GBP", from: 762.9, to: 770.2, at: "2026-09-01T08:00:00.000Z", by: "AOSA administrator" },
  { id: "rc-1", code: "NGN", from: 0.41, to: 0.4, at: "2026-08-01T08:00:00.000Z", by: "AOSA administrator" },
]);
