ALTER TABLE "institutions" ADD COLUMN "logo_file_id" text;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "motto" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;