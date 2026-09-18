export type FeeCategory = "national" | "international";

export interface FeeConfig {
  id: string;
  institutionId: string;
  name: string; // e.g., "Application fee"
  type: string; // e.g., "application", "web", "other"
  category: FeeCategory; // national/international
  currency: string; // e.g. USD, GBP
  amount: number;
  effectiveDate: string; // ISO
  status: "active" | "inactive";
  notes?: string;
}

export const mockBillingConfigs: FeeConfig[] = [
  {
    id: "fee-oxf-app",
    institutionId: "inst-oxf",
    name: "Application fee",
    type: "application",
    category: "national",
    currency: "GBP",
    amount: 50,
    effectiveDate: "2026-09-01",
    status: "active",
  },
  {
    id: "fee-oxf-web",
    institutionId: "inst-oxf",
    name: "Web processing fee",
    type: "web",
    category: "national",
    currency: "GBP",
    amount: 5,
    effectiveDate: "2026-09-01",
    status: "active",
  },
  {
    id: "fee-ken-app-intl",
    institutionId: "inst-ken",
    name: "Application fee (international)",
    type: "application",
    category: "international",
    currency: "USD",
    amount: 80,
    effectiveDate: "2026-09-01",
    status: "active",
  },
];
