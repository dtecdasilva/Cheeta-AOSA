CREATE TABLE "exchange_rate_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(24, 12) NOT NULL,
	"from_amount" numeric(18, 4) NOT NULL,
	"to_amount" numeric(18, 4) NOT NULL,
	"derivation" text NOT NULL,
	"rate_id" text,
	"via_rate_id" text,
	"source" text DEFAULT '' NOT NULL,
	"rate_effective_from" timestamp with time zone NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliberation_name_charges" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"application_institution_id" text NOT NULL,
	"fee" integer NOT NULL,
	"charged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deliberation_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"subscription_fee" integer NOT NULL,
	"per_name_fee" integer NOT NULL,
	"payment_reference" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"requested_by" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institutions" ALTER COLUMN "web_fee" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "institutions" ALTER COLUMN "web_fee" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "applicant_profiles" ADD COLUMN "display_currency" text;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD COLUMN "to_currency" text DEFAULT 'XAF' NOT NULL;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD COLUMN "effective_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_configs" ADD COLUMN "effective_to" date;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "branch" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "verification_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "application_fees" ADD COLUMN "fee_currency" text DEFAULT 'XAF' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_fees" ADD COLUMN "fee_amount" integer;--> statement-breakpoint
ALTER TABLE "application_fees" ADD COLUMN "fee_rate" numeric(24, 12);--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "payment_account" jsonb;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "paid_from" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "currency" text DEFAULT 'XAF' NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "fee_rate_snapshot_id" text;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN "display_rate_snapshot_id" text;--> statement-breakpoint
ALTER TABLE "exchange_rate_snapshots" ADD CONSTRAINT "exchange_rate_snapshots_rate_id_exchange_rates_id_fk" FOREIGN KEY ("rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rate_snapshots" ADD CONSTRAINT "exchange_rate_snapshots_via_rate_id_exchange_rates_id_fk" FOREIGN KEY ("via_rate_id") REFERENCES "public"."exchange_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_name_charges" ADD CONSTRAINT "deliberation_name_charges_subscription_id_deliberation_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."deliberation_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_name_charges" ADD CONSTRAINT "deliberation_name_charges_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_name_charges" ADD CONSTRAINT "deliberation_name_charges_application_institution_id_application_institutions_id_fk" FOREIGN KEY ("application_institution_id") REFERENCES "public"."application_institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_subscriptions" ADD CONSTRAINT "deliberation_subscriptions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_subscriptions" ADD CONSTRAINT "deliberation_subscriptions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliberation_subscriptions" ADD CONSTRAINT "deliberation_subscriptions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_rate_snapshots_pair_idx" ON "exchange_rate_snapshots" USING btree ("from_currency","to_currency","taken_at");--> statement-breakpoint
CREATE UNIQUE INDEX "deliberation_name_charges_unique" ON "deliberation_name_charges" USING btree ("subscription_id","application_institution_id");--> statement-breakpoint
CREATE INDEX "deliberation_name_charges_institution_idx" ON "deliberation_name_charges" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "deliberation_subscriptions_institution_idx" ON "deliberation_subscriptions" USING btree ("institution_id","status");--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_to_currency_currencies_code_fk" FOREIGN KEY ("to_currency") REFERENCES "public"."currencies"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ADD CONSTRAINT "institution_payment_methods_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_fee_rate_snapshot_id_exchange_rate_snapshots_id_fk" FOREIGN KEY ("fee_rate_snapshot_id") REFERENCES "public"."exchange_rate_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_display_rate_snapshot_id_exchange_rate_snapshots_id_fk" FOREIGN KEY ("display_rate_snapshot_id") REFERENCES "public"."exchange_rate_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exchange_rates_pair_idx" ON "exchange_rates" USING btree ("currency_code","to_currency","as_of");