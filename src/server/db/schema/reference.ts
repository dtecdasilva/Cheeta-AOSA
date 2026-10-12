import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, numeric, pgTable, smallint, text, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { ParamValue } from "../../../lib/admin/parameters";
import { id, recordStatus, timestamps, ts } from "./_shared";
import { users } from "./identity";

/**
 * Platform-wide configuration managed in the Administration portal:
 * parameter lists, countries, currencies, exchange rates and settings.
 */

/**
 * Every option list the platform runs on (institution types, regions,
 * towns, upload types, fee types, exam subjects, ...), one table keyed by
 * category, as src/lib/admin/parameters.ts models them. Category-specific
 * fields live in `attrs`; the field definitions per category stay in the
 * frontend's CATEGORY_DEFS so there's one description of each list.
 */
export const parameters = pgTable(
  "parameters",
  {
    id: id(),
    category: text("category").notNull(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    status: recordStatus(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Region for a town, town for a quarter, and so on. */
    parentId: text("parent_id").references((): AnyPgColumn => parameters.id),
    attrs: jsonb("attrs").$type<Record<string, ParamValue>>().notNull().default({}),
    ...timestamps,
  },
  (t) => [uniqueIndex("parameters_category_code_unique").on(t.category, t.code), index("parameters_parent_idx").on(t.parentId)]
);

/**
 * Countries offered on applicant forms (birth, nationality, residence,
 * where a school was). Applicant records store the country's name, so a
 * country in use is deactivated rather than deleted.
 */
export const countries = pgTable(
  "countries",
  {
    id: id(),
    name: text("name").notNull(),
    /** ISO 3166-1 alpha-2, e.g. "CM". */
    iso2: text("iso2").notNull(),
    /** ISO 3166-1 alpha-3, e.g. "CMR". Empty when not recorded. */
    iso3: text("iso3").notNull().default(""),
    /** International calling code, e.g. "+237". */
    dialCode: text("dial_code").notNull(),
    /** A WorldRegion key from src/lib/admin/reference.ts. */
    region: text("region").notNull(),
    /** ISO 4217 code of the country's currency; not required to be a platform currency. */
    currencyCode: text("currency_code").notNull().default(""),
    nationality: boolean("nationality").notNull().default(true),
    residence: boolean("residence").notNull().default(true),
    /** Position in pickers: lower first, then by name. */
    sortOrder: integer("sort_order").notNull().default(0),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("countries_iso2_unique").on(t.iso2),
    uniqueIndex("countries_name_unique").on(t.name),
    uniqueIndex("countries_iso3_unique").on(t.iso3).where(sql`${t.iso3} <> ''`),
    index("countries_sort_idx").on(t.sortOrder, t.name),
  ]
);

export const currencies = pgTable("currencies", {
  /** ISO 4217 code, also the primary key. */
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimalDigits: smallint("decimal_digits").notNull().default(2),
  symbolPosition: text("symbol_position", { enum: ["prefix", "suffix"] }).notNull().default("prefix"),
  displayToApplicants: boolean("display_to_applicants").notNull().default(true),
  status: recordStatus(),
  ...timestamps,
});

/**
 * Exchange rates between two currencies, with the period each applies to.
 *
 * Rates are a record of what was true and when, so they are never edited
 * or deleted: a new rate is a new row, and no other row is touched. A
 * rate entered by mistake is switched to INACTIVE (it stays in the
 * history, and is ignored when converting).
 *
 * The rate that applies at a moment is, of the pair's ACTIVE rows that
 * have started and not passed their own end date, the one that started
 * most recently.
 *
 * Three columns keep the names they had when every rate was against XAF
 * ("currency_code", "xaf_per_unit", "as_of"), so that existing rows carry
 * over untouched; in code they are `fromCurrency`, `rate` and `effectiveFrom`.
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: id(),
    /** The currency being priced. */
    fromCurrency: text("currency_code")
      .notNull()
      .references(() => currencies.code, { onDelete: "cascade" }),
    /** The currency it is priced in. */
    toCurrency: text("to_currency")
      .notNull()
      .default("XAF")
      .references(() => currencies.code, { onDelete: "cascade" }),
    /** How many units of `toCurrency` equal one unit of `fromCurrency`. */
    rate: numeric("xaf_per_unit", { precision: 18, scale: 6, mode: "number" }).notNull(),
    /** Where the figure comes from, e.g. "BEAC reference rate". */
    source: text("source").notNull(),
    /** When the rate starts to apply. */
    effectiveFrom: ts("as_of").notNull().defaultNow(),
    /** An end date given for the rate itself; null for "until a newer rate starts". */
    effectiveTo: ts("effective_to"),
    status: recordStatus(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("exchange_rates_currency_asof_idx").on(t.fromCurrency, t.effectiveFrom), index("exchange_rates_pair_idx").on(t.fromCurrency, t.toCurrency, t.effectiveFrom)]
);

/**
 * The exchange rate a financial transaction was worked out at, kept with
 * the transaction for good.
 *
 * A rate on record can be superseded the next day; a payment recorded
 * today must still read, in a year, exactly as it did when it was made.
 * So when a transaction involves a conversion, the figures are copied
 * here: the two currencies, the rate as applied, the amount converted and
 * the result, and which rate on record it came from. The transaction
 * points at its snapshot and is never worked out again from the live
 * rates.
 *
 * A snapshot is written once, when its transaction is recorded. Nothing
 * updates one and nothing deletes one.
 */
export const exchangeRateSnapshots = pgTable(
  "exchange_rate_snapshots",
  {
    id: id(),
    fromCurrency: text("from_currency").notNull(),
    toCurrency: text("to_currency").notNull(),
    /**
     * How many `toCurrency` one `fromCurrency` was worth, as applied:
     * `to_amount` is `from_amount` times this, rounded to the currency's
     * decimal places. Twelve decimal places, so a rate read the other way
     * round (1 XAF in USD) keeps its precision.
     */
    rate: numeric("rate", { precision: 24, scale: 12, mode: "number" }).notNull(),
    fromAmount: numeric("from_amount", { precision: 18, scale: 4, mode: "number" }).notNull(),
    toAmount: numeric("to_amount", { precision: 18, scale: 4, mode: "number" }).notNull(),
    /**
     * How the rate was arrived at from the rates on record: used as it
     * stands, read the other way round (1 / rate), or crossed through the
     * base currency (two rates).
     */
    derivation: text("derivation", { enum: ["direct", "inverse", "cross"] }).notNull(),
    /** The rate on record it came from. Kept so the source can be traced; the figures above stand on their own. */
    rateId: text("rate_id").references(() => exchangeRates.id),
    /** The second rate, when it was crossed through the base currency. */
    viaRateId: text("via_rate_id").references(() => exchangeRates.id),
    /** Where the rate on record said its figure came from, e.g. "BEAC reference rate". */
    source: text("source").notNull().default(""),
    /** When the rate on record started to apply. */
    rateEffectiveFrom: ts("rate_effective_from").notNull(),
    takenAt: ts("taken_at").notNull().defaultNow(),
  },
  (t) => [index("exchange_rate_snapshots_pair_idx").on(t.fromCurrency, t.toCurrency, t.takenAt)]
);

/**
 * Settings records ("system", "payment"), each stored whole as JSON, the
 * way src/lib/admin/settings.ts edits them. Their shape and defaults are
 * defined there.
 */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedBy: text("updated_by").references(() => users.id),
  ...timestamps,
});

/** School types and their qualifications, for the Education Information form. */
export const educationLevels = pgTable("education_levels", {
  id: id(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const educationQualifications = pgTable(
  "education_qualifications",
  {
    id: id(),
    educationLevelId: text("education_level_id")
      .notNull()
      .references(() => educationLevels.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
  },
  (t) => [uniqueIndex("education_qualifications_level_label_unique").on(t.educationLevelId, t.label)]
);

/**
 * Named counters for human-facing numbers (registration numbers,
 * application references). Incremented with UPDATE ... RETURNING inside the
 * caller's transaction, so concurrent requests never get the same number.
 */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});
