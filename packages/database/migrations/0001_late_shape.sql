ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirm_token" text;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN "unsubscribe_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_confirm_token_unique" UNIQUE("confirm_token");--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token");