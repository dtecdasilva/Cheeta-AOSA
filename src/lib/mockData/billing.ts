export type FeeCategory = "national" | "international";

export interface FeeConfig {
  id: string;
  institutionId: string;
  name: string; // e.g., "Application fee"
  type: string; // e.g., "application", "web", "other"
  category: FeeCategory; // national/international
  currency: string; // ISO 4217 code — XAF platform-wide (see lib/utils.ts)
  amount: number;
  effectiveDate: string; // ISO
  status: "active" | "inactive";
  notes?: string;
}

export const mockBillingConfigs: FeeConfig[] = [
  {
    id: "fee-1-app",
    institutionId: "inst-1",
    name: "Application fee",
    type: "application",
    category: "national",
    currency: "XAF",
    amount: 15000,
    effectiveDate: "2026-09-01",
    status: "active",
  },
  {
    id: "fee-1-web",
    institutionId: "inst-1",
    name: "Web processing fee",
    type: "web",
    category: "national",
    currency: "XAF",
    amount: 2500,
    effectiveDate: "2026-09-01",
    status: "active",
  },
  {
    id: "fee-1-app-intl",
    institutionId: "inst-1",
    name: "Application fee (international)",
    type: "application",
    category: "international",
    currency: "XAF",
    amount: 45000,
    effectiveDate: "2026-09-01",
    status: "active",
  },
  {
    id: "fee-2-app",
    institutionId: "inst-2",
    name: "Application fee",
    type: "application",
    category: "national",
    currency: "XAF",
    amount: 10000,
    effectiveDate: "2026-09-01",
    status: "active",
  },
];
