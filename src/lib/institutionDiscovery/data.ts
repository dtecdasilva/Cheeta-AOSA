/**
 * The institutions an applicant can browse and apply to, as
 * /api/reference/institutions returns them: read from the database, with
 * each institution's own faculties, departments, programs, required
 * documents and fee. Shared by the server that builds these records and
 * the Add Institution screens that show them.
 *
 * The hierarchy is Institution -> Faculty/School -> Department ->
 * Qualification -> Study program. A qualification isn't a record of its
 * own here: it is a label on each program, and the screens group a
 * department's programs by it.
 */

export interface ProgramOffering {
  id: string;
  code: string;
  name: string; // Study Program
  qualification: string;
  availableSpaces: number;
}

export interface Department {
  id: string;
  name: string;
  programs: ProgramOffering[];
}

export interface FacultyOrSchool {
  id: string;
  name: string;
  departments: Department[];
}

/** A document the institution asks applicants to upload. */
export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  /** Lower-case extensions accepted, e.g. ["pdf", "jpg"]. */
  fileTypes: string[];
  maxSizeKb: number;
}

/** An institution as the browse list shows it. */
export interface InstitutionListing {
  id: string;
  name: string;
  /** The institution type's name, e.g. "University". */
  type: string;
  /** Town and region, e.g. "Yaoundé, Centre". */
  location: string;
  logoInitial: string;
  website: string;
  /** How many programs an applicant may rank here (from the institution type). */
  maxProgramChoices: number;
  programCount: number;
  availableSpaces: number;
  /**
   * What applying costs today, in `currency` (the base currency):
   * the institution's fee and the platform web fee. `applicationFee` is
   * null when the fee is set in a currency with no exchange rate yet;
   * `fee` is always the fee as the institution set it.
   */
  applicationFee: number | null;
  webFee: number;
  currency: string;
  fee: { currency: string; amount: number };
  /** Whether it is accepting applications now, and when it opens or closes. */
  applications: import("@/lib/institution/applicationWindow").WindowState;
}

/** One institution in full: the listing, plus how to reach it, what it teaches and what it asks for. */
export interface InstitutionDetails extends InstitutionListing {
  address: string;
  phone: string;
  email: string;
  accreditation: string;
  faculties: FacultyOrSchool[];
  requirements: DocumentRequirement[];
}

export const allPrograms = (institution: Pick<InstitutionDetails, "faculties">): ProgramOffering[] => institution.faculties.flatMap((f) => f.departments).flatMap((d) => d.programs);

/**
 * One ranked program choice within a single institution's application —
 * First/Second/Third Choice, up to that institution's maxProgramChoices.
 * Captures the full path down the hierarchy, not just the program id, so
 * a choice can be displayed or reviewed without re-walking the tree.
 */
export interface ProgramChoice {
  rank: number; // 1, 2, or 3
  facultyId: string;
  facultyName: string;
  departmentId: string;
  departmentName: string;
  qualification: string;
  programId: string;
  programName: string;
  availableSpaces: number;
}

/** The path to a program in an institution's tree, as a choice; undefined if the institution no longer offers it. */
export function choiceFor(institution: Pick<InstitutionDetails, "faculties">, programId: string, rank: number): ProgramChoice | undefined {
  for (const faculty of institution.faculties) {
    for (const department of faculty.departments) {
      const program = department.programs.find((p) => p.id === programId);
      if (program) {
        return { rank, facultyId: faculty.id, facultyName: faculty.name, departmentId: department.id, departmentName: department.name, qualification: program.qualification, programId: program.id, programName: program.name, availableSpaces: program.availableSpaces };
      }
    }
  }
  return undefined;
}
