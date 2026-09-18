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
    id: "dep-oxf-1",
    institutionId: "inst-oxf",
    facultyId: "fac-oxf-2",
    name: "Department of Computer Engineering",
    head: "Dr. Grace Hopper",
    address: "Engineering Building, Oxford",
    location: "Oxford, UK",
    region: "South East",
    town: "Oxford",
    phone: "+44 1865 100001",
    email: "ceng@oxf.ac.uk",
    status: "active",
  },
  {
    id: "dep-oxf-2",
    institutionId: "inst-oxf",
    facultyId: "fac-oxf-1",
    name: "Department of Biological Sciences",
    head: "Prof. Rosalind Franklin",
    address: "Science Building, Oxford",
    location: "Oxford, UK",
    region: "South East",
    town: "Oxford",
    phone: "+44 1865 100002",
    email: "bio@oxf.ac.uk",
    status: "active",
  },
  {
    id: "dep-ken-1",
    institutionId: "inst-ken",
    facultyId: "fac-ken-1",
    name: "Department of Accounting",
    head: "Mr. Peter Mwangi",
    address: "Business Block, Nairobi",
    location: "Nairobi, Kenya",
    region: "Nairobi",
    town: "Nairobi",
    phone: "+254 700100001",
    email: "accounting@kenvale.ac.ke",
    status: "active",
  },
];
