import { findApplicationsForInstitution } from "./applications";
import { mockAdmissionRules } from "./admissionRules";

export type DeliberationStatus = "PENDING" | "RUNNING" | "COMPLETED";

export interface DeliberationRun {
  id: string;
  institutionId: string;
  createdAt: string;
  ruleId: string;
  ruleVersionId: string;
  status: DeliberationStatus;
  notes?: string;
  // simple mock result slices
  accepted: string[]; // application ids
  unsuccessful: string[]; // application ids
  firstChoice: string[];
  secondChoice: string[];
  thirdChoice: string[];
}

const now = () => new Date().toISOString();
function genId(prefix = "d") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export const mockDeliberationRuns: DeliberationRun[] = [];

export function findRunsForInstitution(instId: string) {
  return mockDeliberationRuns.filter((r) => r.institutionId === instId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function findRunById(id: string) {
  return mockDeliberationRuns.find((r) => r.id === id) ?? null;
}

export function addRun(institutionId: string, ruleId: string, ruleVersionId: string, notes?: string) {
  // create a simple mock result using the first applications found for the institution
  const apps = findApplicationsForInstitution(institutionId);
  const appIds = apps.map((a) => a.id);
  const accepted = appIds.slice(0, Math.min(5, appIds.length));
  const unsuccessful = appIds.slice(5, Math.min(12, appIds.length));
  const firstChoice = accepted.filter((_, i) => i % 3 === 0);
  const secondChoice = accepted.filter((_, i) => i % 3 === 1);
  const thirdChoice = accepted.filter((_, i) => i % 3 === 2);

  const run = {
    id: genId("run"),
    institutionId,
    createdAt: now(),
    ruleId,
    ruleVersionId,
    status: "COMPLETED" as DeliberationStatus,
    notes,
    accepted,
    unsuccessful,
    firstChoice,
    secondChoice,
    thirdChoice,
  } as DeliberationRun;

  mockDeliberationRuns.push(run);
  return run;
}

export function availableRulesForInstitution(instId: string) {
  return mockAdmissionRules.filter((r) => r.institutionId === instId);
}
