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

/**
 * Faculties belong to the institutions defined in src/lib/data.ts and use
 * those same ids — "inst-1" is the institution the seeded institution-admin
 * accounts belong to (see lib/auth/users.ts), so signing in as one of them
 * shows this data rather than an empty list.
 */
export const mockFaculties: Faculty[] = [
  {
    id: "fac-1-1",
    institutionId: "inst-1",
    name: "Faculty of Science",
    dean: "Prof. Marthe Ngo Bikai",
    address: "Campus principal, Mont Fébé",
    location: "Yaoundé, Centre",
    region: "Centre",
    town: "Yaoundé",
    phone: "+237 677 000 101",
    email: "science@montfebe.cheeta.local",
    status: "active",
  },
  {
    id: "fac-1-2",
    institutionId: "inst-1",
    name: "Faculty of Economics",
    dean: "Dr. Emmanuel Tchoua",
    address: "Bâtiment B, Mont Fébé",
    location: "Yaoundé, Centre",
    region: "Centre",
    town: "Yaoundé",
    phone: "+237 677 000 102",
    email: "economics@montfebe.cheeta.local",
    status: "active",
  },
  {
    id: "fac-2-1",
    institutionId: "inst-2",
    name: "School of Engineering",
    dean: "Ing. Sylvie Ekambi",
    address: "Zone industrielle, Bonabéri",
    location: "Douala, Littoral",
    region: "Littoral",
    town: "Douala",
    phone: "+237 677 000 201",
    email: "engineering@sanaga.cheeta.local",
    status: "active",
  },
];
