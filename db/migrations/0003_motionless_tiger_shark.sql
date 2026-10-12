DROP INDEX "examination_results_user_type_subject_unique";--> statement-breakpoint
ALTER TABLE "examination_results" ADD COLUMN "sitting_id" text;--> statement-breakpoint
ALTER TABLE "examination_results" ADD CONSTRAINT "examination_results_sitting_id_examination_sittings_id_fk" FOREIGN KEY ("sitting_id") REFERENCES "public"."examination_sittings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "examination_results_sitting_subject_unique" ON "examination_results" USING btree ("sitting_id","subject");