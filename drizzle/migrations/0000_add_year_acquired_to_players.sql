CREATE TYPE "public"."acquisition_type" AS ENUM('auction', 'rookie_draft', 'free_agent', 'faab', 'trade');--> statement-breakpoint
CREATE TYPE "public"."position_enum" AS ENUM('QB', 'WR', 'RB', 'TE');--> statement-breakpoint
CREATE TYPE "public"."roster_status" AS ENUM('active', 'practice_squad', 'injured_reserve');--> statement-breakpoint
CREATE TYPE "public"."trade_asset_type" AS ENUM('player', 'draft_pick');--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"salary_2025" numeric(10, 2) NOT NULL,
	"year_acquired" integer NOT NULL,
	"acquisition_type" "acquisition_type" NOT NULL,
	"roster_status" "roster_status" DEFAULT 'active' NOT NULL,
	"original_salary_2025" numeric(10, 2),
	"dropped_by_team_id" integer,
	"practice_squad_years" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"dropped_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_pick_salary_scale" (
	"id" serial PRIMARY KEY NOT NULL,
	"round" integer NOT NULL,
	"pick_from" integer NOT NULL,
	"pick_to" integer NOT NULL,
	"base_salary" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"round" integer NOT NULL,
	"pick_number" integer,
	"original_team_id" integer NOT NULL,
	"current_team_id" integer NOT NULL,
	"player_id" integer,
	"is_used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dropped_player_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"dropped_by_team_id" integer NOT NULL,
	"salary_at_drop" numeric(10, 2) NOT NULL,
	"year_dropped" integer NOT NULL,
	"year_acquired" integer NOT NULL,
	"acquisition_type" "acquisition_type" NOT NULL,
	"can_reacquire_cheaper" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" "position_enum" NOT NULL,
	"nfl_team" text,
	"year_acquired" integer DEFAULT 2025 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"year" integer NOT NULL,
	"salary" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"abbreviation" text NOT NULL,
	"owner_name" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique" UNIQUE("name"),
	CONSTRAINT "teams_slug_unique" UNIQUE("slug"),
	CONSTRAINT "teams_abbreviation_unique" UNIQUE("abbreviation")
);
--> statement-breakpoint
CREATE TABLE "trade_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"asset_type" "trade_asset_type" NOT NULL,
	"player_id" integer,
	"contract_id" integer,
	"draft_pick_id" integer,
	"from_team_id" integer NOT NULL,
	"to_team_id" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"team_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_date" date NOT NULL,
	"season" integer NOT NULL,
	"notes" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer,
	"contract_id" integer,
	"action" text NOT NULL,
	"details" jsonb,
	"performed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_dropped_by_team_id_teams_id_fk" FOREIGN KEY ("dropped_by_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_original_team_id_teams_id_fk" FOREIGN KEY ("original_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_current_team_id_teams_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dropped_player_history" ADD CONSTRAINT "dropped_player_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dropped_player_history" ADD CONSTRAINT "dropped_player_history_dropped_by_team_id_teams_id_fk" FOREIGN KEY ("dropped_by_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_overrides" ADD CONSTRAINT "salary_overrides_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_draft_pick_id_draft_picks_id_fk" FOREIGN KEY ("draft_pick_id") REFERENCES "public"."draft_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_from_team_id_teams_id_fk" FOREIGN KEY ("from_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_assets" ADD CONSTRAINT "trade_assets_to_team_id_teams_id_fk" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD CONSTRAINT "trade_participants_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_participants" ADD CONSTRAINT "trade_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_one_active_contract" ON "contracts" USING btree ("player_id") WHERE is_active = true;--> statement-breakpoint
CREATE INDEX "idx_contracts_team" ON "contracts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_player" ON "contracts" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_salary_scale" ON "draft_pick_salary_scale" USING btree ("round","pick_from","pick_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_draft_pick" ON "draft_picks" USING btree ("year","round","original_team_id");--> statement-breakpoint
CREATE INDEX "idx_draft_picks_current_team" ON "draft_picks" USING btree ("current_team_id");--> statement-breakpoint
CREATE INDEX "idx_dropped_history_player" ON "dropped_player_history" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_players_position" ON "players" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_override_per_year" ON "salary_overrides" USING btree ("contract_id","year");--> statement-breakpoint
CREATE INDEX "idx_trade_assets_trade" ON "trade_assets" USING btree ("trade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trade_participant" ON "trade_participants" USING btree ("trade_id","team_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_team" ON "transactions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "transactions" USING btree ("created_at");