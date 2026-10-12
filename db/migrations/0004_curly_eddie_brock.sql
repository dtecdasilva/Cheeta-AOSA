CREATE TABLE "application_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"application_institution_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"visible_to_applicant" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_contents" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "fee_payments_reference_unique";--> statement-breakpoint
ALTER TABLE "upload_requirements" ADD COLUMN "document_type_id" text;--> statement-breakpoint
ALTER TABLE "application_documents" ADD COLUMN "applicant_id" text;--> statement-breakpoint
ALTER TABLE "application_documents" ADD COLUMN "application_id" text;--> statement-breakpoint
ALTER TABLE "application_documents" ADD COLUMN "institution_id" text;--> statement-breakpoint
ALTER TABLE "application_documents" ADD COLUMN "document_type_id" text;--> statement-breakpoint
ALTER TABLE "application_documents" ADD COLUMN "rejection_reason_id" text;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "application_number" text;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "declaration_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "declaration_version" text;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "payment_verification" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "payment_verified_by" text;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "payment_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD COLUMN "payment_verification_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "rejection_reason_id" text;--> statement-breakpoint
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_comments" ADD CONSTRAINT "application_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_comments_app_idx" ON "application_comments" USING btree ("application_institution_id","created_at");--> statement-breakpoint
CREATE INDEX "application_comments_institution_idx" ON "application_comments" USING btree ("institution_id");--> statement-breakpoint
ALTER TABLE "upload_requirements" ADD CONSTRAINT "upload_requirements_document_type_id_parameters_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_document_type_id_parameters_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_rejection_reason_id_parameters_id_fk" FOREIGN KEY ("rejection_reason_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_institutions" ADD CONSTRAINT "application_institutions_payment_verified_by_users_id_fk" FOREIGN KEY ("payment_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_rejection_reason_id_parameters_id_fk" FOREIGN KEY ("rejection_reason_id") REFERENCES "public"."parameters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "upload_requirements_institution_type_unique" ON "upload_requirements" USING btree ("institution_id","document_type_id") WHERE "upload_requirements"."document_type_id" is not null;--> statement-breakpoint
CREATE INDEX "application_documents_applicant_idx" ON "application_documents" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "application_documents_institution_idx" ON "application_documents" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "application_documents_file_idx" ON "application_documents" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_institutions_number_unique" ON "application_institutions" USING btree ("application_number");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_live_reference_unique" ON "fee_payments" USING btree ("application_institution_id","reference") WHERE "fee_payments"."approval" <> 'REJECTED';