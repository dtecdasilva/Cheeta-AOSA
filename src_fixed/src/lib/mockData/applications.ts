import { Application } from "@/lib/types";
import { mockProgramChoices, mockDocuments, mockPayments } from "./institutions";

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
    institutionIds: ["inst-1"],
    perInstitutionStatus: { "inst-1": "SUBMITTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "submitted", review: "submitted" },
    personalInfo: { firstName: "Aïssatou", lastName: "Mballa", dateOfBirth: "2003-04-12", gender: "Female", nationality: "Cameroonian", email: "aissatou.m@example.com", phone: "+237 670 000 001", region: "Centre", city: "Yaoundé", address: "BP 1024, Yaoundé", guardianName: "Ibrahim Mballa", guardianPhone: "+237 670 000 002" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-1"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-1"),
    payment: mockPayments["inst-1"],
    submittedAt: daysAgo(11),
  },
  {
    id: "app-1002",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
    overallStatus: "INCOMPLETE",
    institutionIds: ["inst-2"],
    perInstitutionStatus: { "inst-2": "INCOMPLETE" },
    steps: { personal: "submitted", education: "editable", examination: "locked", institutions: "submitted", documents: "editable", fees: "editable", review: "locked" },
    personalInfo: { firstName: "Paul", lastName: "Nguemo", dateOfBirth: "2002-07-02", gender: "Male", nationality: "Cameroonian", email: "paul.n@example.com", phone: "+237 670 000 010", region: "Littoral", city: "Douala", address: "Rue Bonanjo 5", guardianName: "Grace Nguemo", guardianPhone: "+237 670 000 011" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-2"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-2"),
    payment: mockPayments["inst-2"],
    submittedAt: null,
  },
  {
    id: "app-1003",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
    overallStatus: "ACCEPTED",
    institutionIds: ["inst-1"],
    perInstitutionStatus: { "inst-1": "ACCEPTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "submitted", review: "submitted" },
    personalInfo: { firstName: "Chantal", lastName: "Fouda", dateOfBirth: "2001-11-24", gender: "Female", nationality: "Cameroonian", email: "chantal.f@example.com", phone: "+237 670 000 020", region: "West", city: "Bafoussam", address: "Quartier Tamdja 3", guardianName: "Pierre Fouda", guardianPhone: "+237 670 000 021" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-1"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-1"),
    payment: mockPayments["inst-1"],
    submittedAt: daysAgo(5),
  },
  {
    id: "app-1004",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    overallStatus: "I_REJECTED",
    institutionIds: ["inst-2"],
    perInstitutionStatus: { "inst-2": "I_REJECTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "submitted", review: "submitted" },
    personalInfo: { firstName: "David", lastName: "Kamga", dateOfBirth: "2000-02-14", gender: "Male", nationality: "Cameroonian", email: "david.k@example.com", phone: "+237 670 000 030", region: "West", city: "Bafoussam", address: "Avenue Djeleng 8", guardianName: "Marie Kamga", guardianPhone: "+237 670 000 031" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-2"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-2"),
    payment: null,
    submittedAt: daysAgo(2),
  },
  {
    id: "app-1005",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    overallStatus: "RESUBMITTED",
    institutionIds: ["inst-1"],
    perInstitutionStatus: { "inst-1": "RESUBMITTED" },
    steps: { personal: "submitted", education: "submitted", examination: "submitted", institutions: "submitted", documents: "submitted", fees: "editable", review: "locked" },
    personalInfo: { firstName: "Estelle", lastName: "Njoya", dateOfBirth: "2004-05-05", gender: "Female", nationality: "Cameroonian", email: "estelle.n@example.com", phone: "+237 670 000 040", region: "North West", city: "Bamenda", address: "Commercial Avenue", guardianName: "Samuel Njoya", guardianPhone: "+237 670 000 041" },
    education: [],
    examinations: [],
    programChoices: mockProgramChoices.filter((p) => p.institutionId === "inst-1"),
    documents: mockDocuments.filter((d) => d.institutionId === "inst-1"),
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
