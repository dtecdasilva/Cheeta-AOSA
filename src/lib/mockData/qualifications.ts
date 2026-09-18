export interface Qualification {
  id: string;
  institutionId: string;
  facultyId?: string;
  name: string;
}

export const mockQualifications: Qualification[] = [
  { id: "q-bsc", institutionId: "inst-oxf", facultyId: "fac-oxf-1", name: "BSc" },
  { id: "q-beng", institutionId: "inst-oxf", facultyId: "fac-oxf-2", name: "BEng" },
  { id: "q-dip", institutionId: "inst-ken", facultyId: "fac-ken-1", name: "Diploma" },
];
