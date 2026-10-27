/**
 * Admission rules: what an institution requires of an applicant, written
 * as data, never as code.
 *
 * A rule is a tree of conditions. Each leaf tests one criterion about the
 * applicant (a grade in a subject, how many subjects they passed, their
 * age, their nationality, ...) or about the program being considered (its
 * faculty, department or specialty); AND and OR combine them.
 *
 *   MIN        criterion >= min            (a score, a count, or a grade "C or better")
 *   MAX        criterion <= max
 *   RANGE      min <= criterion <= max
 *   OPTION     criterion is one of a standard list ("A", "B"; "Cameroon"; ...)
 *   AND        every child holds
 *   OR         at least one child holds
 *   SPECIALTY  the program considered is one of these programs
 *   FACULTY    ... belongs to one of these faculties
 *   DEPARTMENT ... belongs to one of these departments
 *
 * The criteria themselves are not written here either: they are built
 * from the platform's configuration (examination types, subjects and
 * grades; the demographic option lists; education qualifications), so a
 * subject or grade the administrators add is available to rules at once
 * (src/server/modules/admission/criteria.ts). Grades are compared by the
 * points the administrators gave them: "minimum C" means "C or any grade
 * with more points".
 *
 * Shared by the API (which validates and stores rules, and evaluates
 * them) and the screens (which build and display them).
 */

export const CONDITION_TYPES = ["MIN", "MAX", "RANGE", "OPTION", "AND", "OR", "SPECIALTY", "FACULTY", "DEPARTMENT"] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const CONDITION_LABELS: Record<ConditionType, string> = {
  MIN: "Minimum",
  MAX: "Maximum",
  RANGE: "Between",
  OPTION: "One of",
  AND: "All of",
  OR: "Any of",
  SPECIALTY: "Specialty is",
  FACULTY: "Faculty is",
  DEPARTMENT: "Department is",
};

export type Limit = number | string;

export interface Condition {
  /** Optional; lets screens keep track of nodes. */
  id?: string;
  type: ConditionType;
  /** A criterion key, for MIN, MAX, RANGE and OPTION. */
  field?: string;
  min?: Limit;
  max?: Limit;
  /** Allowed values (OPTION), or program, faculty or department ids (SPECIALTY, FACULTY, DEPARTMENT). */
  options?: string[];
  /** AND and OR. */
  children?: Condition[];
}

/** Which programs a version of a rule applies to. All empty: every program at the institution. */
export interface RuleScope {
  facultyIds: string[];
  departmentIds: string[];
  programIds: string[];
}

export const EMPTY_SCOPE: RuleScope = { facultyIds: [], departmentIds: [], programIds: [] };

/**
 * Something about an applicant a rule can test.
 *
 * - number:  compared as a number (a score, a count, an age).
 * - grade:   compared by the points of its grades; `grades` lists them, best first.
 * - option:  one value out of a standard list (`options`). OPTION only.
 * - options: several values held at once (qualifications); OPTION holds if any is in the list.
 */
export interface Criterion {
  key: string;
  label: string;
  group: string;
  kind: "number" | "grade" | "option" | "options";
  grades?: { code: string; points: number }[];
  options?: { value: string; label: string }[];
  /** For numbers: the sensible bounds, for screens and validation. */
  minValue?: number;
  maxValue?: number;
}

export const OPERATORS_FOR: Record<Criterion["kind"], ConditionType[]> = {
  number: ["MIN", "MAX", "RANGE"],
  grade: ["MIN", "MAX", "RANGE", "OPTION"],
  option: ["OPTION"],
  options: ["OPTION"],
};

export const MAX_DEPTH = 6;
export const MAX_NODES = 100;

/** What a rule's ids must belong to: the institution's own structure. */
export interface Structure {
  faculties: Set<string>;
  departments: Set<string>;
  programs: Set<string>;
}

/** Checks a condition tree. Returns problems keyed by the path to the node ("condition.children.1.min"); empty when it is sound. */
export function validateCondition(root: unknown, criteria: Map<string, Criterion>, structure: Structure): Record<string, string> {
  const errors: Record<string, string> = {};
  let nodes = 0;
  const walk = (c: unknown, path: string, depth: number) => {
    nodes++;
    if (!c || typeof c !== "object" || Array.isArray(c)) return void (errors[path] = "Each condition must be an object.");
    const n = c as Condition;
    if (!CONDITION_TYPES.includes(n.type)) return void (errors[`${path}.type`] = "Choose a kind of condition.");
    if (depth > MAX_DEPTH) return void (errors[path] = `Conditions can be nested at most ${MAX_DEPTH} deep.`);
    if (n.type === "AND" || n.type === "OR") {
      if (!Array.isArray(n.children) || n.children.length === 0) return void (errors[`${path}.children`] = `"${CONDITION_LABELS[n.type]}" needs at least one condition inside it.`);
      n.children.forEach((child, i) => walk(child, `${path}.children.${i}`, depth + 1));
      return;
    }
    if (n.type === "SPECIALTY" || n.type === "FACULTY" || n.type === "DEPARTMENT") {
      const known = n.type === "SPECIALTY" ? structure.programs : n.type === "FACULTY" ? structure.faculties : structure.departments;
      const what = n.type === "SPECIALTY" ? "program" : n.type === "FACULTY" ? "faculty" : "department";
      if (!Array.isArray(n.options) || n.options.length === 0) return void (errors[`${path}.options`] = `Choose at least one ${what}.`);
      const unknown = n.options.filter((o) => typeof o !== "string" || !known.has(o));
      if (unknown.length) errors[`${path}.options`] = `Choose ${what === "faculty" ? "faculties" : `${what}s`} of your own institution.`;
      return;
    }
    const criterion = typeof n.field === "string" ? criteria.get(n.field) : undefined;
    if (!criterion) return void (errors[`${path}.field`] = "Choose what to test from the list.");
    if (!OPERATORS_FOR[criterion.kind].includes(n.type)) return void (errors[`${path}.type`] = `"${criterion.label}" can't be tested with "${CONDITION_LABELS[n.type]}".`);
    if (n.type === "OPTION") {
      const allowed = criterion.kind === "grade" ? criterion.grades!.map((g) => g.code) : (criterion.options ?? []).map((o) => o.value);
      if (!Array.isArray(n.options) || n.options.length === 0) return void (errors[`${path}.options`] = "Choose at least one option.");
      if (n.options.some((o) => !allowed.includes(o))) errors[`${path}.options`] = `Choose from the standard options for "${criterion.label}".`;
      return;
    }
    const check = (key: "min" | "max") => {
      const v = n[key];
      if (v === undefined || v === null || v === "") return void (errors[`${path}.${key}`] = `Enter the ${key === "min" ? "minimum" : "maximum"}.`);
      if (criterion.kind === "grade") {
        if (!criterion.grades!.some((g) => g.code === v)) errors[`${path}.${key}`] = `Choose one of the grades for "${criterion.label}".`;
      } else if (typeof v !== "number" || !Number.isFinite(v)) errors[`${path}.${key}`] = "Enter a number.";
      else if ((criterion.minValue !== undefined && v < criterion.minValue) || (criterion.maxValue !== undefined && v > criterion.maxValue)) errors[`${path}.${key}`] = `Enter a value from ${criterion.minValue} to ${criterion.maxValue}.`;
    };
    if (n.type === "MIN" || n.type === "RANGE") check("min");
    if (n.type === "MAX" || n.type === "RANGE") check("max");
    if (n.type === "RANGE" && !errors[`${path}.min`] && !errors[`${path}.max`] && rank(criterion, n.min!) > rank(criterion, n.max!)) errors[`${path}.max`] = "The maximum can't be below the minimum.";
  };
  walk(root, "condition", 1);
  if (nodes > MAX_NODES) errors.condition = `A rule can have at most ${MAX_NODES} conditions.`;
  return errors;
}

/** A limit as a comparable number: a grade by its points, anything else as it is. */
function rank(criterion: Criterion, v: Limit): number {
  if (criterion.kind === "grade") return criterion.grades!.find((g) => g.code === v)?.points ?? Number.NaN;
  return Number(v);
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** What is known about one applicant, keyed by criterion; a missing key means "not known" (never sat, not given). */
export type Facts = Record<string, number | string | string[] | undefined>;

/** The program a rule is being applied for. */
export interface ProgramFacts {
  programId: string;
  facultyId: string;
  departmentId: string;
}

export interface Outcome {
  type: ConditionType;
  pass: boolean;
  /** A sentence saying what was required and what the applicant has. */
  detail: string;
  children?: Outcome[];
}

export function inScope(scope: RuleScope, program: ProgramFacts): boolean {
  const any = scope.facultyIds.length + scope.departmentIds.length + scope.programIds.length > 0;
  return !any || scope.facultyIds.includes(program.facultyId) || scope.departmentIds.includes(program.departmentId) || scope.programIds.includes(program.programId);
}

export function evaluate(c: Condition, facts: Facts, program: ProgramFacts, criteria: Map<string, Criterion>, names: (id: string) => string = (id) => id): Outcome {
  switch (c.type) {
    case "AND":
    case "OR": {
      const children = (c.children ?? []).map((child) => evaluate(child, facts, program, criteria, names));
      const pass = c.type === "AND" ? children.every((x) => x.pass) : children.some((x) => x.pass);
      return { type: c.type, pass, detail: c.type === "AND" ? `All of ${children.length} required` : `At least one of ${children.length} required`, children };
    }
    case "SPECIALTY":
    case "FACULTY":
    case "DEPARTMENT": {
      const actual = c.type === "SPECIALTY" ? program.programId : c.type === "FACULTY" ? program.facultyId : program.departmentId;
      const pass = (c.options ?? []).includes(actual);
      return { type: c.type, pass, detail: `${CONDITION_LABELS[c.type]} ${(c.options ?? []).map(names).join(" or ")}: the program's is ${names(actual)}` };
    }
    default: {
      const criterion = criteria.get(c.field ?? "");
      if (!criterion) return { type: c.type, pass: false, detail: `"${c.field}" can no longer be tested; this condition fails until the rule is updated.` };
      const value = facts[criterion.key];
      const shown = value === undefined ? "none" : Array.isArray(value) ? value.join(", ") || "none" : String(value);
      const label = criterion.label;
      if (c.type === "OPTION") {
        const opts = c.options ?? [];
        const pass = Array.isArray(value) ? value.some((v) => opts.includes(v)) : value !== undefined && opts.includes(String(value));
        return { type: c.type, pass, detail: `${label}: one of ${opts.join(", ")}; has ${shown}` };
      }
      if (value === undefined || Array.isArray(value)) return { type: c.type, pass: false, detail: `${label}: ${requirement(c)}; has none` };
      const v = rank(criterion, value);
      const lo = c.min !== undefined ? rank(criterion, c.min) : -Infinity;
      const hi = c.max !== undefined ? rank(criterion, c.max) : Infinity;
      const pass = Number.isFinite(v) && (c.type === "MAX" ? v <= hi : c.type === "MIN" ? v >= lo : v >= lo && v <= hi);
      return { type: c.type, pass, detail: `${label}: ${requirement(c)}; has ${shown}` };
    }
  }
}

function requirement(c: Condition): string {
  if (c.type === "MIN") return `at least ${c.min}`;
  if (c.type === "MAX") return `at most ${c.max}`;
  return `between ${c.min} and ${c.max}`;
}

/** A condition in words, for lists and history. */
export function describeCondition(c: Condition, criteria: Map<string, Criterion>, names: (id: string) => string = (id) => id): string {
  if (c.type === "AND" || c.type === "OR") return `(${(c.children ?? []).map((x) => describeCondition(x, criteria, names)).join(c.type === "AND" ? " AND " : " OR ")})`;
  if (c.type === "SPECIALTY" || c.type === "FACULTY" || c.type === "DEPARTMENT") return `${CONDITION_LABELS[c.type]} ${(c.options ?? []).map(names).join(" or ")}`;
  const label = criteria.get(c.field ?? "")?.label ?? c.field;
  if (c.type === "OPTION") return `${label} is one of ${(c.options ?? []).join(", ")}`;
  return `${label} ${requirement(c)}`;
}
