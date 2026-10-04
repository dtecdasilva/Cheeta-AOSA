import "server-only";
import { z } from "zod";
import { CATEGORY_DEFS, type CategoryDef, type FieldDef } from "@/lib/admin/parameters";
import { BASE_CURRENCY } from "@/lib/admin/reference";
import { countries, currencies, parameters } from "@/server/db/schema";
import { ValidationError } from "@/server/http/errors";
import { parseWith, requiredText, text } from "@/server/http/validate";
import type { ResourceDef } from "@/server/modules/resource";
import { assertParam } from "@/server/modules/checks";

/**
 * Parameter lists, countries and currencies, as resources.
 */

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * Builds the validator for a category's `attrs` from the same field
 * definitions the admin parameter screens render (CATEGORY_DEFS), so a
 * list's rules are written once.
 */
function attrSchema(field: FieldDef): z.ZodType {
  const enter = { error: `Enter ${field.label.toLowerCase()}.` };
  switch (field.kind) {
    case "text":
      return field.required ? z.string(enter).trim().min(1, enter.error).max(500) : z.string().trim().max(500).default("");
    case "number": {
      let n = z.number(enter);
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return field.required ? n : n.optional();
    }
    case "boolean":
      return z.boolean(enter).default(false);
    case "select": {
      const values = field.options.map((o) => o.value) as [string, ...string[]];
      const choose = { error: `Choose ${field.label.toLowerCase()}.` };
      return field.required ? z.enum(values, choose) : z.enum(values, choose).optional();
    }
    case "list": {
      const addOne = `Add at least one ${field.noun?.[0] ?? "entry"}.`;
      const list = z.array(z.string().trim().min(1), { error: addOne }).max(500);
      return field.required ? list.min(1, addOne) : list.default([]);
    }
  }
}

function attrsSchemaFor(def: CategoryDef) {
  return z.object(Object.fromEntries(def.fields.map((f) => [f.key, attrSchema(f)])));
}

const categoryKeys = CATEGORY_DEFS.map((d) => d.key) as [string, ...string[]];

export const parameterResource: ResourceDef<z.ZodObject> = {
  name: "parameter",
  table: parameters,
  idColumn: parameters.id,
  // Same id format as the frontend's paramId(): "<category>:<code>".
  idFrom: (input) => `${input.category}:${input.code}`,
  create: z.object({
    category: z.enum(categoryKeys),
    code: requiredText(40).transform((v) => v.toUpperCase().replace(/\s+/g, "-")),
    label: requiredText(200),
    description: text(1000).default(""),
    sortOrder: z.number().int().min(0).max(100_000).default(0),
    parentId: text(200).nullable().optional(),
    attrs: z.record(z.string(), z.unknown()).default({}),
  }),
  // Category and code make up the id, so they're fixed once created.
  update: z.object({
    label: requiredText(200).optional(),
    description: text(1000).optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
    parentId: text(200).nullable().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
  searchColumns: [parameters.code, parameters.label, parameters.description],
  filters: { category: parameters.category, parentId: parameters.parentId },
  orderBy: [parameters.category, parameters.sortOrder, parameters.label],
  statusColumn: parameters.status,
  unique: { parameters_category_code_unique: "This code is already used in this list." },
  prepare(next) {
    const def = CATEGORY_DEFS.find((d) => d.key === next.category);
    if (!def) return next;
    try {
      return { ...next, attrs: parseWith(attrsSchemaFor(def), next.attrs ?? {}) };
    } catch (err) {
      // Report attribute errors as attrs.<field>, the way the form names them.
      if (err instanceof ValidationError) throw new ValidationError(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [`attrs.${k}`, v])));
      throw err;
    }
  },
  async check(db, next) {
    const def = CATEGORY_DEFS.find((d) => d.key === next.category)!;
    if (def.parent) {
      if (!next.parentId) throw new ValidationError({ parentId: `Choose the ${def.parent.label.toLowerCase()}.` });
      await assertParam(db, "parentId", next.parentId, def.parent.category);
    } else if (next.parentId) {
      throw new ValidationError({ parentId: "This list doesn't have a parent." });
    }
  },
};

// ---------------------------------------------------------------------------
// Countries and currencies
// ---------------------------------------------------------------------------

export const countryResource: ResourceDef<z.ZodObject> = {
  name: "country",
  table: countries,
  idColumn: countries.id,
  idFrom: (input) => `country-${String(input.iso2).toLowerCase()}`,
  create: z.object({
    name: requiredText(120),
    iso2: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use two letters, for example CM."),
    dialCode: z.string().trim().regex(/^\+\d{1,4}$/, "Use + followed by 1 to 4 digits, for example +237."),
    region: requiredText(40),
    currencyCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z]{3})?$/, "Use three letters, for example XAF.")
      .default(""),
    nationality: z.boolean().default(true),
    residence: z.boolean().default(true),
  }),
  searchColumns: [countries.name, countries.iso2, countries.dialCode],
  filters: { region: countries.region },
  orderBy: [countries.name],
  statusColumn: countries.status,
  unique: { countries_iso2_unique: "Another country already uses this code.", countries_name_unique: "This country is already on the list." },
};

export const currencyResource: ResourceDef<z.ZodObject> = {
  name: "currency",
  table: currencies,
  idColumn: currencies.code,
  idFrom: (input) => String(input.code),
  create: z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use three letters, for example USD."),
    name: requiredText(80),
    symbol: requiredText(8),
    decimalDigits: z.number().int().min(0).max(3),
    symbolPosition: z.enum(["prefix", "suffix"]),
    displayToApplicants: z.boolean().default(true),
  }),
  searchColumns: [currencies.code, currencies.name],
  orderBy: [currencies.code],
  statusColumn: currencies.status,
  unique: { currencies_pkey: "This currency is already on the list." },
  async check(_db, next, existing) {
    if (existing && existing.code === BASE_CURRENCY && next.status === "INACTIVE") throw new ValidationError({ status: "The base currency can't be deactivated." });
  },
};
