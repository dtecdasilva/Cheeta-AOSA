-- Fresh start: removes every sample and demo record so the platform goes live empty.
--
-- Runs once per database, like every migration. What it removes: all institutions and
-- everything under them (faculties, departments, programs, fees, payment methods, upload
-- requirements, rules, deliberations, admissions, tuition, medical, matriculation), all
-- applicants and their applications, payments, documents and files, all institution
-- staff, every demo account, notifications, numbering counters and the audit trail of the
-- demo period.
--
-- What it keeps: the platform's configuration (parameter lists, countries, currencies,
-- exchange rates, education levels, notification templates, roles and permissions,
-- settings) and every real Cheeta administrator account, meaning an AOSA_ADMIN whose
-- address is not a sample one (*.local, example.com/.cm/.org/.net). If no administrator
-- is left, start-up invites BOOTSTRAP_ADMIN_EMAIL as the first one.
--
-- On a brand-new database it runs before the seed, so a development database that loads
-- demo data still gets it.

CREATE TEMP TABLE "_fresh_start_keep" ON COMMIT DROP AS
  SELECT "id" FROM "users"
  WHERE "role" = 'AOSA_ADMIN' AND lower("email") !~ '(\.local|@example\.(com|cm|org|net))$';
--> statement-breakpoint
TRUNCATE TABLE
  "deliberation_name_charges", "deliberation_results", "deliberation_run_rules", "deliberation_runs",
  "deliberation_subscriptions", "admission_rule_versions", "admission_rules",
  "matriculations", "medical_events", "medical_records", "medical_requirements",
  "tuition_payment_reviews", "tuition_payments", "tuition_accounts", "tuition_requirements",
  "admissions", "program_choices", "application_comments", "application_documents",
  "application_fees", "fee_payments", "exchange_rate_snapshots", "application_status_events",
  "application_institutions", "applications",
  "disability_media", "demographic_profiles", "education_records", "examination_results",
  "examination_sitting_subjects", "examination_sittings", "examination_records", "applicant_profiles",
  "notification_deliveries", "notification_receipts", "notifications", "credential_deliveries",
  "institution_payment_methods", "institution_qualifications", "upload_requirements", "fee_configs",
  "programs", "departments", "faculties", "institution_staff", "user_permissions",
  "file_contents", "files", "counters";
--> statement-breakpoint
UPDATE "settings" SET "updated_by" = NULL WHERE "updated_by" IS NOT NULL AND "updated_by" NOT IN (SELECT "id" FROM "_fresh_start_keep");
--> statement-breakpoint
UPDATE "notification_templates" SET "updated_by" = NULL WHERE "updated_by" IS NOT NULL AND "updated_by" NOT IN (SELECT "id" FROM "_fresh_start_keep");
--> statement-breakpoint
UPDATE "exchange_rates" SET "created_by" = NULL WHERE "created_by" IS NOT NULL AND "created_by" NOT IN (SELECT "id" FROM "_fresh_start_keep");
--> statement-breakpoint
DELETE FROM "users" WHERE "id" NOT IN (SELECT "id" FROM "_fresh_start_keep");
--> statement-breakpoint
DELETE FROM "institutions";
--> statement-breakpoint
-- Sample contact and bank details saved with the settings give way to blanks the administrator fills in.
UPDATE "settings" SET "value" = "value" - 'supportEmail' WHERE "key" = 'system' AND "value"->>'supportEmail' = 'support@aosa.cheeta.local';
--> statement-breakpoint
UPDATE "settings" SET "value" = "value" - 'supportPhone' WHERE "key" = 'system' AND "value"->>'supportPhone' = '+237 222 00 00 00';
--> statement-breakpoint
UPDATE "settings" SET "value" = "value" - 'webFeeCollectionBank' - 'webFeeAccountName' - 'webFeeAccountNumber' WHERE "key" = 'payment' AND "value"->>'webFeeAccountNumber' = 'CM21 10005 00001 00000000001 21';
--> statement-breakpoint
-- The trail is append-only; this one clean-up of the demo period is the only exception, and it is recorded.
ALTER TABLE "audit_log" DISABLE TRIGGER "audit_log_no_truncate";
--> statement-breakpoint
TRUNCATE TABLE "audit_log";
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE TRIGGER "audit_log_no_truncate";
--> statement-breakpoint
INSERT INTO "audit_log" ("id", "actor_label", "action", "category", "entity_type", "meta", "at")
VALUES ('aud-fresh-start', 'System (migration 0006)', 'reset', 'configuration', 'platform',
        '{"note": "Sample and demo data removed before go-live. Configuration and real administrator accounts kept."}'::jsonb, now());
