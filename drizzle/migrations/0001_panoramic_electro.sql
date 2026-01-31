CREATE TABLE "free_agent_auction_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"pick_order" integer NOT NULL,
	"player_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"position" "position_enum",
	"team_id" integer NOT NULL,
	"salary" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rookie_draft_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"round" integer NOT NULL,
	"pick" integer NOT NULL,
	"overall_pick" text NOT NULL,
	"team_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"player_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "position" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "salary_year" integer DEFAULT 2025 NOT NULL;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD COLUMN "salary_override" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "primary_color" text DEFAULT '#6366f1';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "secondary_color" text DEFAULT '#818cf8';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "free_agent_auction_history" ADD CONSTRAINT "free_agent_auction_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "free_agent_auction_history" ADD CONSTRAINT "free_agent_auction_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rookie_draft_history" ADD CONSTRAINT "rookie_draft_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rookie_draft_history" ADD CONSTRAINT "rookie_draft_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fa_auction_pick" ON "free_agent_auction_history" USING btree ("year","pick_order");--> statement-breakpoint
CREATE INDEX "idx_fa_auction_year" ON "free_agent_auction_history" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_fa_auction_team" ON "free_agent_auction_history" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rookie_draft_pick" ON "rookie_draft_history" USING btree ("year","round","pick");--> statement-breakpoint
CREATE INDEX "idx_rookie_draft_year" ON "rookie_draft_history" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_rookie_draft_team" ON "rookie_draft_history" USING btree ("team_id");