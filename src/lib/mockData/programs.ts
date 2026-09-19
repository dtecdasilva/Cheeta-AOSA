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
    institutionId: "inst-1",
    facultyId: "fac-1-1",
    departmentId: "dep-1-1",
    code: "SCI-CS-001",
    name: "BSc Computer Science",
    qualificationId: "q-bsc",
    availableSpaces: 50,
    status: "active",
  },
  {
    id: "prog-2",
    institutionId: "inst-1",
    facultyId: "fac-1-1",
    departmentId: "dep-1-2",
    code: "SCI-BIO-001",
    name: "BSc Biology",
    qualificationId: "q-bsc",
    availableSpaces: 40,
    status: "active",
  },
  {
    id: "prog-3",
    institutionId: "inst-1",
    facultyId: "fac-1-2",
    departmentId: "dep-1-3",
    code: "ECO-MGT-001",
    name: "BSc Management",
    qualificationId: "q-bcom",
    availableSpaces: 65,
    status: "active",
  },
  {
    id: "prog-4",
    institutionId: "inst-2",
    facultyId: "fac-2-1",
    departmentId: "dep-2-1",
    code: "ENG-ELE-001",
    name: "HND Electrical Engineering",
    qualificationId: "q-hnd",
    availableSpaces: 60,
    status: "active",
  },
];
