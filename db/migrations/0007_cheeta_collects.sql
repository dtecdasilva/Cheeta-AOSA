CREATE TABLE "institution_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"paid_on" date NOT NULL,
	"payout_account_id" text,
	"payout_account" jsonb,
	"reference" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institution_payment_methods" ALTER COLUMN "institution_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "institution_payouts" ADD CONSTRAINT "institution_payouts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_payouts" ADD CONSTRAINT "institution_payouts_payout_account_id_institution_payment_methods_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."institution_payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_payouts" ADD CONSTRAINT "institution_payouts_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_payouts" ADD CONSTRAINT "institution_payouts_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "institution_payouts_institution_idx" ON "institution_payouts" USING btree ("institution_id","paid_on");