CREATE TABLE "institution_qualifications" (
	"institution_id" text NOT NULL,
	"qualification_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institution_qualifications_institution_id_qualification_id_pk" PRIMARY KEY("institution_id","qualification_id")
);
--> statement-breakpoint
CREATE TABLE "disability_media" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_id" text NOT NULL,
	"kind" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliberation_run_rules" (
	"deliberation_run_id" text NOT NULL,
	"rule_version_id" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "deliberation_run_rules_deliberation_run_id_rule_version_id_pk" PRIMARY KEY("deliberation_run_id","rule_version_id")
);
--> statement-breakpoint
CREATE TABLE "medical_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"program_id" text,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"validity_months" smallint,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuition_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"program_id" text,
	"academic_year_id" text,
	"category" text NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"amount" integer NOT NULL,
	"instalments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_receipts" (
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "notification_receipts_notification_id_user_id_pk" PRIMARY KEY("notification_id","user_id")
);
--> statement-breakpoint
DROP INDEX "matriculations_account_unique";--> statement-breakpoint
ALTER TABLE "deliberation_runs" ALTER COLUMN "rule_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ALTER COLUMN "notification_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD COLUMN "photo_file_id" text;--> statement-breakpoint
ALTER TABLE "institution_staff" ADD COLUMN "platform_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_staff" ADD COLUMN "role_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "region_id" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "town_id" text;--> statement-breakpoint
ALTER TABLE "faculties" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "faculties" ADD COLUMN "region_id" text;--> statement-breakpoint
ALTER TABLE "faculties" ADD COLUMN "town_id" text;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "bank_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "branch_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "rib" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "applications_mode" text DEFAULT 'OPEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "applications_open_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "applications_close_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "applications_message" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_requirements" ADD COLUMN "custom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_rule_versions" ADD COLUMN "scope" jsonb DEFAULT '{"facultyIds":[],"departmentIds":[],"programIds":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_rules" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_rules" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "type" text DEFAULT 'FULL' NOT NULL;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "conditions" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "conditions_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "condition_status" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "conditions_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "conditions_decided_by" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "conditions_note" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "deliberation_result_id" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "admission_number" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "admitted_by" text;--> statement-breakpoint
ALTER TABLE "admissions" ADD COLUMN "letter_issued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliberation_results" ADD COLUMN "failed_at" text;--> statement-breakpoint
ALTER TABLE "deliberation_results" ADD COLUMN "merit" numeric;--> statement-breakpoint
ALTER TABLE "deliberation_results" ADD COLUMN "reasons" jsonb;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD COLUMN "run_number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD COLUMN "rank_by" text;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD COLUMN "published_by" text;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "student_id" text;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "admission_id" text;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "status" text DEFAULT 'MATRICULATED' NOT NULL;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "matriculations" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "requirement_id" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "requirement_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "medical_records" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD COLUMN "requirement_id" text;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD COLUMN "currency" text DEFAULT 'XAF' NOT NULL;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD COLUMN "recorded_by" text;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "recipient_user_id" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "event" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "template_code" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "template_version" integer;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "subject" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "body" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_label" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_qualifications" ADD CONSTRAINT "institution_qualifications_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_qualifications" ADD CONSTRAINT "institution_qualifications_qualification_id_parameters_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disability_media" ADD CONSTRAINT "disability_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disability_media" ADD CONSTRAINT "disability_media_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_run_rules" ADD CONSTRAINT "deliberation_run_rules_deliberation_run_id_deliberation_runs_id_fk" FOREIGN KEY ("deliberation_run_id") REFERENCES "public"."deliberation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_run_rules" ADD CONSTRAINT "deliberation_run_rules_rule_version_id_admission_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."admission_rule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_requirements" ADD CONSTRAINT "medical_requirements_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_requirements" ADD CONSTRAINT "medical_requirements_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_requirements" ADD CONSTRAINT "medical_requirements_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_requirements" ADD CONSTRAINT "tuition_requirements_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_requirements" ADD CONSTRAINT "tuition_requirements_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_requirements" ADD CONSTRAINT "tuition_requirements_academic_year_id_parameters_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_requirements" ADD CONSTRAINT "tuition_requirements_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disability_media_user_idx" ON "disability_media" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "medical_requirements_code_unique" ON "medical_requirements" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX "medical_requirements_institution_idx" ON "medical_requirements" USING btree ("institution_id","status");--> statement-breakpoint
CREATE INDEX "tuition_requirements_institution_idx" ON "tuition_requirements" USING btree ("institution_id","status");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_region_id_parameters_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_town_id_parameters_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_region_id_parameters_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_town_id_parameters_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_rules" ADD CONSTRAINT "admission_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_conditions_decided_by_users_id_fk" FOREIGN KEY ("conditions_decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_deliberation_result_id_deliberation_results_id_fk" FOREIGN KEY ("deliberation_result_id") REFERENCES "public"."deliberation_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_admitted_by_users_id_fk" FOREIGN KEY ("admitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD CONSTRAINT "deliberation_runs_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_requirement_id_medical_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."medical_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD CONSTRAINT "tuition_accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD CONSTRAINT "tuition_accounts_requirement_id_tuition_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."tuition_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admissions_number_unique" ON "admissions" USING btree ("admission_number");--> statement-breakpoint
CREATE INDEX "admissions_institution_idx" ON "admissions" USING btree ("institution_id","status");--> statement-breakpoint
CREATE INDEX "admissions_run_idx" ON "admissions" USING btree ("deliberation_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliberation_runs_number_unique" ON "deliberation_runs" USING btree ("institution_id","run_number") WHERE "deliberation_runs"."run_number" > 0;--> statement-breakpoint
CREATE INDEX "matriculations_institution_idx" ON "matriculations" USING btree ("institution_id","status");--> statement-breakpoint
CREATE INDEX "tuition_accounts_institution_idx" ON "tuition_accounts" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tuition_payments_live_reference_unique" ON "tuition_payments" USING btree (lower("reference")) WHERE "tuition_payments"."status" <> 'REJECTED';--> statement-breakpoint
CREATE INDEX "notification_deliveries_queue_idx" ON "notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_recipient_idx" ON "notification_deliveries" USING btree ("recipient_user_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_category_idx" ON "audit_log" USING btree ("category","at");--> statement-breakpoint
CREATE INDEX "audit_log_institution_idx" ON "audit_log" USING btree ("institution_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "matriculations_account_unique" ON "matriculations" USING btree ("tuition_account_id") WHERE "matriculations"."status" = 'MATRICULATED';--> statement-breakpoint
-- Entries written before categories existed: the same rules as server/audit/categories.ts.
UPDATE "audit_log" SET "category" = CASE
  WHEN entity_type = 'account' AND action IN ('login','login_failed','login_blocked','logout','password_reset','password_reset_requested','email_verified') THEN 'authentication'
  WHEN entity_type = 'account' AND action = 'register' THEN 'registration'
  WHEN entity_type = 'permission' THEN 'permissions'
  WHEN entity_type IN ('account','staff') THEN 'users'
  WHEN entity_type = 'application' AND (action = 'submit' OR changes->'status'->>'to' = 'SUBMITTED') THEN 'submission'
  WHEN entity_type = 'application' AND changes->'status'->>'to' = 'RESUBMITTED' THEN 'resubmission'
  WHEN entity_type = 'application' AND (action = 'acknowledge' OR changes->'status'->>'to' IN ('I_ACKNOWLEDGED','A_ACKNOWLEDGED')) THEN 'acknowledgement'
  WHEN entity_type = 'application' AND (action = 'reject' OR changes->'status'->>'to' IN ('I_REJECTED','A_REJECTED')) THEN 'rejection'
  WHEN entity_type = 'application' AND changes->'status'->>'to' = 'ACCEPTED' THEN 'admission'
  WHEN entity_type = 'application' AND action = 'verify-payment' THEN 'verification'
  WHEN entity_type IN ('application','application-bundle','program-choices','education-record','examination-record','examination-result','demographic-profile','display-currency','application-comment') THEN 'application'
  WHEN entity_type IN ('fee-payment','tuition-payment','tuition-account') AND action IN ('approve','reject','verify','verify-payment','query','reopen','review') THEN 'verification'
  WHEN entity_type IN ('fee-payment','tuition-payment','tuition-account') THEN 'payment'
  WHEN entity_type = 'application-document' AND action = 'review' THEN 'verification'
  WHEN entity_type = 'application-document' OR entity_type = 'file' THEN 'upload'
  WHEN entity_type = 'medical-record' THEN 'verification'
  WHEN entity_type IN ('deliberation','deliberation-run','deliberation-subscription') THEN 'deliberation'
  WHEN entity_type = 'admission' THEN 'admission'
  WHEN entity_type = 'matriculation' THEN 'matriculation'
  WHEN entity_type IN ('settings','parameter','country','currency','exchange-rate','fee','institution','faculty','department','program','payment-method','payment method','institution-payment-method','upload-requirement','upload requirement','notification-template','tuition-requirement','medical-requirement','admission-rule') THEN 'configuration'
  WHEN entity_type IN ('document','notification-delivery') THEN 'documents'
  ELSE 'other' END;
--> statement-breakpoint
UPDATE "audit_log" a SET "actor_label" = u.full_name || ' <' || u.email || '>' FROM "users" u WHERE u.id = a.actor_user_id AND a.actor_label IS NULL;
--> statement-breakpoint
-- The trail is append-only: no entry can be changed or deleted, by the application or anyone with database access short of the owner dropping the trigger.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: entries cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_change ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON "audit_log" FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_no_truncate ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON "audit_log" FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint
-- Each institution starts with the qualifications its programs already lead to, so nothing it offers today is refused.
INSERT INTO "institution_qualifications" ("institution_id", "qualification_id") SELECT DISTINCT "institution_id", "qualification_id" FROM "programs" ON CONFLICT DO NOTHING;
