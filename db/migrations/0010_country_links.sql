ALTER TABLE "parameters" ADD COLUMN "country_id" text;--> statement-breakpoint
ALTER TABLE "parameters" ADD CONSTRAINT "parameters_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parameters_country_idx" ON "parameters" USING btree ("country_id");--> statement-breakpoint
-- Until now a region or an accrediting body had no country. Every one that exists today is Cameroon's, so link them to it
-- (when Cameroon is on the countries list; otherwise they are left empty). Anything added from now on chooses its country.
UPDATE "parameters" SET "country_id" = (SELECT "id" FROM "countries" WHERE "iso2" = 'CM' LIMIT 1) WHERE "category" IN ('regions', 'accreditation-bodies') AND "country_id" IS NULL;
