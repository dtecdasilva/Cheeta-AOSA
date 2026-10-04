CREATE TABLE "applicant_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"registration_no" text NOT NULL,
	"institution_type" text NOT NULL,
	"mobile_number" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"gender" text,
	"date_of_birth" date,
	"region_id" text,
	"town_id" text,
	"address" text DEFAULT '' NOT NULL,
	"highest_qualification" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'Self-registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applicant_profiles_institution_type_check" CHECK ("applicant_profiles"."institution_type" in ('Secondary School', 'High School', 'University', 'Vocational School', 'Professional School'))
);
--> statement-breakpoint
CREATE TABLE "credential_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"destination" text NOT NULL,
	"status" text DEFAULT 'SENT' NOT NULL,
	"provider_ref" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_staff" (
	"user_id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"staff_no" text NOT NULL,
	"position" text NOT NULL,
	"title" text,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"phone" text,
	"institution_id" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('STUDENT', 'INSTITUTION_ADMIN', 'INSTITUTION_ADMISSION_USER', 'AOSA_ADMIN')),
	CONSTRAINT "users_institution_staff_check" CHECK ("users"."role" in ('STUDENT', 'AOSA_ADMIN') or "users"."institution_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"iso2" text NOT NULL,
	"dial_code" text NOT NULL,
	"region" text NOT NULL,
	"currency_code" text DEFAULT '' NOT NULL,
	"nationality" boolean DEFAULT true NOT NULL,
	"residence" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimal_digits" smallint DEFAULT 2 NOT NULL,
	"symbol_position" text DEFAULT 'prefix' NOT NULL,
	"display_to_applicants" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "education_levels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "education_qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"education_level_id" text NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"currency_code" text NOT NULL,
	"xaf_per_unit" numeric(18, 6) NOT NULL,
	"source" text NOT NULL,
	"as_of" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "parameters" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"parent_id" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"faculty_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"head" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculties" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"dean" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"amount" integer NOT NULL,
	"effective_date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"provider" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"swift" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"accepts_tuition" boolean DEFAULT false NOT NULL,
	"verification" text DEFAULT 'PENDING' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type_id" text NOT NULL,
	"accreditation_body_id" text NOT NULL,
	"accreditation_code" text NOT NULL,
	"address" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"region_id" text NOT NULL,
	"town_id" text NOT NULL,
	"quarter_id" text,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"web_fee" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"faculty_id" text NOT NULL,
	"department_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"qualification_id" text NOT NULL,
	"duration_years" real NOT NULL,
	"study_mode" text NOT NULL,
	"language" text NOT NULL,
	"available_spaces" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"file_types" text[] NOT NULL,
	"max_size_kb" integer NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"application_institution_id" text NOT NULL,
	"requirement_id" text,
	"requirement_name" text NOT NULL,
	"file_id" text NOT NULL,
	"review_status" text DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_institutions" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'INCOMPLETE' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_institutions_status_check" CHECK ("application_institutions"."status" in ('INCOMPLETE', 'COMPLETED', 'SUBMITTED', 'RESUBMITTED', 'I_ACKNOWLEDGED', 'I_REJECTED', 'ACCEPTED', 'A_ACKNOWLEDGED', 'A_REJECTED'))
);
--> statement-breakpoint
CREATE TABLE "application_status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"application_institution_id" text NOT NULL,
	"status" text NOT NULL,
	"actor" text NOT NULL,
	"actor_user_id" text,
	"note" text DEFAULT '' NOT NULL,
	"reason_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"applicant_id" text NOT NULL,
	"academic_year_id" text,
	"reference" text NOT NULL,
	"steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demographic_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"full_name_on_birth_certificate" text DEFAULT '' NOT NULL,
	"date_of_birth" text DEFAULT '' NOT NULL,
	"place_of_birth" text DEFAULT '' NOT NULL,
	"country_of_birth" text DEFAULT '' NOT NULL,
	"po_box" text DEFAULT '' NOT NULL,
	"alternative_telephone" text DEFAULT '' NOT NULL,
	"disability" text DEFAULT '' NOT NULL,
	"disability_details" text DEFAULT '' NOT NULL,
	"country_of_residence" text DEFAULT '' NOT NULL,
	"nationality" text DEFAULT '' NOT NULL,
	"region_of_origin" text DEFAULT '' NOT NULL,
	"division_of_origin" text DEFAULT '' NOT NULL,
	"town_of_residence" text DEFAULT '' NOT NULL,
	"religion" text DEFAULT '' NOT NULL,
	"marital_status" text DEFAULT '' NOT NULL,
	"sex" text DEFAULT '' NOT NULL,
	"fathers_names" text DEFAULT '' NOT NULL,
	"mothers_names" text DEFAULT '' NOT NULL,
	"parents_country" text DEFAULT '' NOT NULL,
	"parents_town_city" text DEFAULT '' NOT NULL,
	"parents_address" text DEFAULT '' NOT NULL,
	"parents_occupation" text DEFAULT '' NOT NULL,
	"parents_telephone" text DEFAULT '' NOT NULL,
	"parents_email" text DEFAULT '' NOT NULL,
	"preferred_language" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_year" text NOT NULL,
	"end_year" text NOT NULL,
	"school_name" text NOT NULL,
	"country" text NOT NULL,
	"school_type" text NOT NULL,
	"qualification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examination_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exam_type_id" text NOT NULL,
	"year" smallint NOT NULL,
	"centre_number" text DEFAULT '' NOT NULL,
	"candidate_number" text DEFAULT '' NOT NULL,
	"sittings" smallint DEFAULT 1 NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_choices" (
	"id" text PRIMARY KEY NOT NULL,
	"application_institution_id" text NOT NULL,
	"program_id" text NOT NULL,
	"rank" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_choices_rank_check" CHECK ("program_choices"."rank" in ('1', '2', '3'))
);
--> statement-breakpoint
CREATE TABLE "fee_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"application_institution_id" text NOT NULL,
	"method" text NOT NULL,
	"payment_method_id" text,
	"reference" text NOT NULL,
	"receipt_file_id" text,
	"application_fee" integer NOT NULL,
	"web_fee" integer NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approval" text DEFAULT 'AWAITING' NOT NULL,
	"bank_code" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission_rule_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"version" integer NOT NULL,
	"condition" jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admission_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admissions" (
	"id" text PRIMARY KEY NOT NULL,
	"application_institution_id" text NOT NULL,
	"program_id" text NOT NULL,
	"choice" smallint NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"deliberation_run_id" text,
	"offered_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"letter_file_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliberation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"rule_version_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"results" jsonb DEFAULT '{"accepted":[],"unsuccessful":[],"firstChoice":[],"secondChoice":[],"thirdChoice":[]}'::jsonb NOT NULL,
	"run_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matriculations" (
	"id" text PRIMARY KEY NOT NULL,
	"tuition_account_id" text NOT NULL,
	"code" text NOT NULL,
	"matriculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_by" text,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_events" (
	"id" text PRIMARY KEY NOT NULL,
	"medical_record_id" text NOT NULL,
	"by_user_id" text,
	"by_role" text NOT NULL,
	"status" text NOT NULL,
	"result" text,
	"note" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_records" (
	"id" text PRIMARY KEY NOT NULL,
	"tuition_account_id" text NOT NULL,
	"requirement_code" text NOT NULL,
	"status" text DEFAULT 'NOT_STARTED' NOT NULL,
	"result" text,
	"verification_date" date,
	"centre" text,
	"certificate_ref" text,
	"certificate_file_id" text,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuition_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"admission_id" text NOT NULL,
	"academic_year_id" text,
	"fee_category_id" text,
	"tuition_amount" integer NOT NULL,
	"instalments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"offer_accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuition_payment_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"action" text NOT NULL,
	"by_user_id" text,
	"by_role" text NOT NULL,
	"reason_id" text,
	"note" text DEFAULT '' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuition_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"payment_method_id" text,
	"reference" text NOT NULL,
	"amount" integer NOT NULL,
	"paid_on" date NOT NULL,
	"payer_name" text NOT NULL,
	"receipt_file_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"bank_code" text,
	"received_at" timestamp with time zone,
	"received_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"channel" text NOT NULL,
	"destination" text NOT NULL,
	"status" text NOT NULL,
	"detail" text,
	"provider_ref" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"event" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_user_id" text,
	"audience" text NOT NULL,
	"institution_id" text,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"action" jsonb,
	"reference" text,
	"template_code" text,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"institution_id" text,
	"purpose" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"storage_driver" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"institution_id" text,
	"changes" jsonb,
	"meta" jsonb,
	"request_id" text,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD CONSTRAINT "applicant_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_deliveries" ADD CONSTRAINT "credential_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_staff" ADD CONSTRAINT "institution_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_staff" ADD CONSTRAINT "institution_staff_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_qualifications" ADD CONSTRAINT "education_qualifications_education_level_id_education_levels_id_fk" FOREIGN KEY ("education_level_id") REFERENCES "public"."education_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameters" ADD CONSTRAINT "parameters_parent_id_parameters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_configs" ADD CONSTRAINT "fee_configs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD CONSTRAINT "institution_payment_methods_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_type_id_parameters_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_accreditation_body_id_parameters_id_fk" FOREIGN KEY ("accreditation_body_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_region_id_parameters_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_town_id_parameters_id_fk" FOREIGN KEY ("town_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_quarter_id_parameters_id_fk" FOREIGN KEY ("quarter_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_qualification_id_parameters_id_fk" FOREIGN KEY ("qualification_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requirements" ADD CONSTRAINT "upload_requirements_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_requirement_id_upload_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."upload_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD CONSTRAINT "application_institutions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD CONSTRAINT "application_institutions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_events" ADD CONSTRAINT "application_status_events_reason_id_parameters_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_academic_year_id_parameters_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demographic_profiles" ADD CONSTRAINT "demographic_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examination_records" ADD CONSTRAINT "examination_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_choices" ADD CONSTRAINT "program_choices_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_choices" ADD CONSTRAINT "program_choices_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_receipt_file_id_files_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_rule_versions" ADD CONSTRAINT "admission_rule_versions_rule_id_admission_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."admission_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_rule_versions" ADD CONSTRAINT "admission_rule_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_rules" ADD CONSTRAINT "admission_rules_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_deliberation_run_id_deliberation_runs_id_fk" FOREIGN KEY ("deliberation_run_id") REFERENCES "public"."deliberation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_letter_file_id_files_id_fk" FOREIGN KEY ("letter_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD CONSTRAINT "deliberation_runs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD CONSTRAINT "deliberation_runs_rule_version_id_admission_rule_versions_id_fk" FOREIGN KEY ("rule_version_id") REFERENCES "public"."admission_rule_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_runs" ADD CONSTRAINT "deliberation_runs_run_by_users_id_fk" FOREIGN KEY ("run_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_tuition_account_id_tuition_accounts_id_fk" FOREIGN KEY ("tuition_account_id") REFERENCES "public"."tuition_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matriculations" ADD CONSTRAINT "matriculations_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_medical_record_id_medical_records_id_fk" FOREIGN KEY ("medical_record_id") REFERENCES "public"."medical_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_tuition_account_id_tuition_accounts_id_fk" FOREIGN KEY ("tuition_account_id") REFERENCES "public"."tuition_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_certificate_file_id_files_id_fk" FOREIGN KEY ("certificate_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD CONSTRAINT "tuition_accounts_admission_id_admissions_id_fk" FOREIGN KEY ("admission_id") REFERENCES "public"."admissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD CONSTRAINT "tuition_accounts_academic_year_id_parameters_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_accounts" ADD CONSTRAINT "tuition_accounts_fee_category_id_parameters_id_fk" FOREIGN KEY ("fee_category_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payment_reviews" ADD CONSTRAINT "tuition_payment_reviews_payment_id_tuition_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."tuition_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payment_reviews" ADD CONSTRAINT "tuition_payment_reviews_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payment_reviews" ADD CONSTRAINT "tuition_payment_reviews_reason_id_parameters_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_account_id_tuition_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tuition_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_payment_method_id_institution_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."institution_payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_receipt_file_id_files_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tuition_payments" ADD CONSTRAINT "tuition_payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applicant_profiles_registration_no_unique" ON "applicant_profiles" USING btree ("registration_no");--> statement-breakpoint
CREATE INDEX "credential_deliveries_user_idx" ON "credential_deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_staff_no_unique" ON "institution_staff" USING btree ("institution_id","staff_no");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_institution_idx" ON "users" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso2_unique" ON "countries" USING btree ("iso2");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_name_unique" ON "countries" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "education_qualifications_level_label_unique" ON "education_qualifications" USING btree ("education_level_id","label");--> statement-breakpoint
CREATE INDEX "exchange_rates_currency_asof_idx" ON "exchange_rates" USING btree ("currency_code","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "parameters_category_code_unique" ON "parameters" USING btree ("category","code");--> statement-breakpoint
CREATE INDEX "parameters_parent_idx" ON "parameters" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_institution_code_unique" ON "departments" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX "departments_faculty_idx" ON "departments" USING btree ("faculty_id");--> statement-breakpoint
CREATE UNIQUE INDEX "faculties_institution_code_unique" ON "faculties" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX "fee_configs_institution_idx" ON "fee_configs" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "institution_payment_methods_institution_idx" ON "institution_payment_methods" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_accreditation_code_unique" ON "institutions" USING btree ("accreditation_code");--> statement-breakpoint
CREATE INDEX "institutions_region_idx" ON "institutions" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_institution_code_unique" ON "programs" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX "programs_department_idx" ON "programs" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "upload_requirements_institution_idx" ON "upload_requirements" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "application_documents_app_idx" ON "application_documents" USING btree ("application_institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_institutions_unique" ON "application_institutions" USING btree ("application_id","institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_institutions_reference_unique" ON "application_institutions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "application_institutions_institution_status_idx" ON "application_institutions" USING btree ("institution_id","status");--> statement-breakpoint
CREATE INDEX "application_status_events_app_idx" ON "application_status_events" USING btree ("application_institution_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_reference_unique" ON "applications" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_applicant_year_unique" ON "applications" USING btree ("applicant_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "education_records_user_idx" ON "education_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "examination_records_user_idx" ON "examination_records" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_choices_rank_unique" ON "program_choices" USING btree ("application_institution_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "program_choices_program_unique" ON "program_choices" USING btree ("application_institution_id","program_id");--> statement-breakpoint
CREATE INDEX "fee_payments_app_idx" ON "fee_payments" USING btree ("application_institution_id");--> statement-breakpoint
CREATE INDEX "fee_payments_approval_idx" ON "fee_payments" USING btree ("approval","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_bank_code_unique" ON "fee_payments" USING btree ("bank_code");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_reference_unique" ON "fee_payments" USING btree ("application_institution_id","reference");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_rule_versions_unique" ON "admission_rule_versions" USING btree ("rule_id","version");--> statement-breakpoint
CREATE INDEX "admission_rules_institution_idx" ON "admission_rules" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admissions_application_unique" ON "admissions" USING btree ("application_institution_id");--> statement-breakpoint
CREATE INDEX "deliberation_runs_institution_idx" ON "deliberation_runs" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matriculations_account_unique" ON "matriculations" USING btree ("tuition_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matriculations_code_unique" ON "matriculations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "medical_events_record_idx" ON "medical_events" USING btree ("medical_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "medical_records_requirement_unique" ON "medical_records" USING btree ("tuition_account_id","requirement_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tuition_accounts_admission_unique" ON "tuition_accounts" USING btree ("admission_id");--> statement-breakpoint
CREATE INDEX "tuition_payment_reviews_payment_idx" ON "tuition_payment_reviews" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "tuition_payments_account_idx" ON "tuition_payments" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tuition_payments_bank_code_unique" ON "tuition_payments" USING btree ("bank_code");--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_idx" ON "notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_code_unique" ON "notification_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_audience_idx" ON "notifications" USING btree ("audience","institution_id","created_at");--> statement-breakpoint
CREATE INDEX "files_owner_idx" ON "files" USING btree ("owner_user_id","purpose");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");