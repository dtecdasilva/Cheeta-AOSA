import { Application } from "@/lib/types";
import { mockInstitutions, mockProgramChoices, mockDocuments, mockPayments } from "./institutions";

const now = new Date();

function daysAgo(n: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const mockApplications: Application[] = [
  {
    id: "app-1001",
    createdAt: daysAgo(12),
    updatedAt: daysAgo(5),
    overallStatus: "SUBMITTED",
    institutionIds: ["inst-oxf"],
    perInstitutionStatus: { "inst-oxf": "SUBMITTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "submitted", review: "submitted" },
    personalInfo: { firstName: "Alice", lastName: "Mugisha", dateOfBirth: "2003-04-12", gender: "Female", nationality: "Kenyan", email: "alice.m@example.com", phone: "+254700000001", region: "Nairobi", city: "Nairobi", address: "P.O. Box 1", guardianName: "John Mugisha", guardianPhone: "+254700000002" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-oxf"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-oxf"),
    payment: mockPayments["inst-oxf"],
    submittedAt: daysAgo(11),
  },
  {
    id: "app-1002",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
    overallStatus: "INCOMPLETE",
    institutionIds: ["inst-ken"],
    perInstitutionStatus: { "inst-ken": "INCOMPLETE" },
    steps: { personal: "submitted", education: "editable", examination: "locked", institutions: "submitted", documents: "editable", fees: "editable", review: "locked" },
    personalInfo: { firstName: "Brian", lastName: "Otieno", dateOfBirth: "2002-07-02", gender: "Male", nationality: "Kenyan", email: "brian.o@example.com", phone: "+254700000010", region: "Mombasa", city: "Mombasa", address: "Beach Rd 5", guardianName: "Grace Otieno", guardianPhone: "+254700000011" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-ken"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-ken"),
    payment: mockPayments["inst-ken"],
    submittedAt: null,
  },
  {
    id: "app-1003",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
    overallStatus: "ACCEPTED",
    institutionIds: ["inst-oxf"],
    perInstitutionStatus: { "inst-oxf": "ACCEPTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "submitted", review: "submitted" },
    personalInfo: { firstName: "Carol", lastName: "Wanjiru", dateOfBirth: "2001-11-24", gender: "Female", nationality: "Kenyan", email: "carol.w@example.com", phone: "+254700000020", region: "Nakuru", city: "Nakuru", address: "Lane 3", guardianName: "Peter Wanjiru", guardianPhone: "+254700000021" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-oxf"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-oxf"),
    payment: mockPayments["inst-oxf"],
    submittedAt: daysAgo(5),
  },
  {
    id: "app-1004",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    overallStatus: "I_REJECTED",
    institutionIds: ["inst-ken"],
    perInstitutionStatus: { "inst-ken": "I_REJECTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "submitted", review: "submitted" },
    personalInfo: { firstName: "David", lastName: "Karanja", dateOfBirth: "2000-02-14", gender: "Male", nationality: "Kenyan", email: "david.k@example.com", phone: "+254700000030", region: "Nakuru", city: "Nakuru", address: "Road 8", guardianName: "Mary Karanja", guardianPhone: "+254700000031" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-ken"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-ken"),
    payment: null,
    submittedAt: daysAgo(2),
  },
  {
    id: "app-1005",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    overallStatus: "RESUBMITTED",
    institutionIds: ["inst-oxf"],
    perInstitutionStatus: { "inst-oxf": "RESUBMITTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "editable", review: "locked" },
    personalInfo: { firstName: "Eve", lastName: "Njeri", dateOfBirth: "2004-05-05", gender: "Female", nationality: "Kenyan", email: "eve.n@example.com", phone: "+254700000040", region: "Kisumu", city: "Kisumu", address: "Market St", guardianName: "Samuel Njeri", guardianPhone: "+254700000041" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-oxf"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-oxf"),
    payment: null,
    submittedAt: daysAgo(1),
  },
];

export function findApplicationById(id: string) {
  return mockApplications.find((a) => a.id === id) || null;
}

export function findApplicationsForInstitution(instId: string) {
  return mockApplications.filter((a) => a.institutionIds.includes(instId));
}
