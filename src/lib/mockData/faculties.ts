export interface Faculty {
  id: string;
  institutionId: string;
  name: string;
  dean: string;
  address?: string;
  location?: string;
  region?: string;
  town?: string;
  phone?: string;
  email?: string;
  status: "active" | "inactive";
}

export const mockFaculties: Faculty[] = [
  {
    id: "fac-oxf-1",
    institutionId: "inst-oxf",
    name: "Faculty of Science",
    dean: "Prof. Ada Lovelace",
    address: "1 Queen's Lane, Oxford",
    location: "Oxford, UK",
    region: "South East",
    town: "Oxford",
    phone: "+44 1865 000001",
    email: "science@oxf.ac.uk",
    status: "active",
  },
  {
    id: "fac-oxf-2",
    institutionId: "inst-oxf",
    name: "Faculty of Engineering",
    dean: "Dr. Alan Turing",
    address: "2 Queen's Lane, Oxford",
    location: "Oxford, UK",
    region: "South East",
    town: "Oxford",
    phone: "+44 1865 000002",
    email: "engineering@oxf.ac.uk",
    status: "active",
  },
  {
    id: "fac-ken-1",
    institutionId: "inst-ken",
    name: "School of Business",
    dean: "Dr. Wanjiru Njoroge",
    address: "10 Kenvale Rd, Nairobi",
    location: "Nairobi, Kenya",
    region: "Nairobi",
    town: "Nairobi",
    phone: "+254 700000001",
    email: "business@kenvale.ac.ke",
    status: "active",
  },
];
