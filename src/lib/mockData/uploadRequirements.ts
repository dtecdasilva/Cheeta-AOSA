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

export const mockUploadRequirements: UploadRequirement[] = [
  {
    id: "ur-oxf-1",
    institutionId: "inst-oxf",
    name: "Transcript",
    description: "Official academic transcript",
    required: true,
    fileTypes: ["pdf"],
    maxSizeKB: 5120,
    status: "active",
  },
  {
    id: "ur-oxf-2",
    institutionId: "inst-oxf",
    name: "Passport",
    description: "Passport biodata page",
    required: true,
    fileTypes: ["jpg", "png", "pdf"],
    maxSizeKB: 1024,
    status: "active",
  },
  {
    id: "ur-ken-1",
    institutionId: "inst-ken",
    name: "ID Card",
    description: "National ID or equivalent",
    required: true,
    fileTypes: ["jpg", "pdf"],
    maxSizeKB: 2048,
    status: "active",
  },
];
