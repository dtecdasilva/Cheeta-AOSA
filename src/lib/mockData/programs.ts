export interface StudyProgramDef {
  id: string;
  institutionId: string;
  facultyId?: string;
  departmentId?: string;
  code: string;
  name: string;
  qualificationId?: string;
  availableSpaces?: number;
  status: "active" | "inactive";
}

export const mockPrograms: StudyProgramDef[] = [
  {
    id: "prog-1",
    institutionId: "inst-oxf",
    facultyId: "fac-oxf-2",
    departmentId: "dep-oxf-1",
    code: "ENG-COMP-001",
    name: "BEng Computer Engineering",
    qualificationId: "q-beng",
    availableSpaces: 50,
    status: "active",
  },
  {
    id: "prog-2",
    institutionId: "inst-oxf",
    facultyId: "fac-oxf-1",
    departmentId: "dep-oxf-2",
    code: "SCI-BIO-001",
    name: "BSc Biology",
    qualificationId: "q-bsc",
    availableSpaces: 40,
    status: "active",
  },
  {
    id: "prog-3",
    institutionId: "inst-ken",
    facultyId: "fac-ken-1",
    departmentId: "dep-ken-1",
    code: "BUS-ACC-001",
    name: "Diploma in Accounting",
    qualificationId: "q-dip",
    availableSpaces: 60,
    status: "active",
  },
];
