export interface UploadRequirement {
  id: string;
  institutionId: string;
  name: string;
  description?: string;
  required: boolean;
  fileTypes: string[]; // e.g. ['pdf','jpg']
  maxSizeKB: number;
  status: "active" | "inactive";
}

/**
 * These mirror each institution's `requiredDocuments` in src/lib/data.ts —
 * what the institution configures here is exactly what an applicant is
 * asked to upload, so the two lists must not drift apart.
 */
export const mockUploadRequirements: UploadRequirement[] = [
  {
    id: "ur-1-1",
    institutionId: "inst-1",
    name: "Birth certificate",
    description: "Full birth certificate issued by a civil status registry.",
    required: true,
    fileTypes: ["pdf", "jpg", "png"],
    maxSizeKB: 2048,
    status: "active",
  },
  {
    id: "ur-1-2",
    institutionId: "inst-1",
    name: "Baccalaureate certificate",
    description: "Baccalauréat or GCE Advanced Level certificate.",
    required: true,
    fileTypes: ["pdf"],
    maxSizeKB: 5120,
    status: "active",
  },
  {
    id: "ur-1-3",
    institutionId: "inst-1",
    name: "Passport photo",
    description: "Recent passport-size photograph on a plain background.",
    required: true,
    fileTypes: ["jpg", "png"],
    maxSizeKB: 1024,
    status: "active",
  },
  {
    id: "ur-1-4",
    institutionId: "inst-1",
    name: "Transcript of records",
    description: "Official transcript from your most recent school.",
    required: true,
    fileTypes: ["pdf"],
    maxSizeKB: 5120,
    status: "active",
  },
  {
    id: "ur-2-1",
    institutionId: "inst-2",
    name: "Birth certificate",
    description: "Full birth certificate issued by a civil status registry.",
    required: true,
    fileTypes: ["pdf", "jpg", "png"],
    maxSizeKB: 2048,
    status: "active",
  },
  {
    id: "ur-2-2",
    institutionId: "inst-2",
    name: "Level certificate",
    description: "Certificate for the level completed before applying.",
    required: true,
    fileTypes: ["pdf"],
    maxSizeKB: 5120,
    status: "active",
  },
  {
    id: "ur-2-3",
    institutionId: "inst-2",
    name: "Passport photo",
    description: "Recent passport-size photograph on a plain background.",
    required: true,
    fileTypes: ["jpg", "png"],
    maxSizeKB: 1024,
    status: "active",
  },
];
