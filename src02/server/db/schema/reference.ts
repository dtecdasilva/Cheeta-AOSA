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

export const countries = pgTable(
  "countries",
  {
    id: id(),
    name: text("name").notNull(),
    iso2: text("iso2").notNull(),
    dialCode: text("dial_code").notNull(),
    region: text("region").notNull(),
    currencyCode: text("currency_code").notNull().default(""),
    nationality: boolean("nationality").notNull().default(true),
    residence: boolean("residence").notNull().default(true),
    status: recordStatus(),
    ...timestamps,
  },
  (t) => [uniqueIndex("countries_iso2_unique").on(t.iso2), uniqueIndex("countries_name_unique").on(t.name)]
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
 * One row per rate change; the current rate for a currency is its latest
 * row. That gives the history the Exchange rates screen shows for free.
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: id(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code, { onDelete: "cascade" }),
    /** How many XAF (the base currency) equal one unit of the currency. */
    xafPerUnit: numeric("xaf_per_unit", { precision: 18, scale: 6, mode: "number" }).notNull(),
    source: text("source").notNull(),
    asOf: ts("as_of").notNull().defaultNow(),
    createdBy: text("created_by").references(() => users.id),
  },
  (t) => [index("exchange_rates_currency_asof_idx").on(t.currencyCode, t.asOf)]
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
