export interface Department {
  id: string;
  institutionId: string;
  facultyId?: string;
  name: string;
  head: string;
  address?: string;
  location?: string;
  region?: string;
  town?: string;
  phone?: string;
  email?: string;
  status: "active" | "inactive";
}

export const mockDepartments: Department[] = [
  {
    id: "dep-1-1",
    institutionId: "inst-1",
    facultyId: "fac-1-1",
    name: "Department of Computer Science",
    head: "Dr. Yannick Fotso",
    address: "Bloc Sciences, Mont Fébé",
    location: "Yaoundé, Centre",
    region: "Centre",
    town: "Yaoundé",
    phone: "+237 677 001 101",
    email: "cs@montfebe.cheeta.local",
    status: "active",
  },
  {
    id: "dep-1-2",
    institutionId: "inst-1",
    facultyId: "fac-1-1",
    name: "Department of Biology",
    head: "Prof. Adèle Mbarga",
    address: "Bloc Sciences, Mont Fébé",
    location: "Yaoundé, Centre",
    region: "Centre",
    town: "Yaoundé",
    phone: "+237 677 001 102",
    email: "biology@montfebe.cheeta.local",
    status: "active",
  },
  {
    id: "dep-1-3",
    institutionId: "inst-1",
    facultyId: "fac-1-2",
    name: "Department of Management",
    head: "Dr. Josiane Abena",
    address: "Bâtiment B, Mont Fébé",
    location: "Yaoundé, Centre",
    region: "Centre",
    town: "Yaoundé",
    phone: "+237 677 001 103",
    email: "management@montfebe.cheeta.local",
    status: "active",
  },
  {
    id: "dep-2-1",
    institutionId: "inst-2",
    facultyId: "fac-2-1",
    name: "Department of Electrical Systems",
    head: "Ing. Pierre Nkeng",
    address: "Zone industrielle, Bonabéri",
    location: "Douala, Littoral",
    region: "Littoral",
    town: "Douala",
    phone: "+237 677 002 101",
    email: "electrical@sanaga.cheeta.local",
    status: "active",
  },
];
