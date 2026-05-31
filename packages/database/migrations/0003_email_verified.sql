ALTER TABLE "users" RENAME COLUMN "email_verified_at" TO "email_verified";
ALTER TABLE "users" ALTER COLUMN "email_verified" TYPE boolean USING (email_verified IS NOT NULL);
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;
