"use client";

import Link from "next/link";
import { Card, PageHeading } from "@/components/ui";
import { SubNav } from "@/components/admin/ui";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { SYSTEM_NAV } from "./ReferenceManagers";
import { SYSTEM_DEFAULTS, systemSettingsStore, type SystemSettings } from "@/lib/admin/settings";
import { countryStore, currencyStore, rateStore } from "@/lib/admin/reference";
import { parameterStore } from "@/lib/admin/parameters";
import { useT } from "@/lib/i18n/client";

const TIMEZONES = ["Africa/Douala", "Africa/Lagos", "Africa/Abidjan", "Europe/Paris", "UTC"];

export function SystemConfig() {
  const tr = useT();
  const countries = countryStore.useItems();
  const currencies = currencyStore.useItems();
  const rates = rateStore.useItems();
  const currentYear = parameterStore.useItems().find((p) => p.category === "academic-years" && p.attrs.current === true);

  return (
    <>
      <PageHeading title={tr("System configuration")} description={tr("Platform-wide settings: identity, the application cycle, security and outgoing messages.")} />
      <SubNav items={SYSTEM_NAV} current="/admin/config" />
      <SettingsEditor<SystemSettings>
        store={systemSettingsStore}
        defaults={SYSTEM_DEFAULTS}
        validate={(d) => ({
          smsSenderId: d.smsEnabled && !/^[A-Za-z0-9]{3,11}$/.test(d.smsSenderId) ? tr("3 to 11 letters or digits, no spaces.") : undefined,
          maintenanceMessage: d.maintenanceMode && !d.maintenanceMessage.trim() ? tr("Tell users why the platform is unavailable.") : undefined,
        })}
        sections={[
          {
            title: tr("Platform"),
            description: tr("How the platform presents itself in emails, documents and the sign-in page."),
            fields: [
              { key: "platformName", label: tr("Platform name"), kind: "text", required: true },
              { key: "supportEmail", label: tr("Support email"), kind: "email", required: true },
              { key: "supportPhone", label: tr("Support phone"), kind: "text", required: true },
              {
                key: "defaultLanguage",
                label: tr("Default language"),
                kind: "select",
                options: [
                  { value: "en", label: tr("English") },
                  { value: "fr", label: tr("Français") },
                ],
              },
              { key: "timezone", label: tr("Time zone"), kind: "select", options: TIMEZONES.map((t) => ({ value: t, label: t })) },
              {
                key: "dateFormat",
                label: tr("Date format"),
                kind: "select",
                options: [
                  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/10/2026)" },
                  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-10-31)" },
                ],
              },
            ],
          },
          {
            title: tr("Application cycle"),
            description: currentYear
              ? tr("Current intake: {label}, open {opensOn} to {closesOn}. Dates are set under Application parameters → Academic years.", { label: tr(currentYear.label), opensOn: String(currentYear.attrs.opensOn ?? ""), closesOn: String(currentYear.attrs.closesOn ?? "") })
              : tr("No academic year is marked current. Set one under Application parameters → Academic years."),
            fields: [
              { key: "maxInstitutionsPerApplicant", label: tr("Institutions per applicant"), kind: "number", required: true, min: 1, max: 20, hint: tr("The most institutions one applicant can apply to in an intake.") },
              { key: "documentRetentionMonths", label: tr("Keep uploaded documents for"), suffix: "months", kind: "number", required: true, min: 6, max: 120 },
              { key: "allowLateSubmissions", label: tr("Late submissions"), kind: "checkbox", checkboxLabel: tr("Accept submissions after the closing date"), hint: tr("Institutions still decide whether to consider them.") },
            ],
          },
          {
            title: tr("Security"),
            fields: [
              { key: "sessionTimeoutMinutes", label: tr("Sign out after inactivity"), suffix: "minutes", kind: "number", required: true, min: 5, max: 480 },
              { key: "passwordMinLength", label: tr("Minimum password length"), kind: "number", required: true, min: 8, max: 64 },
              { key: "lockoutAttempts", label: tr("Lock account after failed sign-ins"), kind: "number", required: true, min: 3, max: 20 },
              { key: "requireAdminMfa", label: tr("Two-step sign-in"), kind: "checkbox", checkboxLabel: tr("Require two-step sign-in for every staff account") },
            ],
          },
          {
            title: tr("Notifications"),
            description: tr("Message wording lives in Notification templates."),
            fields: [
              { key: "emailEnabled", label: tr("Email"), kind: "checkbox", checkboxLabel: tr("Send email notifications") },
              { key: "smsEnabled", label: "SMS", kind: "checkbox", checkboxLabel: tr("Send SMS notifications") },
              { key: "emailSenderName", label: tr("Email sender name"), kind: "text", required: true, showIf: (d) => d.emailEnabled },
              { key: "smsSenderId", label: tr("SMS sender id"), kind: "text", required: true, showIf: (d) => d.smsEnabled },
            ],
          },
          {
            title: tr("Maintenance"),
            fields: [
              { key: "maintenanceMode", label: tr("Maintenance mode"), kind: "checkbox", checkboxLabel: tr("Put the platform in maintenance mode"), hint: tr("Applicants and institutions see the message below instead of their portal. Administrators can still sign in.") },
              { key: "maintenanceMessage", label: tr("Message shown to users"), kind: "textarea", showIf: (d) => d.maintenanceMode },
            ],
          },
        ]}
        aside={
          <Card>
            <p className="font-semibold text-base text-[var(--color-ink)]">{tr("Reference data")}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <Link href="/admin/config/countries" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Countries")}
                </Link>
                <span className="tabular-nums text-[var(--color-ink-soft)]">{countries.filter((c) => c.status === "ACTIVE").length} active</span>
              </li>
              <li className="flex justify-between gap-3">
                <Link href="/admin/config/currencies" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Currencies")}
                </Link>
                <span className="tabular-nums text-[var(--color-ink-soft)]">{currencies.filter((c) => c.status === "ACTIVE").length} active</span>
              </li>
              <li className="flex justify-between gap-3">
                <Link href="/admin/config/exchange-rates" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Exchange rates")}
                </Link>
                <span className="tabular-nums text-[var(--color-ink-soft)]">{tr("{count} rates", { count: rates.length })}</span>
              </li>
              <li className="flex justify-between gap-3">
                <Link href="/admin/parameters/application/academic-years" className="text-[var(--color-ink)] underline underline-offset-4">
                  {tr("Academic years")}
                </Link>
                <span className="text-[var(--color-ink-soft)]">{currentYear?.label ?? tr("None current")}</span>
              </li>
            </ul>
          </Card>
        }
      />
    </>
  );
}
