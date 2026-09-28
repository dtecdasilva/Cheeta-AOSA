import "server-only";
import { EducationLevelConfig, QualificationOption } from "./configTypes";
import { uid } from "@/lib/utils";

/**
 * In-memory store standing in for the `education_levels` /
 * `education_qualifications` tables in db/schema.sql. This is genuinely
 * meant to be managed (add/rename/remove a level, add/remove a
 * qualification) — not a constant dressed up as configurable — so the
 * write functions below exist now even though no Admin UI calls them yet.
 * That UI is a future module; this store is its clean integration point.
 *
 * Same `globalThis`-keyed pattern as every other in-memory store in this
 * codebase (see src/lib/auth/users.ts for why a plain module-level array
 * isn't safe here — Next.js's separate module graphs for Route Handlers
 * vs. Server Components would otherwise fork this into unsynced copies).
 */
const GLOBAL_KEY = Symbol.for("cheeta-aosa.config.educationLevels");

function seed(): EducationLevelConfig[] {
  const level = (name: string, order: number, qualifications: string[]): EducationLevelConfig => ({
    id: uid("edulvl"),
    name,
    order,
    qualifications: qualifications.map((label) => ({ id: uid("qual"), label })),
  });

  return [
    level("Primary School", 1, ["No Qualification", "First School Leaving Certificate (FSLC)", "Common Entrance"]),
    level("Secondary School", 2, ["No Qualification", "GCE O Level", "BEPC", "Probatoire"]),
    level("High School", 3, ["No Qualification", "GCE A Level", "Baccalaureate/BAC"]),
    level("Vocational School", 4, [
      "No Qualification",
      "CAP (Certificat d'Aptitude Professionnelle)",
      "Technical Probatoire",
      "Technical Baccalaureate",
    ]),
    level("Professional School", 5, ["No Qualification", "Professional Diploma", "Higher Technician Diploma (HND)"]),
    level("University", 6, ["No Qualification", "Bachelor's Degree", "Master's Degree", "Doctorate / PhD"]),
  ];
}

const globalStore = globalThis as unknown as { [GLOBAL_KEY]?: EducationLevelConfig[] };
if (!globalStore[GLOBAL_KEY]) {
  globalStore[GLOBAL_KEY] = seed();
}
const levels = globalStore[GLOBAL_KEY]!;

export function listEducationLevels(): EducationLevelConfig[] {
  return [...levels].sort((a, b) => a.order - b.order);
}

export function findLevelByName(name: string): EducationLevelConfig | undefined {
  return levels.find((l) => l.name === name);
}

export function isValidQualificationForLevel(levelName: string, qualificationLabel: string): boolean {
  const level = findLevelByName(levelName);
  if (!level) return false;
  return level.qualifications.some((q) => q.label === qualificationLabel);
}

// --- Management functions: no Admin UI calls these yet (out of scope for
// this module), but they exist so that UI has real behavior to call into
// rather than needing this store redesigned first. ---

export function createEducationLevel(name: string, order: number): EducationLevelConfig {
  const level: EducationLevelConfig = { id: uid("edulvl"), name, order, qualifications: [] };
  levels.push(level);
  return level;
}

export function deleteEducationLevel(id: string): boolean {
  const idx = levels.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  levels.splice(idx, 1);
  return true;
}

export function addQualification(levelId: string, label: string): QualificationOption | null {
  const level = levels.find((l) => l.id === levelId);
  if (!level) return null;
  const qualification: QualificationOption = { id: uid("qual"), label };
  level.qualifications.push(qualification);
  return qualification;
}

export function removeQualification(levelId: string, qualificationId: string): boolean {
  const level = levels.find((l) => l.id === levelId);
  if (!level) return false;
  const idx = level.qualifications.findIndex((q) => q.id === qualificationId);
  if (idx === -1) return false;
  level.qualifications.splice(idx, 1);
  return true;
}
