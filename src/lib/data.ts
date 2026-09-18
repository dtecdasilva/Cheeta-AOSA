import { Institution, StepKey, StudyProgram, InstitutionType } from "./types";

export const INSTITUTION_TYPES: InstitutionType[] = [
  "Secondary School",
  "High School",
  "University",
  "Vocational School",
  "Professional School",
];

export const institutions: Institution[] = [
  {
    id: "inst-1",
    name: "Mont Fébé University",
    type: "University",
    location: "Yaoundé, Centre",
    logoInitial: "M",
    applicationFee: 15000,
    webFee: 2500,
    maxProgramChoices: 3,
    requiredDocuments: [
      "Birth certificate",
      "Baccalaureate certificate",
      "Passport photo",
      "Transcript of records",
    ],
  },
  {
    id: "inst-2",
    name: "Sanaga Polytechnic Institute",
    type: "Vocational School",
    location: "Douala, Littoral",
    logoInitial: "S",
    applicationFee: 10000,
    webFee: 2000,
    maxProgramChoices: 2,
    requiredDocuments: ["Birth certificate", "Level certificate", "Passport photo"],
  },
  {
    id: "inst-3",
    name: "Bamenda Professional School of Health",
    type: "Professional School",
    location: "Bamenda, North West",
    logoInitial: "B",
    applicationFee: 18000,
    webFee: 3000,
    maxProgramChoices: 1,
    requiredDocuments: [
      "Birth certificate",
      "Baccalaureate certificate",
      "Medical fitness certificate",
      "Passport photo",
    ],
  },
  {
    id: "inst-4",
    name: "Lycée Général de Bafoussam",
    type: "High School",
    location: "Bafoussam, West",
    logoInitial: "L",
    applicationFee: 5000,
    webFee: 1000,
    maxProgramChoices: 1,
    requiredDocuments: ["Birth certificate", "Previous report card", "Passport photo"],
  },
];

export const programs: StudyProgram[] = [
  { id: "prog-1", institutionId: "inst-1", faculty: "Faculty of Science", department: "Computer Science", name: "BSc Computer Science", qualification: "Bachelor's Degree" },
  { id: "prog-2", institutionId: "inst-1", faculty: "Faculty of Science", department: "Biology", name: "BSc Biology", qualification: "Bachelor's Degree" },
  { id: "prog-3", institutionId: "inst-1", faculty: "Faculty of Economics", department: "Management", name: "BSc Management", qualification: "Bachelor's Degree" },
  { id: "prog-4", institutionId: "inst-2", faculty: "School of Engineering", department: "Electrical Systems", name: "HND Electrical Engineering", qualification: "Higher National Diploma" },
  { id: "prog-5", institutionId: "inst-2", faculty: "School of Engineering", department: "Civil Works", name: "HND Civil Engineering", qualification: "Higher National Diploma" },
  { id: "prog-6", institutionId: "inst-3", faculty: "School of Nursing", department: "General Nursing", name: "Diploma in Nursing", qualification: "Professional Diploma" },
  { id: "prog-7", institutionId: "inst-4", faculty: "General Education", department: "Science Series", name: "Form 5 — Science Series", qualification: "Secondary Level" },
];

export const stepOrder: StepKey[] = [
  "personal",
  "education",
  "examination",
  "institutions",
  "documents",
  "fees",
  "review",
];

export const stepLabels: Record<StepKey, string> = {
  personal: "Personal information",
  education: "Education history",
  examination: "Examination records",
  institutions: "Institutions & programs",
  documents: "Required documents",
  fees: "Fees & payment",
  review: "Review & submit",
};
