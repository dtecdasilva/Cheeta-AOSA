/**
 * Institution Discovery's hierarchical view of the same institutions
 * already defined in src/lib/data.ts (same ids, names, types, locations,
 * fees) — this file adds the Faculty/School → Department → Qualification
 * → Study Program tree and mock "available spaces" on top, rather than
 * replacing or restructuring that existing, already-used data. Anything
 * that needs the base institution facts (fees, required documents, the
 * old application wizard, the Dashboard, Fee Summary) keeps reading from
 * lib/data.ts unchanged; anything that needs the hierarchy reads from here.
 */
import { institutions } from "@/lib/data";
import { Institution } from "@/lib/types";

export interface ProgramOffering {
  id: string;
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

export interface InstitutionProfile {
  overview: string;
  establishedYear: number;
  website: string;
  faculties: FacultyOrSchool[];
}

/** Keyed by institution id (see src/lib/data.ts). */
const PROFILES: Record<string, InstitutionProfile> = {
  "inst-1": {
    overview:
      "A public research university in Yaoundé offering a broad range of undergraduate and graduate programs across science, economics, and the humanities.",
    establishedYear: 1962,
    website: "www.montfebe-university.example",
    faculties: [
      {
        id: "fac-1-science",
        name: "Faculty of Science",
        departments: [
          {
            id: "dept-1-cs",
            name: "Computer Science",
            programs: [
              { id: "prog-1", name: "BSc Computer Science", qualification: "Bachelor's Degree", availableSpaces: 45 },
              { id: "prog-1b", name: "MSc Computer Science", qualification: "Master's Degree", availableSpaces: 12 },
            ],
          },
          {
            id: "dept-1-bio",
            name: "Biology",
            programs: [{ id: "prog-2", name: "BSc Biology", qualification: "Bachelor's Degree", availableSpaces: 30 }],
          },
        ],
      },
      {
        id: "fac-1-econ",
        name: "Faculty of Economics",
        departments: [
          {
            id: "dept-1-mgmt",
            name: "Management",
            programs: [
              { id: "prog-3", name: "BSc Management", qualification: "Bachelor's Degree", availableSpaces: 60 },
            ],
          },
        ],
      },
    ],
  },
  "inst-2": {
    overview:
      "A polytechnic institute in Douala focused on hands-on engineering and technical training leading directly to industry-recognized diplomas.",
    establishedYear: 1988,
    website: "www.sanaga-polytechnic.example",
    faculties: [
      {
        id: "fac-2-eng",
        name: "School of Engineering",
        departments: [
          {
            id: "dept-2-elec",
            name: "Electrical Systems",
            programs: [
              {
                id: "prog-4",
                name: "HND Electrical Engineering",
                qualification: "Higher National Diploma",
                availableSpaces: 25,
              },
            ],
          },
          {
            id: "dept-2-civil",
            name: "Civil Works",
            programs: [
              {
                id: "prog-5",
                name: "HND Civil Engineering",
                qualification: "Higher National Diploma",
                availableSpaces: 20,
              },
            ],
          },
        ],
      },
    ],
  },
  "inst-3": {
    overview:
      "A professional school in Bamenda training the next generation of nursing and allied health professionals for the North West region.",
    establishedYear: 2001,
    website: "www.bamenda-health.example",
    faculties: [
      {
        id: "fac-3-nursing",
        name: "School of Nursing",
        departments: [
          {
            id: "dept-3-general",
            name: "General Nursing",
            programs: [
              { id: "prog-6", name: "Diploma in Nursing", qualification: "Professional Diploma", availableSpaces: 15 },
            ],
          },
        ],
      },
    ],
  },
  "inst-4": {
    overview:
      "A general secondary and high school in Bafoussam offering the Science and Arts series through to the Baccalaureate.",
    establishedYear: 1975,
    website: "www.lgb-bafoussam.example",
    faculties: [
      {
        id: "fac-4-general",
        name: "General Education",
        departments: [
          {
            id: "dept-4-science",
            name: "Science Series",
            programs: [
              { id: "prog-7", name: "Form 5 — Science Series", qualification: "Secondary Level", availableSpaces: 80 },
            ],
          },
        ],
      },
    ],
  },
};

export interface InstitutionWithProfile extends Institution {
  profile: InstitutionProfile;
}

export function listInstitutionsWithProfiles(): InstitutionWithProfile[] {
  return institutions
    .filter((inst) => PROFILES[inst.id])
    .map((inst) => ({ ...inst, profile: PROFILES[inst.id] }));
}

export function getInstitutionWithProfile(id: string): InstitutionWithProfile | undefined {
  const inst = institutions.find((i) => i.id === id);
  const profile = PROFILES[id];
  if (!inst || !profile) return undefined;
  return { ...inst, profile };
}

export function totalAvailableSpaces(profile: InstitutionProfile): number {
  return profile.faculties
    .flatMap((f) => f.departments)
    .flatMap((d) => d.programs)
    .reduce((sum, p) => sum + p.availableSpaces, 0);
}

export function totalProgramCount(profile: InstitutionProfile): number {
  return profile.faculties.flatMap((f) => f.departments).flatMap((d) => d.programs).length;
}

/**
 * One ranked program choice within a single institution's application —
 * First/Second/Third Choice, "where applicable" per that institution's
 * own maxProgramChoices (already on the base Institution type in
 * src/lib/data.ts: 3 for a university, 1 for a school that only accepts
 * a single program choice, etc.). Captures the full path down the
 * hierarchy, not just the program id, so a choice can be displayed or
 * reviewed without re-walking the tree.
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
