import { useMemo } from "react";
import { createCollection } from "./store";

/**
 * Admin-managed parameters: the option lists every form on the platform
 * draws from. Institution parameters (types, accrediting bodies, regions,
 * towns, quarters) feed the institution forms; examination parameters
 * (GCE subjects and grades, BAC/BEPC/Probatoire types, result types) feed
 * the student Examination and Results forms through
 * src/lib/examination/mockConfig.ts.
 *
 * All categories share one shape (ParamItem) so a single management
 * screen can handle add / edit / view / activate-deactivate for all of
 * them. Category-specific data lives in `attrs`, described by the
 * category's `fields`.
 */

export type ParamStatus = "ACTIVE" | "INACTIVE";
export type ParamValue = string | number | boolean | string[];

export type InstitutionParamCategory = "institution-types" | "accreditation-bodies";
export type LocationParamCategory = "regions" | "towns" | "quarters" | "sites";
export type ApplicationParamCategory =
  | "upload-types"
  | "qualification-types"
  | "fee-types"
  | "fee-categories"
  | "payment-method-types"
  | "academic-years"
  | "rejection-reasons"
  | "application-limits";
export type ExamParamCategory =
  | "examination-types"
  | "gce-ol-subjects"
  | "gce-ol-grades"
  | "gce-al-subjects"
  | "gce-al-grades"
  | "bac-types"
  | "bepc-types"
  | "probatoire-types"
  | "result-types";
export type ParamCategory = InstitutionParamCategory | LocationParamCategory | ApplicationParamCategory | ExamParamCategory;

export type ParamGroup = "institution" | "location" | "application" | "examination";

export interface ParamItem {
  id: string;
  category: ParamCategory;
  code: string;
  label: string;
  description: string;
  status: ParamStatus;
  order: number;
  /** For hierarchical categories: a town's region, a quarter's town. */
  parentId?: string;
  attrs: Record<string, ParamValue>;
  createdAt: string;
  updatedAt: string;
}

export type FieldDef =
  | { key: string; label: string; kind: "text"; hint?: string; required?: boolean }
  | { key: string; label: string; kind: "number"; hint?: string; required?: boolean; min?: number; max?: number; step?: number; format?: "currency" }
  | { key: string; label: string; kind: "boolean"; hint?: string; trueLabel: string; falseLabel: string }
  | { key: string; label: string; kind: "select"; hint?: string; required?: boolean; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "list"; hint?: string; required?: boolean; noun?: [singular: string, plural: string] };

export interface CategoryDef {
  key: ParamCategory;
  group: ParamGroup;
  title: string;
  singular: string;
  description: string;
  codeLabel: string;
  codeHint?: string;
  labelLabel: string;
  parent?: { category: ParamCategory; label: string };
  fields: FieldDef[];
  /** attrs keys shown as table columns. */
  columns: string[];
  /** Where this list shows up, told to the admin before they change it. */
  usedIn: string;
}

const SUBJECT_GROUPS = ["Core", "Science", "Arts", "Commercial", "Technical"].map((v) => ({ value: v, label: v }));

const subjectFields: FieldDef[] = [
  { key: "group", label: "Subject group", kind: "select", options: SUBJECT_GROUPS, required: true },
];

const gradeFields: FieldDef[] = [
  { key: "points", label: "Points", kind: "number", min: 0, max: 10, required: true, hint: "Used when institutions rank applicants." },
  { key: "passing", label: "Counts as", kind: "boolean", trueLabel: "Pass", falseLabel: "Fail" },
];

const seriesFields: FieldDef[] = [
  { key: "subjects", label: "Subjects", kind: "list", required: true, noun: ["subject", "subjects"], hint: "One subject per line. These are the subjects applicants can enter for this type." },
  { key: "maxScore", label: "Maximum score", kind: "number", min: 1, max: 100, required: true },
  { key: "passMark", label: "Pass mark", kind: "number", min: 0, max: 100, step: 0.5, required: true },
  { key: "maxSittings", label: "Maximum sittings", kind: "number", min: 1, max: 5, required: true },
];

export const CATEGORY_DEFS: CategoryDef[] = [
  // ---- Institution parameters -------------------------------------------
  {
    key: "institution-types",
    group: "institution",
    title: "Institution types",
    singular: "institution type",
    description: "The kinds of institution applicants can apply to.",
    codeLabel: "Code",
    labelLabel: "Type name",
    fields: [
      { key: "maxProgramChoices", label: "Program choices allowed", kind: "number", min: 1, max: 5, required: true, hint: "How many study programs an applicant can rank at one institution of this type." },
    ],
    columns: ["maxProgramChoices"],
    usedIn: "Institution forms and the institution list filters.",
  },
  {
    key: "accreditation-bodies",
    group: "institution",
    title: "Accrediting bodies",
    singular: "accrediting body",
    description: "Ministries and agencies that accredit institutions.",
    codeLabel: "Abbreviation",
    labelLabel: "Full name",
    fields: [],
    columns: [],
    usedIn: "The “Accredited by” field on institution forms.",
  },
  {
    key: "regions",
    group: "location",
    title: "Regions",
    singular: "region",
    description: "Administrative regions. Towns belong to a region.",
    codeLabel: "Code",
    labelLabel: "Region name",
    fields: [],
    columns: [],
    usedIn: "Institution and student forms, and region filters across the portal.",
  },
  {
    key: "towns",
    group: "location",
    title: "Towns",
    singular: "town",
    description: "Towns and cities, each within a region. Quarters and sites belong to a town.",
    codeLabel: "Code",
    labelLabel: "Town name",
    parent: { category: "regions", label: "Region" },
    fields: [],
    columns: [],
    usedIn: "Institution and student forms, filtered by the region chosen.",
  },
  {
    key: "quarters",
    group: "location",
    title: "Quarters",
    singular: "quarter",
    description: "Neighbourhoods within a town. Institution addresses use them.",
    codeLabel: "Code",
    labelLabel: "Quarter name",
    parent: { category: "towns", label: "Town" },
    fields: [],
    columns: [],
    usedIn: "Institution forms, filtered by the town chosen.",
  },

  {
    key: "sites",
    group: "location",
    title: "Sites",
    singular: "site",
    description: "Physical places applicants deal with: examination centres, document drop-off points, payment points and campuses.",
    codeLabel: "Site code",
    codeHint: "Short and unique, for example DLA-EXC-01.",
    labelLabel: "Site name",
    parent: { category: "towns", label: "Town" },
    fields: [
      {
        key: "siteType",
        label: "Site type",
        kind: "select",
        required: true,
        options: [
          { value: "exam-centre", label: "Examination centre" },
          { value: "drop-off", label: "Document drop-off point" },
          { value: "payment-point", label: "Payment point" },
          { value: "campus", label: "Campus" },
        ],
      },
      { key: "address", label: "Street address", kind: "text", required: true },
      { key: "capacity", label: "Capacity", kind: "number", min: 0, max: 20000, hint: "Seats or visitors per day. Leave 0 if it doesn't apply." },
      { key: "phone", label: "Contact phone", kind: "text" },
    ],
    columns: ["siteType", "capacity"],
    usedIn: "Site pickers on application and tuition screens, filtered by region and town.",
  },

  // ---- Application parameters ------------------------------------------
  {
    key: "upload-types",
    group: "application",
    title: "Upload types",
    singular: "upload type",
    description: "Documents applicants can be asked to upload. Institutions pick from this list when they set their upload requirements.",
    codeLabel: "Code",
    labelLabel: "Document name",
    fields: [
      { key: "formats", label: "Accepted formats", kind: "list", required: true, hint: "One file extension per line, for example PDF." },
      { key: "maxSizeMb", label: "Maximum size (MB)", kind: "number", min: 0.5, max: 25, step: 0.5, required: true },
      { key: "certified", label: "Copy required", kind: "boolean", trueLabel: "Certified copy", falseLabel: "Plain copy" },
    ],
    columns: ["formats", "maxSizeMb", "certified"],
    usedIn: "Institution upload requirements and the student upload step.",
  },
  {
    key: "qualification-types",
    group: "application",
    title: "Qualification types",
    singular: "qualification type",
    description: "The awards study programs lead to. Institutions choose one for each program they offer.",
    codeLabel: "Code",
    labelLabel: "Qualification name",
    fields: [
      {
        key: "level",
        label: "Level",
        kind: "select",
        required: true,
        options: [
          { value: "secondary", label: "Secondary" },
          { value: "certificate", label: "Certificate" },
          { value: "diploma", label: "Diploma" },
          { value: "bachelor", label: "Bachelor" },
          { value: "master", label: "Master" },
          { value: "doctorate", label: "Doctorate" },
        ],
      },
      { key: "durationYears", label: "Typical duration (years)", kind: "number", min: 0.5, max: 8, step: 0.5, required: true },
      { key: "entryRequirement", label: "Minimum entry qualification", kind: "text", hint: "Shown to applicants, for example “GCE A/L (2 papers) or BAC”." },
    ],
    columns: ["level", "durationYears"],
    usedIn: "Program setup in the institution portal and program filters for applicants.",
  },
  {
    key: "fee-types",
    group: "application",
    title: "Fee types",
    singular: "fee type",
    description: "The kinds of fee institutions can charge. Each institution sets its own amounts per fee category.",
    codeLabel: "Code",
    labelLabel: "Fee name",
    fields: [
      {
        key: "basis",
        label: "Charged",
        kind: "select",
        required: true,
        options: [
          { value: "per-application", label: "Once per application" },
          { value: "per-institution", label: "Per institution applied to" },
          { value: "per-year", label: "Per academic year" },
          { value: "one-off", label: "Once, after admission" },
        ],
      },
      { key: "defaultAmount", label: "Suggested amount (XAF)", kind: "number", format: "currency", min: 0, max: 10000000, step: 500, required: true, hint: "Pre-filled when an institution sets up this fee." },
      { key: "refundable", label: "Refunds", kind: "boolean", trueLabel: "Refundable", falseLabel: "Non-refundable" },
    ],
    columns: ["basis", "defaultAmount", "refundable"],
    usedIn: "Institution billing configuration, student fee summaries and tuition verification.",
  },
  {
    key: "fee-categories",
    group: "application",
    title: "Fee categories",
    singular: "fee category",
    description: "National and international pricing groups. An applicant's nationality decides which one applies.",
    codeLabel: "Code",
    labelLabel: "Category name",
    fields: [
      { key: "appliesTo", label: "Applies to", kind: "text", required: true, hint: "Who falls into this category, in plain words." },
      { key: "multiplier", label: "Default multiplier", kind: "number", min: 0.1, max: 10, step: 0.1, required: true, hint: "Applied to a fee type's suggested amount. National is 1." },
      {
        key: "currency",
        label: "Billing currency",
        kind: "select",
        required: true,
        options: [
          { value: "XAF", label: "XAF — Central African CFA franc" },
          { value: "EUR", label: "EUR — Euro" },
          { value: "USD", label: "USD — US dollar" },
        ],
      },
    ],
    columns: ["multiplier", "currency"],
    usedIn: "Institution billing configuration and the tuition amount shown to admitted students.",
  },
  {
    key: "payment-method-types",
    group: "application",
    title: "Payment method types",
    singular: "payment method type",
    description: "Ways applicants and students can pay. Institutions switch on the ones they accept and add their account details.",
    codeLabel: "Code",
    labelLabel: "Method name",
    fields: [
      {
        key: "channel",
        label: "Channel",
        kind: "select",
        required: true,
        options: [
          { value: "mobile", label: "Mobile money" },
          { value: "bank", label: "Bank" },
          { value: "wallet", label: "Debit wallet" },
          { value: "transfer", label: "Money transfer" },
          { value: "card", label: "Card" },
          { value: "cash", label: "Cash at a payment point" },
        ],
      },
      { key: "referenceLabel", label: "Reference label", kind: "text", required: true, hint: "What the payer is asked for, for example “Transaction ID”." },
      { key: "clearanceDays", label: "Days to clear", kind: "number", min: 0, max: 30, required: true, hint: "How long before a payment can be verified." },
      { key: "tuition", label: "Tuition payments", kind: "boolean", trueLabel: "Accepted for tuition", falseLabel: "Application fees only" },
    ],
    columns: ["channel", "clearanceDays", "tuition"],
    usedIn: "Institution payment methods, the student payment screens and tuition payment records.",
  },
  {
    key: "academic-years",
    group: "application",
    title: "Academic years",
    singular: "academic year",
    description: "The years applicants apply for. Only one should be open for applications at a time.",
    codeLabel: "Code",
    codeHint: "For example 2026-2027.",
    labelLabel: "Display name",
    fields: [
      { key: "opensOn", label: "Applications open", kind: "text", required: true, hint: "Date as YYYY-MM-DD." },
      { key: "closesOn", label: "Applications close", kind: "text", required: true, hint: "Date as YYYY-MM-DD." },
      { key: "current", label: "Intake", kind: "boolean", trueLabel: "Current intake", falseLabel: "Not current" },
    ],
    columns: ["opensOn", "closesOn", "current"],
    usedIn: "New applications, application filters and tuition accounts.",
  },
  {
    key: "rejection-reasons",
    group: "application",
    title: "Rejection reasons",
    singular: "rejection reason",
    description: "Standard reasons reviewers choose from when they reject an application, a document or a payment.",
    codeLabel: "Code",
    labelLabel: "Reason shown to the applicant",
    fields: [
      {
        key: "appliesTo",
        label: "Used for",
        kind: "select",
        required: true,
        options: [
          { value: "application", label: "Applications" },
          { value: "upload", label: "Uploaded documents" },
          { value: "payment", label: "Payments and tuition" },
        ],
      },
      { key: "resubmit", label: "Applicant can", kind: "boolean", trueLabel: "Correct and resubmit", falseLabel: "Not resubmit" },
    ],
    columns: ["appliesTo", "resubmit"],
    usedIn: "Reject dialogs in the institution portal and tuition verification, and rejection notifications.",
  },
  {
    key: "application-limits",
    group: "application",
    title: "Application limits",
    singular: "application limit",
    description: "Platform-wide numbers that shape the application process.",
    codeLabel: "Setting key",
    labelLabel: "Setting",
    fields: [
      { key: "value", label: "Value", kind: "number", min: 0, max: 1000, required: true },
      { key: "unit", label: "Unit", kind: "text", required: true, hint: "For example “institutions” or “days”." },
    ],
    columns: ["value", "unit"],
    usedIn: "Student application steps and resubmission deadlines.",
  },

  // ---- Examination parameters ------------------------------------------
  {
    key: "examination-types",
    group: "examination",
    title: "Examination types",
    singular: "examination type",
    description:
      "The examinations applicants can record: GCE Ordinary and Advanced Level, BEPC, Probatoire and Baccalauréat. Rename one, switch it off, or set how many sittings it allows. Each one's subjects, grades and types are in the lists below.",
    codeLabel: "Code",
    labelLabel: "Name",
    fields: [
      { key: "defaultSittings", label: "Sittings to start with", kind: "number", min: 1, max: 5, required: true, hint: "How many sittings the form opens with." },
      {
        key: "maxSittings",
        label: "Maximum sittings",
        kind: "number",
        min: 1,
        max: 5,
        required: true,
        hint: "For BAC, BEPC and Probatoire, the limit set on each type applies; this is used where a type sets none.",
      },
    ],
    columns: ["defaultSittings", "maxSittings"],
    usedIn: "Student Examinations and Results forms. The codes are fixed: GCE_OL, GCE_AL, BEPC, PROBATOIRE and BAC.",
  },
  {
    key: "gce-ol-subjects",
    group: "examination",
    title: "GCE O/L subjects",
    singular: "O/L subject",
    description: "Subjects applicants can enter for the GCE Ordinary Level.",
    codeLabel: "Subject code",
    labelLabel: "Subject name",
    fields: subjectFields,
    columns: ["group"],
    usedIn: "Student Examinations and Results forms, when GCE Ordinary Level is chosen.",
  },
  {
    key: "gce-ol-grades",
    group: "examination",
    title: "GCE O/L grades",
    singular: "O/L grade",
    description: "Grades awarded at GCE Ordinary Level and whether each counts as a pass.",
    codeLabel: "Grade",
    labelLabel: "Description",
    fields: gradeFields,
    columns: ["points", "passing"],
    usedIn: "Grade choices and the pass/fail result on the student Results form.",
  },
  {
    key: "gce-al-subjects",
    group: "examination",
    title: "GCE A/L subjects",
    singular: "A/L subject",
    description: "Subjects applicants can enter for the GCE Advanced Level.",
    codeLabel: "Subject code",
    labelLabel: "Subject name",
    fields: subjectFields,
    columns: ["group"],
    usedIn: "Student Examinations and Results forms, when GCE Advanced Level is chosen.",
  },
  {
    key: "gce-al-grades",
    group: "examination",
    title: "GCE A/L grades",
    singular: "A/L grade",
    description: "Grades awarded at GCE Advanced Level and whether each counts as a pass.",
    codeLabel: "Grade",
    labelLabel: "Description",
    fields: gradeFields,
    columns: ["points", "passing"],
    usedIn: "Grade choices and the pass/fail result on the student Results form.",
  },
  {
    key: "bac-types",
    group: "examination",
    title: "BAC types",
    singular: "BAC type",
    description: "Baccalauréat series, each with its own subjects and scoring.",
    codeLabel: "Series",
    labelLabel: "Name",
    fields: seriesFields,
    columns: ["subjects", "passMark"],
    usedIn: "The qualification list on student forms. Each active type appears as its own option.",
  },
  {
    key: "bepc-types",
    group: "examination",
    title: "BEPC types",
    singular: "BEPC type",
    description: "BEPC variants, each with its own subjects and scoring.",
    codeLabel: "Code",
    labelLabel: "Name",
    fields: seriesFields,
    columns: ["subjects", "passMark"],
    usedIn: "The qualification list on student forms. Each active type appears as its own option.",
  },
  {
    key: "probatoire-types",
    group: "examination",
    title: "Probatoire types",
    singular: "Probatoire type",
    description: "Probatoire series, each with its own subjects and scoring.",
    codeLabel: "Series",
    labelLabel: "Name",
    fields: seriesFields,
    columns: ["subjects", "passMark"],
    usedIn: "The qualification list on student forms. Each active type appears as its own option.",
  },
  {
    key: "result-types",
    group: "examination",
    title: "Result types",
    singular: "result type",
    description: "The outcomes a subject result can have.",
    codeLabel: "Code",
    labelLabel: "Label",
    fields: [
      {
        key: "meaning",
        label: "Meaning",
        kind: "select",
        required: true,
        hint: "Pass and Fail are worked out from the grade or score. Not graded results are chosen by the applicant.",
        options: [
          { value: "pass", label: "Pass" },
          { value: "fail", label: "Fail" },
          { value: "not-graded", label: "Not graded" },
        ],
      },
    ],
    columns: ["meaning"],
    usedIn: "The Result column on the student Results form.",
  },
];

export function getCategoryDef(key: string): CategoryDef | undefined {
  return CATEGORY_DEFS.find((c) => c.key === key);
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const SEED_AT = "2026-01-12T08:00:00.000Z";

export function paramId(category: ParamCategory, code: string) {
  return `${category}:${code}`;
}

function seedParameters(): ParamItem[] {
  const out: ParamItem[] = [];
  const counters: Partial<Record<ParamCategory, number>> = {};
  function p(
    category: ParamCategory,
    code: string,
    label: string,
    opts: { attrs?: Record<string, ParamValue>; parent?: string; inactive?: boolean; description?: string } = {}
  ) {
    counters[category] = (counters[category] ?? 0) + 1;
    out.push({
      id: paramId(category, code),
      category,
      code,
      label,
      description: opts.description ?? "",
      status: opts.inactive ? "INACTIVE" : "ACTIVE",
      order: counters[category]!,
      parentId: opts.parent,
      attrs: opts.attrs ?? {},
      createdAt: SEED_AT,
      updatedAt: SEED_AT,
    });
  }

  // Institution types — labels match INSTITUTION_TYPES in src/lib/data.ts.
  p("institution-types", "UNI", "University", { attrs: { maxProgramChoices: 3 } });
  p("institution-types", "HS", "High School", { attrs: { maxProgramChoices: 1 } });
  p("institution-types", "SS", "Secondary School", { attrs: { maxProgramChoices: 1 } });
  p("institution-types", "VOC", "Vocational School", { attrs: { maxProgramChoices: 2 } });
  p("institution-types", "PRO", "Professional School", { attrs: { maxProgramChoices: 1 } });

  p("accreditation-bodies", "MINESUP", "Ministry of Higher Education");
  p("accreditation-bodies", "MINESEC", "Ministry of Secondary Education");
  p("accreditation-bodies", "MINEFOP", "Ministry of Employment and Vocational Training");
  p("accreditation-bodies", "MINSANTE", "Ministry of Public Health");
  p("accreditation-bodies", "MINEDUB", "Ministry of Basic Education", {
    inactive: true,
    description: "Primary schools are not on the platform yet.",
  });

  const regions: [string, string][] = [
    ["AD", "Adamawa"], ["CE", "Centre"], ["ES", "East"], ["EN", "Far North"], ["LT", "Littoral"],
    ["NO", "North"], ["NW", "Northwest"], ["SU", "South"], ["SW", "Southwest"], ["WE", "West"],
  ];
  regions.forEach(([c, l]) => p("regions", c, l));

  const towns: [string, string, string][] = [
    ["YDE", "Yaoundé", "CE"], ["MBM", "Mbalmayo", "CE"], ["DLA", "Douala", "LT"], ["NKS", "Nkongsamba", "LT"],
    ["EDE", "Edéa", "LT"], ["BDA", "Bamenda", "NW"], ["KBO", "Kumbo", "NW"], ["BUE", "Buea", "SW"],
    ["LMB", "Limbe", "SW"], ["KBA", "Kumba", "SW"], ["BFM", "Bafoussam", "WE"], ["DSC", "Dschang", "WE"],
    ["NGD", "Ngaoundéré", "AD"], ["BTA", "Bertoua", "ES"], ["MRA", "Maroua", "EN"], ["GOU", "Garoua", "NO"],
    ["EBW", "Ebolowa", "SU"], ["KRI", "Kribi", "SU"],
  ];
  towns.forEach(([c, l, r]) => p("towns", c, l, { parent: paramId("regions", r) }));

  const quarters: Record<string, string[]> = {
    YDE: ["Bastos", "Mvolyé", "Ngoa-Ekellé", "Melen", "Essos", "Biyem-Assi"],
    DLA: ["Bonanjo", "Akwa", "Bonamoussadi", "Makepe", "Ndokoti"],
    BDA: ["Nkwen", "Up Station", "Commercial Avenue"],
    BUE: ["Molyko", "Great Soppo", "Bonduma"],
    LMB: ["Down Beach", "Mile 4"],
    KBA: ["Fiango"],
    BFM: ["Tamdja", "Kouogouo"],
    DSC: ["Foto", "Foréké"],
    NGD: ["Dang", "Joli Soir"],
    MRA: ["Domayo", "Kakataré"],
    GOU: ["Roumdé Adjia", "Plateau"],
    EBW: ["Nko'ovos"],
    KRI: ["Mpangou", "Ngoyé"],
    NKS: ["Quartier Administratif"],
    BTA: ["Nkolbikon"],
  };
  Object.entries(quarters).forEach(([town, names]) =>
    names.forEach((name, i) => {
      p("quarters", `${town}-${String(i + 1).padStart(2, "0")}`, name, { parent: paramId("towns", town) });
    })
  );


  // Sites — each belongs to a town.
  const sites: [string, string, string, string, string, number, string, boolean?][] = [
    ["YDE-EXC-01", "Lycée Général Leclerc examination centre", "YDE", "exam-centre", "Avenue Kennedy, Centre-ville", 1200, "+237 222 23 14 10"],
    ["YDE-DRP-01", "AOSA service desk Ngoa-Ekellé", "YDE", "drop-off", "Rue de l'Université, Ngoa-Ekellé", 300, "+237 222 20 45 61"],
    ["YDE-PAY-01", "Campus bank agency Mvolyé", "YDE", "payment-point", "Carrefour Mvolyé", 0, "+237 222 31 76 02"],
    ["YDE-CMP-01", "Mont Fébé University main campus", "YDE", "campus", "Mont Fébé road, Bastos", 8000, "+237 222 21 08 33"],
    ["DLA-EXC-01", "Lycée Joss examination centre", "DLA", "exam-centre", "Boulevard de la Liberté, Bonanjo", 1500, "+237 233 42 18 90"],
    ["DLA-DRP-01", "AOSA service desk Akwa", "DLA", "drop-off", "Rue Joffre, Akwa", 400, "+237 233 43 22 71"],
    ["DLA-PAY-01", "Mobile money point Ndokoti", "DLA", "payment-point", "Carrefour Ndokoti", 0, "+237 677 10 44 20"],
    ["BUE-EXC-01", "GHS Molyko examination centre", "BUE", "exam-centre", "Molyko main road", 900, "+237 233 32 21 05"],
    ["BUE-CMP-01", "Buea campus", "BUE", "campus", "Great Soppo", 6000, "+237 233 32 25 60"],
    ["BDA-DRP-01", "AOSA service desk Commercial Avenue", "BDA", "drop-off", "Commercial Avenue", 250, "+237 233 36 14 88"],
    ["BFM-EXC-01", "Lycée Classique examination centre", "BFM", "exam-centre", "Quartier Tamdja", 1000, "+237 233 44 12 07"],
    ["NGD-PAY-01", "Bank agency Dang", "NGD", "payment-point", "Route de Dang", 0, "+237 222 25 15 93"],
    ["GOU-EXC-01", "Lycée de Garoua examination centre", "GOU", "exam-centre", "Plateau", 800, "+237 222 27 11 40", true],
  ];
  sites.forEach(([c, l, town, type, address, capacity, phone, inactive]) =>
    p("sites", c, l, { parent: paramId("towns", town), attrs: { siteType: type, address, capacity, phone }, inactive })
  );

  // ---- Application parameters
  const upload: [string, string, string[], number, boolean, boolean?][] = [
    ["BIRTH", "Birth certificate", ["PDF", "JPG", "PNG"], 2, true],
    ["NID", "National identity card", ["PDF", "JPG", "PNG"], 2, false],
    ["PASSPORT", "Passport (international applicants)", ["PDF", "JPG"], 2, false],
    ["PHOTO", "Passport photograph", ["JPG", "PNG"], 1, false],
    ["GCE-OL", "GCE O/L certificate or result slip", ["PDF", "JPG"], 3, true],
    ["GCE-AL", "GCE A/L certificate or result slip", ["PDF", "JPG"], 3, true],
    ["BAC", "Baccalauréat certificate or relevé de notes", ["PDF", "JPG"], 3, true],
    ["PROB", "Probatoire certificate", ["PDF", "JPG"], 3, true],
    ["BEPC", "BEPC certificate", ["PDF", "JPG"], 3, true],
    ["TRANS", "Academic transcript", ["PDF"], 5, true],
    ["MED", "Medical certificate", ["PDF", "JPG"], 2, false],
    ["PAYSLIP", "Payment receipt or bank slip", ["PDF", "JPG", "PNG"], 2, false],
    ["RECO", "Recommendation letter", ["PDF"], 2, false, true],
  ];
  upload.forEach(([c, l, formats, maxSizeMb, certified, inactive]) => p("upload-types", c, l, { attrs: { formats, maxSizeMb, certified }, inactive }));

  const quals: [string, string, string, number, string, boolean?][] = [
    ["BSC", "Bachelor of Science", "bachelor", 3, "GCE A/L (2 papers) or BAC"],
    ["BA", "Bachelor of Arts", "bachelor", 3, "GCE A/L (2 papers) or BAC"],
    ["BCOM", "Bachelor of Commerce", "bachelor", 3, "GCE A/L (2 papers) or BAC"],
    ["HND", "Higher National Diploma", "diploma", 2, "GCE A/L (1 paper) or BAC"],
    ["BTS", "Brevet de Technicien Supérieur", "diploma", 2, "BAC or GCE A/L"],
    ["MSC", "Master of Science", "master", 2, "Bachelor's degree"],
    ["MBA", "Master of Business Administration", "master", 2, "Bachelor's degree and 2 years' work"],
    ["PHD", "Doctor of Philosophy", "doctorate", 4, "Master's degree"],
    ["CAP", "Certificat d'Aptitude Professionnelle", "certificate", 2, "BEPC or GCE O/L"],
    ["HSD", "High school diploma", "secondary", 2, "GCE O/L (4 papers) or BEPC"],
    ["DEUG", "Diplôme d'Études Universitaires Générales", "diploma", 2, "BAC", true],
  ];
  quals.forEach(([c, l, level, durationYears, entryRequirement, inactive]) => p("qualification-types", c, l, { attrs: { level, durationYears, entryRequirement }, inactive }));

  const fees: [string, string, string, number, boolean, boolean?][] = [
    ["APP", "Application fee", "per-institution", 15000, false],
    ["WEB", "Web processing fee", "per-application", 2500, false],
    ["ENT", "Entrance examination fee", "per-institution", 20000, false],
    ["TUI", "Tuition fee", "per-year", 450000, true],
    ["REG", "Registration fee", "one-off", 50000, false],
    ["MED", "Medical examination fee", "one-off", 10000, false],
    ["LATE", "Late application surcharge", "per-application", 5000, false, true],
  ];
  fees.forEach(([c, l, basis, defaultAmount, refundable, inactive]) => p("fee-types", c, l, { attrs: { basis, defaultAmount, refundable }, inactive }));

  p("fee-categories", "NAT", "National", { attrs: { appliesTo: "Cameroonian nationals", multiplier: 1, currency: "XAF" } });
  p("fee-categories", "CEMAC", "CEMAC", { attrs: { appliesTo: "Nationals of other CEMAC member states", multiplier: 1.25, currency: "XAF" } });
  p("fee-categories", "INT", "International", { attrs: { appliesTo: "All other nationalities", multiplier: 2, currency: "XAF" } });

  const methods: [string, string, string, string, number, boolean, boolean?][] = [
    ["MTN-MOMO", "MTN Mobile Money", "mobile", "Transaction ID", 0, true],
    ["ORANGE-MONEY", "Orange Money", "mobile", "Transaction ID", 0, true],
    ["BANK", "Bank deposit or transfer", "bank", "Bank slip number", 2, true],
    ["WALLET", "Debit wallet", "wallet", "Wallet reference", 0, false],
    ["TRANSFER", "Money transfer (Express Union, Western Union)", "transfer", "Transfer code (MTCN)", 1, true],
    ["CASH", "Cash at a payment point", "cash", "Receipt number", 1, true],
    ["CARD", "Visa or Mastercard", "card", "Authorisation code", 3, false, true],
  ];
  methods.forEach(([c, l, channel, referenceLabel, clearanceDays, tuition, inactive]) => p("payment-method-types", c, l, { attrs: { channel, referenceLabel, clearanceDays, tuition }, inactive }));

  p("academic-years", "2025-2026", "2025/2026", { attrs: { opensOn: "2025-02-01", closesOn: "2025-09-30", current: false }, inactive: true });
  p("academic-years", "2026-2027", "2026/2027", { attrs: { opensOn: "2026-02-01", closesOn: "2026-10-31", current: true } });
  p("academic-years", "2027-2028", "2027/2028", { attrs: { opensOn: "2027-02-01", closesOn: "2027-09-30", current: false }, inactive: true, description: "Opens once the 2026/2027 intake closes." });

  const reasons: [string, string, string, boolean][] = [
    ["APP-INCOMPLETE", "Required information is missing from the application", "application", true],
    ["APP-NOT-ELIGIBLE", "The applicant does not meet the entry requirements", "application", false],
    ["APP-QUOTA", "The program has no places left", "application", false],
    ["UP-ILLEGIBLE", "The document can't be read", "upload", true],
    ["UP-WRONG-DOC", "The document uploaded isn't the one requested", "upload", true],
    ["UP-UNCERTIFIED", "The copy isn't certified", "upload", true],
    ["PAY-NOT-FOUND", "No matching payment was found in our account", "payment", true],
    ["PAY-AMOUNT", "The amount paid doesn't match the amount due", "payment", true],
    ["PAY-DUPLICATE", "This payment reference has already been used", "payment", false],
    ["PAY-UNREADABLE", "The receipt can't be read", "payment", true],
  ];
  reasons.forEach(([c, l, appliesTo, resubmit]) => p("rejection-reasons", c, l, { attrs: { appliesTo, resubmit } }));

  p("application-limits", "MAX_INSTITUTIONS", "Institutions per application", { attrs: { value: 5, unit: "institutions" } });
  p("application-limits", "RESUBMISSION_WINDOW", "Time to resubmit after a rejection", { attrs: { value: 14, unit: "days" } });
  p("application-limits", "TUITION_VERIFY_SLA", "Target time to verify a tuition payment", { attrs: { value: 3, unit: "working days" } });
  p("application-limits", "MAX_UPLOAD_ATTEMPTS", "Upload attempts per document", { attrs: { value: 3, unit: "attempts" } });

  // GCE Ordinary Level
  // Examination types (the families the lists below belong to) and their sittings
  p("examination-types", "GCE_OL", "GCE Ordinary Level", { attrs: { defaultSittings: 1, maxSittings: 3 } });
  p("examination-types", "GCE_AL", "GCE Advanced Level", { attrs: { defaultSittings: 1, maxSittings: 3 } });
  p("examination-types", "BEPC", "BEPC", { attrs: { defaultSittings: 1, maxSittings: 2 } });
  p("examination-types", "PROBATOIRE", "Probatoire", { attrs: { defaultSittings: 1, maxSittings: 2 } });
  p("examination-types", "BAC", "Baccalauréat", { attrs: { defaultSittings: 1, maxSittings: 2 } });

  const olSubjects: [string, string, string, boolean?][] = [
    ["ENG", "English Language", "Core"], ["FRE", "French", "Core"], ["MAT", "Mathematics", "Core"],
    ["BIO", "Biology", "Science"], ["CHE", "Chemistry", "Science"], ["PHY", "Physics", "Science"],
    ["HBI", "Human Biology", "Science"], ["CSC", "Computer Science", "Science"],
    ["LIT", "Literature in English", "Arts"], ["HIS", "History", "Arts"], ["GEO", "Geography", "Arts"],
    ["REL", "Religious Studies", "Arts"], ["ECO", "Economics", "Commercial"], ["COM", "Commerce", "Commercial"],
    ["ACC", "Accounting", "Commercial"], ["FNU", "Food and Nutrition", "Technical", true],
  ];
  olSubjects.forEach(([c, l, g, inactive]) => p("gce-ol-subjects", c, l, { attrs: { group: g }, inactive }));

  const olGrades: [string, string, number, boolean][] = [
    ["A", "Excellent", 3, true], ["B", "Very good", 2, true], ["C", "Credit", 1, true],
    ["D", "Below pass", 0, false], ["E", "Weak", 0, false], ["U", "Unclassified", 0, false],
  ];
  olGrades.forEach(([c, l, pts, pass]) => p("gce-ol-grades", c, l, { attrs: { points: pts, passing: pass } }));

  // GCE Advanced Level
  const alSubjects: [string, string, string, boolean?][] = [
    ["ENL", "English Literature", "Arts"], ["FRE", "French", "Arts"], ["HIS", "History", "Arts"],
    ["GEO", "Geography", "Arts"], ["PHI", "Philosophy", "Arts"], ["REL", "Religious Studies", "Arts"],
    ["PMS", "Pure Mathematics with Statistics", "Science"], ["PMM", "Pure Mathematics with Mechanics", "Science"],
    ["FMA", "Further Mathematics", "Science"], ["BIO", "Biology", "Science"], ["CHE", "Chemistry", "Science"],
    ["PHY", "Physics", "Science"], ["CSC", "Computer Science", "Science"], ["ICT", "Information and Communication Technology", "Science"],
    ["ECO", "Economics", "Commercial"], ["ACC", "Accounting", "Commercial"], ["BMG", "Business Management", "Commercial"],
    ["GEL", "Geology", "Science", true],
  ];
  alSubjects.forEach(([c, l, g, inactive]) => p("gce-al-subjects", c, l, { attrs: { group: g }, inactive }));

  const alGrades: [string, string, number, boolean][] = [
    ["A", "Excellent", 5, true], ["B", "Very good", 4, true], ["C", "Good", 3, true],
    ["D", "Fair", 2, true], ["E", "Pass", 1, true], ["O", "Compensatory O Level pass", 0, false], ["F", "Fail", 0, false],
  ];
  alGrades.forEach(([c, l, pts, pass]) => p("gce-al-grades", c, l, { attrs: { points: pts, passing: pass } }));

  // French-system qualifications: each type carries its own subjects and scoring.
  const series = (subjects: string[], maxSittings = 2) => ({ subjects, maxScore: 20, passMark: 10, maxSittings });
  const bacCore = ["French", "English", "Philosophy"];
  p("bac-types", "A", "BAC A — Lettres et philosophie", { attrs: series([...bacCore, "History", "Geography", "Mathematics"]) });
  p("bac-types", "C", "BAC C — Mathématiques et sciences physiques", { attrs: series([...bacCore, "Mathematics", "Physics", "Chemistry", "Biology"]) });
  p("bac-types", "D", "BAC D — Mathématiques et sciences de la vie", { attrs: series([...bacCore, "Mathematics", "Physics", "Chemistry", "Biology"]) });
  p("bac-types", "E", "BAC E — Mathématiques et techniques", { attrs: series([...bacCore, "Mathematics", "Physics", "Chemistry", "Technology"]) });
  p("bac-types", "TI", "BAC TI — Technologies de l'information", { attrs: series([...bacCore, "Mathematics", "Physics", "Computer Science"]) });

  const probCore = ["French", "English"];
  p("probatoire-types", "A", "Probatoire A — Lettres", { attrs: series([...probCore, "History", "Geography", "Mathematics", "Literature"]) });
  p("probatoire-types", "C", "Probatoire C — Mathématiques et sciences physiques", { attrs: series([...probCore, "Mathematics", "Physics", "Chemistry", "Biology"]) });
  p("probatoire-types", "D", "Probatoire D — Mathématiques et sciences de la vie", { attrs: series([...probCore, "Mathematics", "Physics", "Chemistry", "Biology"]) });
  p("probatoire-types", "E", "Probatoire E — Mathématiques et techniques", { attrs: series([...probCore, "Mathematics", "Physics", "Technology"]), inactive: true });
  p("probatoire-types", "TI", "Probatoire TI — Technologies de l'information", { attrs: series([...probCore, "Mathematics", "Physics", "Computer Science"]) });

  const bepcSubjects = ["French", "English", "Mathematics", "History-Geography-Citizenship", "Physics-Chemistry-Technology", "Life and Earth Sciences"];
  p("bepc-types", "GEN", "BEPC — Enseignement général", { attrs: series(bepcSubjects) });
  p("bepc-types", "BIL", "BEPC — Bilingue", { attrs: series([...bepcSubjects, "Bilingual Studies"]) });

  p("result-types", "PASS", "Pass", { attrs: { meaning: "pass" } });
  p("result-types", "FAIL", "Fail", { attrs: { meaning: "fail" } });
  p("result-types", "ABS", "Absent", { attrs: { meaning: "not-graded" }, description: "The applicant registered but did not sit the paper." });
  p("result-types", "WTH", "Withheld", { attrs: { meaning: "not-graded" }, description: "The exam board has not released this result." });
  p("result-types", "CAN", "Cancelled", { attrs: { meaning: "not-graded" }, inactive: true });

  return out;
}

export const parameterStore = createCollection<ParamItem>("parameters", seedParameters, {
  // Browsers holding parameters saved before a list existed get that
  // list's seed items; lists an admin has already touched are left alone.
  merge: (stored, seed) => {
    const present = new Set(stored.map((i) => i.category));
    const missing = seed.filter((i) => !present.has(i.category));
    return missing.length ? [...stored, ...missing] : stored;
  },
});

export function sortParams(items: ParamItem[]) {
  return [...items].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** Every parameter in a category, sorted, active and inactive. */
export function useParameters(category: ParamCategory): ParamItem[] {
  const all = parameterStore.useItems();
  return useMemo(() => sortParams(all.filter((i) => i.category === category)), [all, category]);
}

/** id → item across every category, for resolving references. */
export function useParameterIndex(): Map<string, ParamItem> {
  const all = parameterStore.useItems();
  return useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
}

/**
 * Options for a dropdown: active items, plus `keepId` even if it has been
 * deactivated — so editing a record that points at a retired value shows
 * that value instead of silently blanking the field.
 */
export function selectableParams(items: ParamItem[], keepId?: string, parentId?: string): ParamItem[] {
  return items.filter(
    (i) => (i.status === "ACTIVE" || i.id === keepId) && (parentId === undefined || i.parentId === parentId)
  );
}

export function paramLabel(index: Map<string, ParamItem>, id: string | undefined): string {
  if (!id) return "—";
  return index.get(id)?.label ?? "Unknown";
}
