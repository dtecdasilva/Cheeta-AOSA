import { useMemo } from "react";
import { parameterStore, sortParams, type ParamItem, type ExamParamCategory } from "@/lib/admin/parameters";

/**
 * Examination configuration consumed by the student Examination and
 * Results forms.
 *
 * None of the subjects, grades, qualification types or result labels are
 * written here any more. They are built from the parameters administrators
 * manage under Admin → Examination parameters (src/lib/admin/parameters.ts),
 * so adding a GCE subject, retiring a grade or opening a new BAC series
 * shows up in the student forms without a code change.
 *
 * Each GCE level is one qualification. BAC, BEPC and Probatoire are
 * families whose *types* (series) each become their own qualification,
 * because each series has its own subjects and scoring.
 */

export type ResultMode = "grade" | "score";

export type ExamFamily = "GCE_OL" | "GCE_AL" | "BEPC" | "PROBATOIRE" | "BAC";

export interface ExamTypeConfig {
  /** Stable id stored on the applicant's record. */
  id: string;
  family: ExamFamily;
  familyLabel: string;
  /** Shown in the Qualification dropdown. */
  qualification: string;
  resultMode: ResultMode;
  /** Grade labels, in display order (resultMode === "grade"). */
  grades: string[];
  /** Grades that count as a pass (resultMode === "grade"). */
  passingGrades: string[];
  /** Highest possible score (resultMode === "score"). */
  maxScore: number;
  /** Minimum score that counts as a pass (resultMode === "score"). */
  passMark: number;
  subjects: string[];
  defaultSittings: number;
  maxSittings: number;
  /** False when the admin has deactivated the type since it was used. */
  active: boolean;
}

export interface ResultTypeOption {
  id: string;
  code: string;
  label: string;
  meaning: "pass" | "fail" | "not-graded";
}

export interface ExamConfiguration {
  /** Active qualifications, for choosing from. */
  types: ExamTypeConfig[];
  /** Looks up any qualification, including deactivated ones, for records that already use it. */
  get(id: string): ExamTypeConfig | undefined;
  /** Label for a computed pass or fail, as the admin named it. */
  resultLabel(result: "Pass" | "Fail"): string;
  /** Results an applicant can record instead of a grade, e.g. Absent. */
  notGradedTypes: ResultTypeOption[];
  resultType(id: string): ResultTypeOption | undefined;
}

/**
 * GCE sittings aren't one of the admin-managed parameters yet, so their
 * limits live here. BAC/BEPC/Probatoire types carry their own
 * `maxSittings`, set per type by the admin.
 */
const GCE_SITTINGS = { defaultSittings: 1, maxSittings: 3 };

const FAMILIES: {
  family: ExamFamily;
  label: string;
  types?: ExamParamCategory;
  subjects?: ExamParamCategory;
  grades?: ExamParamCategory;
}[] = [
  { family: "GCE_OL", label: "GCE Ordinary Level", subjects: "gce-ol-subjects", grades: "gce-ol-grades" },
  { family: "GCE_AL", label: "GCE Advanced Level", subjects: "gce-al-subjects", grades: "gce-al-grades" },
  { family: "BEPC", label: "BEPC", types: "bepc-types" },
  { family: "PROBATOIRE", label: "Probatoire", types: "probatoire-types" },
  { family: "BAC", label: "Baccalauréat", types: "bac-types" },
];

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function buildExamConfiguration(items: ParamItem[]): ExamConfiguration {
  const byCategory = (c: ExamParamCategory) => sortParams(items.filter((i) => i.category === c));
  const active = (list: ParamItem[]) => list.filter((i) => i.status === "ACTIVE");

  const all: ExamTypeConfig[] = [];
  for (const f of FAMILIES) {
    if (f.subjects && f.grades) {
      const grades = active(byCategory(f.grades));
      all.push({
        id: f.family,
        family: f.family,
        familyLabel: f.label,
        qualification: f.label,
        resultMode: "grade",
        grades: grades.map((g) => g.code),
        passingGrades: grades.filter((g) => g.attrs.passing === true).map((g) => g.code),
        maxScore: 0,
        passMark: 0,
        subjects: active(byCategory(f.subjects)).map((s) => s.label),
        ...GCE_SITTINGS,
        active: true,
      });
    } else if (f.types) {
      for (const t of byCategory(f.types)) {
        const subjects = Array.isArray(t.attrs.subjects) ? t.attrs.subjects : [];
        const maxSittings = Math.max(1, num(t.attrs.maxSittings, 2));
        all.push({
          id: t.id,
          family: f.family,
          familyLabel: f.label,
          qualification: t.label,
          resultMode: "score",
          grades: [],
          passingGrades: [],
          maxScore: num(t.attrs.maxScore, 20),
          passMark: num(t.attrs.passMark, 10),
          subjects,
          defaultSittings: 1,
          maxSittings,
          active: t.status === "ACTIVE",
        });
      }
    }
  }

  const resultTypes: ResultTypeOption[] = byCategory("result-types").map((r) => ({
    id: r.id,
    code: r.code,
    label: r.label,
    meaning: (r.attrs.meaning as ResultTypeOption["meaning"]) ?? "not-graded",
  }));
  const activeResults = resultTypes.filter((r) => items.find((i) => i.id === r.id)?.status === "ACTIVE");
  const labelFor = (meaning: "pass" | "fail", fallback: string) =>
    activeResults.find((r) => r.meaning === meaning)?.label ?? fallback;

  const index = new Map(all.map((t) => [t.id, t]));
  return {
    types: all.filter((t) => t.active),
    get: (id) => index.get(id),
    resultLabel: (r) => (r === "Pass" ? labelFor("pass", "Pass") : labelFor("fail", "Fail")),
    notGradedTypes: activeResults.filter((r) => r.meaning === "not-graded"),
    resultType: (id) => resultTypes.find((r) => r.id === id),
  };
}

/** The live examination configuration, updating when an admin changes a parameter. */
export function useExamConfiguration(): ExamConfiguration {
  const items = parameterStore.useItems();
  return useMemo(() => buildExamConfiguration(items), [items]);
}

/**
 * Pass or Fail from a raw grade or score, using the qualification's
 * configured pass criteria. Pure frontend logic on mock configuration.
 */
export function computeResult(config: ExamTypeConfig, rawValue: string): "Pass" | "Fail" {
  if (config.resultMode === "grade") {
    return config.passingGrades.includes(rawValue) ? "Pass" : "Fail";
  }
  const score = Number(rawValue);
  if (!Number.isFinite(score)) return "Fail";
  return score >= config.passMark ? "Pass" : "Fail";
}

/** Groups qualifications by family for an <optgroup> dropdown. */
export function groupByFamily(types: ExamTypeConfig[]): { label: string; types: ExamTypeConfig[] }[] {
  const groups: { label: string; types: ExamTypeConfig[] }[] = [];
  for (const t of types) {
    let g = groups.find((x) => x.label === t.familyLabel);
    if (!g) groups.push((g = { label: t.familyLabel, types: [] }));
    g.types.push(t);
  }
  return groups;
}
