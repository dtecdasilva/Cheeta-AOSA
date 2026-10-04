import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { audit } from "@/server/audit/audit";
import { SYSTEM_DEFAULTS, PAYMENT_DEFAULTS, type SystemSettings, type PaymentSettings } from "@/lib/admin/settings";
import { NotFoundError } from "@/server/http/errors";

/**
 * Platform settings. The record shapes and their defaults are the ones the
 * admin screens edit (src/lib/admin/settings.ts); stored values are laid
 * over the defaults, so a setting added in a later release has a value
 * before anyone saves it.
 */

const nonNeg = z.number().int().min(0);

const systemSchema = z.object({
  platformName: z.string().trim().min(1).max(100),
  supportEmail: z.email(),
  supportPhone: z.string().trim().min(1).max(40),
  defaultLanguage: z.enum(["en", "fr"]),
  timezone: z.string().trim().min(1).max(60),
  dateFormat: z.enum(["DD/MM/YYYY", "YYYY-MM-DD"]),
  maxInstitutionsPerApplicant: z.number().int().min(1).max(20),
  allowLateSubmissions: z.boolean(),
  documentRetentionMonths: z.number().int().min(6).max(120),
  sessionTimeoutMinutes: z.number().int().min(5).max(480),
  passwordMinLength: z.number().int().min(8).max(64),
  lockoutAttempts: z.number().int().min(3).max(20),
  requireAdminMfa: z.boolean(),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  emailSenderName: z.string().trim().max(100),
  smsSenderId: z.string().trim().max(11),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().max(500),
});

const paymentSchema = z.object({
  baseCurrency: z.string().length(3),
  defaultWebFee: nonNeg.max(100_000),
  webFeeCollectionBank: z.string().trim().min(1).max(120),
  webFeeAccountName: z.string().trim().min(1).max(120),
  webFeeAccountNumber: z.string().trim().min(1).max(60),
  allowedMethodIds: z.array(z.string()).min(1, "Allow at least one payment channel."),
  requireReceipt: z.boolean(),
  approvalTargetHours: z.number().int().min(1).max(336),
  autoRejectAfterDays: z.number().int().min(1).max(90),
  bankCodePrefix: z.string().regex(/^[A-Z0-9]{2,6}$/, "2 to 6 capital letters or digits."),
  allowPartialPayments: z.boolean(),
  refundWindowDays: nonNeg.max(365),
});

const SECTIONS = {
  system: { defaults: SYSTEM_DEFAULTS, schema: systemSchema },
  payment: { defaults: PAYMENT_DEFAULTS, schema: paymentSchema },
} as const;

export type SettingsKey = keyof typeof SECTIONS;
type ValueOf<K extends SettingsKey> = K extends "system" ? SystemSettings : PaymentSettings;

export function isSettingsKey(key: string): key is SettingsKey {
  return key in SECTIONS;
}

export async function getSettings<K extends SettingsKey>(key: K): Promise<ValueOf<K>> {
  const section = SECTIONS[key];
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
  return { ...section.defaults, ...(row?.value ?? {}), ...(row ? { updatedAt: row.updatedAt.toISOString() } : {}) } as ValueOf<K>;
}

/** Replaces a settings section. Partial input is merged over the current values, then validated whole. */
export async function saveSettings<K extends SettingsKey>(key: K, input: unknown): Promise<ValueOf<K>> {
  const section = SECTIONS[key];
  if (!section) throw new NotFoundError("Settings section");
  const current = await getSettings(key);
  const merged = { ...current, ...(typeof input === "object" && input ? input : {}) };
  const value = section.schema.parse(merged);
  await getDb().transaction(async (tx) => {
    await tx
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
    await audit(tx, { action: "update", entityType: "settings", entityId: key, before: current as unknown as Record<string, unknown>, after: { ...current, ...value } });
  });
  return getSettings(key);
}
