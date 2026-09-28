export interface Qualification {
  id: string;
  institutionId: string;
  facultyId?: string;
  name: string;
}

export const mockQualifications: Qualification[] = [
  { id: "q-bsc", institutionId: "inst-1", facultyId: "fac-1-1", name: "Bachelor's Degree" },
  { id: "q-msc", institutionId: "inst-1", facultyId: "fac-1-1", name: "Master's Degree" },
  { id: "q-bcom", institutionId: "inst-1", facultyId: "fac-1-2", name: "Bachelor's Degree (Commerce)" },
  { id: "q-hnd", institutionId: "inst-2", facultyId: "fac-2-1", name: "Higher National Diploma" },
];
