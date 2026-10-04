-- Cheeta AOSA: one migration that brings a database from the original schema up to the
-- current code (roles and permissions, sessions and email verification, per-application
-- fees, examinations, country and currency fields). It is the schema change that
-- `npm run db:generate` produces, plus the data steps marked "added by hand", which keep
-- existing rows valid. On an empty database those data steps do nothing.
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"assignable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_key" text NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_key_permission_key_pk" PRIMARY KEY("role_key","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"portal" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_portal_check" CHECK ("roles"."portal" in ('STUDENT', 'INSTITUTION', 'ADMIN'))
);
--> statement-breakpoint
CREATE TABLE "administrator_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"position" text,
	"department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"granted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_key_pk" PRIMARY KEY("user_id","permission_key")
);
--> statement-breakpoint
-- Data step (added by hand): existing accounts already hold these roles, so the
-- rows must exist before users.role becomes a foreign key. Names, descriptions
-- and the full permission list are filled in from the code when the server starts.
INSERT INTO "roles" ("key", "name", "portal") VALUES
	('STUDENT', 'Student / Applicant', 'STUDENT'),
	('INSTITUTION_ADMIN', 'Institution Administrator', 'INSTITUTION'),
	('INSTITUTION_ADMISSION_USER', 'Institution Admission User', 'INSTITUTION'),
	('AOSA_ADMIN', 'Cheeta / AOSA Administrator', 'ADMIN')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "permissions" ("key", "label", "assignable") VALUES
	('PAYMENTS_UPLOADS', 'Student payments and uploads', true),
	('ACKNOWLEDGED_APPS', 'Acknowledged applications', true),
	('REJECTED_APPS', 'Rejected applications', true),
	('DELIBERATION', 'Deliberation list', true)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_check";--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "administrator_profiles" ADD CONSTRAINT "administrator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE INDEX "roles_portal_idx" ON "roles" USING btree ("portal");--> statement-breakpoint
CREATE INDEX "user_permissions_permission_idx" ON "user_permissions" USING btree ("permission_key");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "institution_staff_institution_idx" ON "institution_staff" USING btree ("institution_id");--> statement-breakpoint
-- Data step (added by hand): keep what each admission user was allowed to do, and
-- give existing administrators their profile row, before the old column is dropped.
INSERT INTO "user_permissions" ("user_id", "permission_key")
SELECT s."user_id", p."key"
FROM "institution_staff" s
JOIN "users" u ON u."id" = s."user_id" AND u."role" = 'INSTITUTION_ADMISSION_USER'
JOIN "permissions" p ON p."key" = ANY (s."permissions")
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "administrator_profiles" ("user_id")
SELECT "id" FROM "users" WHERE "role" = 'AOSA_ADMIN'
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "institution_staff" DROP COLUMN "permissions";
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "application_fees" (
	"application_institution_id" text PRIMARY KEY NOT NULL,
	"fee_config_id" text,
	"application_fee" integer NOT NULL,
	"web_fee" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliberation_results" (
	"id" text PRIMARY KEY NOT NULL,
	"deliberation_run_id" text NOT NULL,
	"application_institution_id" text NOT NULL,
	"outcome" text NOT NULL,
	"choice" smallint,
	"program_id" text,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fees" ADD CONSTRAINT "application_fees_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_fees" ADD CONSTRAINT "application_fees_fee_config_id_fee_configs_id_fk" FOREIGN KEY ("fee_config_id") REFERENCES "public"."fee_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_results" ADD CONSTRAINT "deliberation_results_deliberation_run_id_deliberation_runs_id_fk" FOREIGN KEY ("deliberation_run_id") REFERENCES "public"."deliberation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_results" ADD CONSTRAINT "deliberation_results_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_results" ADD CONSTRAINT "deliberation_results_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deliberation_results_run_application_unique" ON "deliberation_results" USING btree ("deliberation_run_id","application_institution_id");--> statement-breakpoint
CREATE INDEX "deliberation_results_application_idx" ON "deliberation_results" USING btree ("application_institution_id");--> statement-breakpoint
-- Data step (added by hand): the rule below is one the app already follows, but make
-- sure no applicant or administrator row carries an institution before it is enforced.
UPDATE "users" SET "institution_id" = NULL
WHERE "role" NOT IN ('INSTITUTION_ADMIN', 'INSTITUTION_ADMISSION_USER') AND "institution_id" IS NOT NULL;--> statement-breakpoint
-- Data step (added by hand): accounts that have already signed in did so with a password
-- that only ever reached them by email, so their address counts as verified.
UPDATE "users" SET "email_verified_at" = "last_sign_in_at"
WHERE "last_sign_in_at" IS NOT NULL AND "email_verified_at" IS NULL;--> statement-breakpoint
-- Data step (added by hand): give every existing application its fee row. Where a payment
-- was recorded, the fee is what was paid; otherwise the institution's current application
-- fee (or the platform default) plus its web fee, as the portal works it out.
INSERT INTO "application_fees" ("application_institution_id", "fee_config_id", "application_fee", "web_fee", "amount", "assessed_at")
SELECT ai."id",
	CASE WHEN p."id" IS NULL THEN fc."id" END,
	COALESCE(p."application_fee", fc."amount", d."amount", 0),
	COALESCE(p."web_fee", i."web_fee"),
	COALESCE(p."application_fee", fc."amount", d."amount", 0) + COALESCE(p."web_fee", i."web_fee"),
	COALESCE(p."submitted_at", ai."created_at")
FROM "application_institutions" ai
JOIN "institutions" i ON i."id" = ai."institution_id"
LEFT JOIN LATERAL (
	SELECT fp."id", fp."application_fee", fp."web_fee", fp."submitted_at" FROM "fee_payments" fp
	WHERE fp."application_institution_id" = ai."id" AND fp."approval" <> 'REJECTED'
	ORDER BY fp."submitted_at" DESC LIMIT 1
) p ON true
LEFT JOIN LATERAL (
	SELECT f."id", f."amount" FROM "fee_configs" f
	WHERE f."institution_id" = ai."institution_id" AND f."type" = 'application' AND f."category" = 'national'
		AND f."status" = 'ACTIVE' AND f."effective_date" <= CURRENT_DATE
	ORDER BY f."effective_date" DESC LIMIT 1
) fc ON true
LEFT JOIN LATERAL (
	SELECT NULLIF(pa."attrs"->>'defaultAmount', '')::integer AS "amount" FROM "parameters" pa WHERE pa."id" = 'fee-types:APP'
) d ON true
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_non_staff_no_institution_check" CHECK ("users"."role" in ('INSTITUTION_ADMIN', 'INSTITUTION_ADMISSION_USER') or "users"."institution_id" is null);
--> statement-breakpoint
CREATE TABLE "examination_results" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exam_type_id" text NOT NULL,
	"subject" text NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"result_type_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examination_sitting_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"sitting_id" text NOT NULL,
	"subject" text NOT NULL,
	"value" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examination_sittings" (
	"id" text PRIMARY KEY NOT NULL,
	"examination_record_id" text NOT NULL,
	"sitting_no" smallint NOT NULL,
	"year" smallint NOT NULL,
	"candidate_number" text NOT NULL,
	"centre_number" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "iso3" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "countries" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Data step (added by hand): give the countries already in the database their
-- three-letter code and the display order the pickers have always used.
UPDATE "countries" c SET "iso3" = v."iso3", "sort_order" = v."sort_order"
FROM (VALUES
	('CM', 'CMR', 10),
	('NG', 'NGA', 20),
	('TD', 'TCD', 30),
	('CF', 'CAF', 40),
	('GQ', 'GNQ', 50),
	('GA', 'GAB', 60),
	('CG', 'COG', 70),
	('CD', 'COD', 80),
	('BJ', 'BEN', 90),
	('TG', 'TGO', 100),
	('GH', 'GHA', 110),
	('CI', 'CIV', 120),
	('SN', 'SEN', 130),
	('ML', 'MLI', 140),
	('BF', 'BFA', 150),
	('NE', 'NER', 160),
	('GN', 'GIN', 170),
	('SL', 'SLE', 180),
	('LR', 'LBR', 190),
	('GM', 'GMB', 200),
	('GW', 'GNB', 210),
	('MR', 'MRT', 220),
	('MA', 'MAR', 230),
	('DZ', 'DZA', 240),
	('TN', 'TUN', 250),
	('LY', 'LBY', 260),
	('EG', 'EGY', 270),
	('SD', 'SDN', 280),
	('SS', 'SSD', 290),
	('ET', 'ETH', 300),
	('ER', 'ERI', 310),
	('SO', 'SOM', 320),
	('KE', 'KEN', 330),
	('UG', 'UGA', 340),
	('RW', 'RWA', 350),
	('BI', 'BDI', 360),
	('TZ', 'TZA', 370),
	('ZM', 'ZMB', 380),
	('MW', 'MWI', 390),
	('MZ', 'MOZ', 400),
	('ZW', 'ZWE', 410),
	('BW', 'BWA', 420),
	('NA', 'NAM', 430),
	('ZA', 'ZAF', 440),
	('AO', 'AGO', 450),
	('MG', 'MDG', 460),
	('US', 'USA', 470),
	('CA', 'CAN', 480),
	('GB', 'GBR', 490),
	('FR', 'FRA', 500),
	('DE', 'DEU', 510),
	('BE', 'BEL', 520),
	('CH', 'CHE', 530),
	('IT', 'ITA', 540),
	('ES', 'ESP', 550),
	('PT', 'PRT', 560),
	('NL', 'NLD', 570),
	('SE', 'SWE', 580),
	('CN', 'CHN', 590),
	('IN', 'IND', 600),
	('AE', 'ARE', 610),
	('SA', 'SAU', 620),
	('QA', 'QAT', 630),
	('TR', 'TUR', 640),
	('LB', 'LBN', 650),
	('BR', 'BRA', 660)
) AS v("iso2", "iso3", "sort_order")
WHERE c."iso2" = v."iso2" AND c."iso3" = '' AND c."sort_order" = 0;--> statement-breakpoint
ALTER TABLE "examination_results" ADD CONSTRAINT "examination_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examination_results" ADD CONSTRAINT "examination_results_result_type_id_parameters_id_fk" FOREIGN KEY ("result_type_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examination_sitting_subjects" ADD CONSTRAINT "examination_sitting_subjects_sitting_id_examination_sittings_id_fk" FOREIGN KEY ("sitting_id") REFERENCES "public"."examination_sittings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examination_sittings" ADD CONSTRAINT "examination_sittings_examination_record_id_examination_records_id_fk" FOREIGN KEY ("examination_record_id") REFERENCES "public"."examination_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "examination_results_user_idx" ON "examination_results" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "examination_results_user_type_subject_unique" ON "examination_results" USING btree ("user_id","exam_type_id","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "examination_sitting_subjects_unique" ON "examination_sitting_subjects" USING btree ("sitting_id","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "examination_sittings_record_no_unique" ON "examination_sittings" USING btree ("examination_record_id","sitting_no");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso3_unique" ON "countries" USING btree ("iso3") WHERE "countries"."iso3" <> '';--> statement-breakpoint
CREATE INDEX "countries_sort_idx" ON "countries" USING btree ("sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "examination_records_user_type_unique" ON "examination_records" USING btree ("user_id","exam_type_id");--> statement-breakpoint
-- Data step (added by hand): carry any examination already recorded in the old
-- single-sitting shape into the new tables before its columns are dropped.
INSERT INTO "examination_sittings" ("id", "examination_record_id", "sitting_no", "year", "candidate_number", "centre_number")
SELECT 'sit_' || r."id", r."id", 1, r."year", r."candidate_number", r."centre_number" FROM "examination_records" r
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "examination_sitting_subjects" ("id", "sitting_id", "subject", "value", "position")
SELECT 'sub_' || r."id" || '_' || (e."ord" - 1), 'sit_' || r."id", e."item"->>'subject', COALESCE(e."item"->>'grade', e."item"->>'score', ''), (e."ord" - 1)::smallint
FROM "examination_records" r, jsonb_array_elements(r."results") WITH ORDINALITY AS e("item", "ord")
WHERE COALESCE(e."item"->>'subject', '') <> ''
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "examination_records" DROP COLUMN "year";--> statement-breakpoint
ALTER TABLE "examination_records" DROP COLUMN "centre_number";--> statement-breakpoint
ALTER TABLE "examination_records" DROP COLUMN "candidate_number";--> statement-breakpoint
ALTER TABLE "examination_records" DROP COLUMN "sittings";--> statement-breakpoint
ALTER TABLE "examination_records" DROP COLUMN "results";--> statement-breakpoint
-- Data step (added by hand): the new Examination types list, for a database that is
-- already in use. An empty database is left empty here: it gets these from the seed, and
-- the seed only runs while the parameters table has no rows.
INSERT INTO "parameters" ("id", "category", "code", "label", "sort_order", "attrs")
SELECT v."id", 'examination-types', v."code", v."label", v."sort_order", v."attrs"::jsonb
FROM (VALUES
	('examination-types:GCE_OL', 'GCE_OL', 'GCE Ordinary Level', 1, '{"defaultSittings": 1, "maxSittings": 3}'),
	('examination-types:GCE_AL', 'GCE_AL', 'GCE Advanced Level', 2, '{"defaultSittings": 1, "maxSittings": 3}'),
	('examination-types:BEPC', 'BEPC', 'BEPC', 3, '{"defaultSittings": 1, "maxSittings": 2}'),
	('examination-types:PROBATOIRE', 'PROBATOIRE', 'Probatoire', 4, '{"defaultSittings": 1, "maxSittings": 2}'),
	('examination-types:BAC', 'BAC', 'Baccalauréat', 5, '{"defaultSittings": 1, "maxSittings": 2}')
) AS v("id", "code", "label", "sort_order", "attrs")
WHERE EXISTS (SELECT 1 FROM "parameters")
ON CONFLICT DO NOTHING;