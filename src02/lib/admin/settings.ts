import { createCollection } from "./store";

/**
 * Platform-wide settings. Each is a single record (id "platform") held in
 * the same collection store as everything else, so the screens get
 * persistence, cross-tab sync and reset for free. Backend equivalent: a
 * `settings` row per section, read and written as a whole.
 */

export interface SystemSettings {
  id: "platform";
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  defaultLanguage: "en" | "fr";
  timezone: string;
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD";
  maxInstitutionsPerApplicant: number;
  allowLateSubmissions: boolean;
  documentRetentionMonths: number;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  lockoutAttempts: number;
  requireAdminMfa: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  emailSenderName: string;
  smsSenderId: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: string;
}

export const SYSTEM_DEFAULTS: SystemSettings = {
  id: "platform",
  platformName: "Cheeta AOSA",
  supportEmail: "support@aosa.cheeta.local",
  supportPhone: "+237 222 00 00 00",
  defaultLanguage: "en",
  timezone: "Africa/Douala",
  dateFormat: "DD/MM/YYYY",
  maxInstitutionsPerApplicant: 5,
  allowLateSubmissions: false,
  documentRetentionMonths: 36,
  sessionTimeoutMinutes: 30,
  passwordMinLength: 8,
  lockoutAttempts: 5,
  requireAdminMfa: true,
  emailEnabled: true,
  smsEnabled: true,
  emailSenderName: "Cheeta AOSA Admissions",
  smsSenderId: "CHEETA",
  maintenanceMode: false,
  maintenanceMessage: "The platform is undergoing scheduled maintenance. Please try again shortly.",
  updatedAt: "2026-01-01T09:00:00.000Z",
};

export interface PaymentSettings {
  id: "platform";
  baseCurrency: string;
  defaultWebFee: number;
  webFeeCollectionBank: string;
  webFeeAccountName: string;
  webFeeAccountNumber: string;
  /** Parameter ids from "payment-method-types" applicants may use. */
  allowedMethodIds: string[];
  requireReceipt: boolean;
  approvalTargetHours: number;
  autoRejectAfterDays: number;
  bankCodePrefix: string;
  allowPartialPayments: boolean;
  refundWindowDays: number;
  updatedAt: string;
}

export const PAYMENT_DEFAULTS: PaymentSettings = {
  id: "platform",
  baseCurrency: "XAF",
  defaultWebFee: 2000,
  webFeeCollectionBank: "Afriland First Bank",
  webFeeAccountName: "Cheeta AOSA — Web fees",
  webFeeAccountNumber: "CM21 10005 00001 00000000001 21",
  allowedMethodIds: ["MTN-MOMO", "ORANGE-MONEY", "BANK", "WALLET", "TRANSFER"].map((c) => `payment-method-types:${c}`),
  requireReceipt: true,
  approvalTargetHours: 48,
  autoRejectAfterDays: 14,
  bankCodePrefix: "AOSA",
  allowPartialPayments: false,
  refundWindowDays: 30,
  updatedAt: "2026-01-01T09:00:00.000Z",
};

export const systemSettingsStore = createCollection<SystemSettings>("system-settings", () => [SYSTEM_DEFAULTS]);
export const paymentSettingsStore = createCollection<PaymentSettings>("payment-settings", () => [PAYMENT_DEFAULTS]);
