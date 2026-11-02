ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Accounts that have never signed in are still on the emailed temporary code.
UPDATE "users" SET "must_change_password" = true WHERE "last_sign_in_at" IS NULL;
