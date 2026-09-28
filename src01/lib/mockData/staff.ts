import { ROLES } from "@/lib/auth/roles";

export type StaffPermission = "PAYMENTS_UPLOADS" | "ACKNOWLEDGED_APPS" | "REJECTED_APPS" | "DELIBERATION";

export interface StaffMember {
  id: string;
  institutionId: string;
  staffId: string;
  name: string;
  position: string;
  title?: string;
  role: "INSTITUTION_ADMIN" | "INSTITUTION_ADMISSION_USER";
  status: "ACTIVE" | "INACTIVE";
  permissions: StaffPermission[];
}

export const mockStaff: StaffMember[] = [
  {
    id: "s-1",
    institutionId: "inst-1",
    staffId: "STAFF-001",
    name: "Grace Mbella",
    position: "Admissions Officer",
    title: "Ms.",
    role: "INSTITUTION_ADMISSION_USER",
    status: "ACTIVE",
    permissions: ["PAYMENTS_UPLOADS", "ACKNOWLEDGED_APPS"],
  },
  {
    id: "s-2",
    institutionId: "inst-1",
    staffId: "STAFF-002",
    name: "John Tamba",
    position: "Head of Admissions",
    title: "Mr.",
    role: "INSTITUTION_ADMIN",
    status: "ACTIVE",
    permissions: ["PAYMENTS_UPLOADS", "ACKNOWLEDGED_APPS", "REJECTED_APPS", "DELIBERATION"],
  },
  {
    id: "s-3",
    institutionId: "inst-2",
    staffId: "STAFF-101",
    name: "Amina K.",
    position: "Admissions Assistant",
    title: "Ms.",
    role: "INSTITUTION_ADMISSION_USER",
    status: "INACTIVE",
    permissions: ["PAYMENTS_UPLOADS"],
  },
];

export function findStaffForInstitution(instId: string) {
  return mockStaff.filter((s) => s.institutionId === instId);
}

export function findStaffById(id: string) {
  return mockStaff.find((s) => s.id === id) || null;
}

export function addStaff(member: StaffMember) {
  mockStaff.push(member);
}

export function updateStaff(id: string, patch: Partial<StaffMember>) {
  const idx = mockStaff.findIndex((s) => s.id === id);
  if (idx !== -1) mockStaff[idx] = { ...mockStaff[idx], ...patch };
}
