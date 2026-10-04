export type ConditionType =
  | "MIN"
  | "MAX"
  | "RANGE"
  | "OPTION"
  | "AND"
  | "OR"
  | "SPECIALTY"
  | "FACULTY"
  | "DEPARTMENT";

export interface Condition {
  id: string;
  type: ConditionType;
  field?: string; // e.g. "grade" or "gpa"
  min?: number;
  max?: number;
  options?: string[];
  children?: Condition[];
}

export interface RuleVersion {
  id: string;
  createdAt: string;
  notes?: string;
  condition: Condition;
}

export interface AdmissionRule {
  id: string;
  institutionId: string;
  name: string;
  description?: string;
  latestVersion: RuleVersion;
  versions: RuleVersion[];
}

function genId(prefix = "r") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const now = () => new Date().toISOString();

export const mockAdmissionRules: AdmissionRule[] = [
  {
    id: "rule-1",
    institutionId: "inst-1",
    name: "Minimum GPA for Science Programs",
    description: "Applicants must have a minimum GPA for Science faculty programs.",
    versions: [
      {
        id: "v-1",
        createdAt: now(),
        notes: "Initial",
        condition: {
          id: genId("c"),
          type: "MIN",
          field: "gpa",
          min: 3.0,
        },
      },
    ],
    latestVersion: {
      id: "v-1",
      createdAt: now(),
      notes: "Initial",
      condition: {
        id: genId("c"),
        type: "MIN",
        field: "gpa",
        min: 3.0,
      },
    },
  },
];

export function findRulesForInstitution(instId: string) {
  return mockAdmissionRules.filter((r) => r.institutionId === instId);
}

export function findRuleById(id: string) {
  return mockAdmissionRules.find((r) => r.id === id) ?? null;
}

export function addRule(rule: Omit<AdmissionRule, "id" | "versions" | "latestVersion"> & { initialCondition: Condition; notes?: string }) {
  const id = genId("rule");
  const vId = genId("v");
  const v: RuleVersion = { id: vId, createdAt: now(), notes: rule.notes, condition: rule.initialCondition };
  const newRule: AdmissionRule = {
    id,
    institutionId: rule.institutionId,
    name: rule.name,
    description: rule.description,
    versions: [v],
    latestVersion: v,
  };
  mockAdmissionRules.push(newRule);
  return newRule;
}

export function addRuleVersion(ruleId: string, condition: Condition, notes?: string) {
  const rule = findRuleById(ruleId);
  if (!rule) return null;
  const vId = genId("v");
  const v: RuleVersion = { id: vId, createdAt: now(), notes, condition };
  rule.versions.push(v);
  rule.latestVersion = v;
  return v;
}

export function updateRule(ruleId: string, patch: Partial<AdmissionRule>) {
  const idx = mockAdmissionRules.findIndex((r) => r.id === ruleId);
  if (idx === -1) return null;
  mockAdmissionRules[idx] = { ...mockAdmissionRules[idx], ...patch } as AdmissionRule;
  return mockAdmissionRules[idx];
}
