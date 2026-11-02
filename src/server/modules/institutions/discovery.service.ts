import "server-only";
import { stateOf } from "./applicationWindow.service";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DocumentRequirement, FacultyOrSchool, InstitutionDetails, InstitutionListing } from "@/lib/institutionDiscovery/data";
import { getDb, type Executor } from "@/server/db/client";
import { departments, faculties, institutions, parameters, programs, uploadRequirements } from "@/server/db/schema";
import { NotFoundError } from "@/server/http/errors";
import { assessFee } from "@/server/modules/fees/calculation";
import { platformMaxUploadKb } from "./institutions.resources";
import { currentAcademicYear } from "@/server/modules/applications/applications.queries";
import { getSettings } from "@/server/modules/settings/settings.service";

type Intake = { open: true } | { open: false; label: string; reason: string };

const fmtDay = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/**
 * The platform's intake (the current academic year's opening and closing
 * dates), which applies on top of each institution's own window: outside
 * it no institution can be added, so the listing must not say "Open".
 */
export async function platformIntake(db: Executor): Promise<Intake> {
  const [year, system] = await Promise.all([currentAcademicYear(db), getSettings("system")]);
  if (!year) return { open: false, label: "Closed", reason: "Applications aren't open yet: no academic year is accepting applications." };
  const today = new Date().toISOString().slice(0, 10);
  const opens = String(year.attrs.opensOn ?? "");
  const closes = String(year.attrs.closesOn ?? "");
  if (opens && today < opens) return { open: false, label: `Opens ${fmtDay(opens)}`, reason: `Applications open on ${opens}.` };
  if (closes && today > closes && !system.allowLateSubmissions) return { open: false, label: `Closed on ${fmtDay(closes)}`, reason: `Applications closed on ${closes}.` };
  return { open: true };
}

/**
 * What applicants see of institutions: the ones accepting applications,
 * and for each, what it teaches, what it asks for and what applying
 * costs. Only active records are shown: an inactive institution, faculty,
 * department, program or document requirement doesn't exist as far as an
 * applicant is concerned.
 */

type InstitutionRow = typeof institutions.$inferSelect;

/** Labels of the parameters (types, towns, regions, qualifications, ...) with these ids. */
async function labelsOf(db: Executor, ids: (string | null)[]): Promise<Map<string, { label: string; attrs: Record<string, unknown> }>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return new Map();
  const rows = await db.select({ id: parameters.id, label: parameters.label, attrs: parameters.attrs }).from(parameters).where(inArray(parameters.id, wanted));
  return new Map(rows.map((r) => [r.id, { label: r.label, attrs: r.attrs }]));
}

/** Programs an applicant may rank at an institution of this type: the type's own limit, never more than three. */
function maxChoices(attrs: Record<string, unknown> | undefined): number {
  const n = Number(attrs?.maxProgramChoices);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3) : 3;
}

async function listing(db: Executor, row: InstitutionRow, labels: Awaited<ReturnType<typeof labelsOf>>, offered: { availableSpaces: number }[], intake: Intake): Promise<InstitutionListing> {
  const fee = await assessFee(db, { id: row.id, webFee: row.webFee });
  const type = labels.get(row.typeId);
  const own = stateOf(row);
  return {
    applications: intake.open || !own.open ? own : { ...own, open: false, label: intake.label, reason: intake.reason },
    id: row.id,
    name: row.name,
    type: type?.label ?? "",
    location: [labels.get(row.townId)?.label, labels.get(row.regionId)?.label].filter(Boolean).join(", "),
    logoInitial: row.name.trim().charAt(0).toUpperCase(),
    website: row.website,
    maxProgramChoices: maxChoices(type?.attrs),
    programCount: offered.length,
    availableSpaces: offered.reduce((sum, p) => sum + p.availableSpaces, 0),
    applicationFee: fee.priced ? fee.applicationFee : null,
    webFee: fee.webFee,
    currency: fee.currency,
    fee: { currency: fee.fee.currency, amount: fee.fee.amount },
  };
}

/** Programs an applicant can choose: active, in an active department of an active faculty. */
function offeredPrograms(db: Executor, institutionIds: string[]) {
  return db
    .select({ program: programs, faculty: faculties.name, department: departments.name, qualification: parameters.label })
    .from(programs)
    .innerJoin(faculties, eq(faculties.id, programs.facultyId))
    .innerJoin(departments, eq(departments.id, programs.departmentId))
    .innerJoin(parameters, eq(parameters.id, programs.qualificationId))
    .where(and(inArray(programs.institutionId, institutionIds), eq(programs.status, "ACTIVE"), eq(faculties.status, "ACTIVE"), eq(departments.status, "ACTIVE")))
    .orderBy(asc(faculties.name), asc(departments.name), asc(programs.name));
}

/** Every institution accepting applications, by name. */
export async function listOpenInstitutions(): Promise<InstitutionListing[]> {
  const db = getDb();
  const rows = await db.select().from(institutions).where(eq(institutions.status, "ACTIVE")).orderBy(asc(institutions.name));
  if (!rows.length) return [];
  const [labels, offered, intake] = await Promise.all([labelsOf(db, rows.flatMap((r) => [r.typeId, r.townId, r.regionId])), offeredPrograms(db, rows.map((r) => r.id)), platformIntake(db)]);
  const out: InstitutionListing[] = [];
  for (const row of rows) out.push(await listing(db, row, labels, offered.filter((o) => o.program.institutionId === row.id).map((o) => o.program), intake));
  return out;
}

/** One institution accepting applications, in full. An inactive or unknown one is "not found". */
export async function getOpenInstitution(id: string): Promise<InstitutionDetails> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, id), eq(institutions.status, "ACTIVE")))
    .limit(1);
  if (!row) throw new NotFoundError("Institution");

  const [labels, offered, requirementRows] = await Promise.all([
    labelsOf(db, [row.typeId, row.townId, row.regionId, row.accreditationBodyId]),
    offeredPrograms(db, [id]),
    db
      .select()
      .from(uploadRequirements)
      .where(and(eq(uploadRequirements.institutionId, id), eq(uploadRequirements.status, "ACTIVE")))
      .orderBy(asc(uploadRequirements.name)),
  ]);

  // The flat, ordered program rows become the tree the screens walk: faculty, then department, then program.
  const tree: FacultyOrSchool[] = [];
  for (const o of offered) {
    let faculty = tree.find((f) => f.id === o.program.facultyId);
    if (!faculty) tree.push((faculty = { id: o.program.facultyId, name: o.faculty, departments: [] }));
    let department = faculty.departments.find((d) => d.id === o.program.departmentId);
    if (!department) faculty.departments.push((department = { id: o.program.departmentId, name: o.department, programs: [] }));
    department.programs.push({ id: o.program.id, code: o.program.code, name: o.program.name, qualification: o.qualification, availableSpaces: o.program.availableSpaces });
  }

  const requirements: DocumentRequirement[] = requirementRows.map((r) => ({ id: r.id, name: r.name, description: r.description, required: r.required, fileTypes: r.fileTypes, maxSizeKb: Math.min(r.maxSizeKb, platformMaxUploadKb()) }));
  // Required documents first, then optional ones.
  requirements.sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));

  return {
    ...(await listing(db, row, labels, offered.map((o) => o.program), await platformIntake(db))),
    address: row.address,
    phone: row.phone,
    email: row.email,
    accreditation: [labels.get(row.accreditationBodyId)?.label, row.accreditationCode].filter(Boolean).join(" · "),
    faculties: tree,
    requirements,
  };
}
