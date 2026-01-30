import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  date,
  uuid,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const positionEnum = pgEnum("position_enum", [
  "QB",
  "WR",
  "RB",
  "TE",
]);

export const rosterStatusEnum = pgEnum("roster_status", [
  "active",
  "practice_squad",
  "injured_reserve",
]);

export const acquisitionTypeEnum = pgEnum("acquisition_type", [
  "auction",
  "rookie_draft",
  "free_agent",
  "faab",
  "trade",
]);

export const tradeAssetTypeEnum = pgEnum("trade_asset_type", [
  "player",
  "draft_pick",
]);

// ============================================================
// TABLES
// ============================================================

export const leagueSettings = pgTable("league_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  abbreviation: text("abbreviation").notNull().unique(),
  ownerName: text("owner_name"),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    position: positionEnum("position"),
    nflTeam: text("nfl_team"),
    yearAcquired: integer("year_acquired").notNull().default(2025),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_players_position").on(table.position)]
);

export const contracts = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    salary2025: numeric("salary_2025", { precision: 10, scale: 2 }).notNull(), // Base salary (for the salaryYear)
    salaryYear: integer("salary_year").notNull().default(2025), // Year the salary was entered for
    yearAcquired: integer("year_acquired").notNull(),
    acquisitionType: acquisitionTypeEnum("acquisition_type").notNull(),
    rosterStatus: rosterStatusEnum("roster_status").notNull().default("active"),
    originalSalary2025: numeric("original_salary_2025", { precision: 10, scale: 2 }),
    droppedByTeamId: integer("dropped_by_team_id").references(() => teams.id),
    practiceSquadYears: integer("practice_squad_years").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    droppedAt: timestamp("dropped_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_one_active_contract")
      .on(table.playerId)
      .where(sql`is_active = true`),
    index("idx_contracts_team").on(table.teamId),
    index("idx_contracts_player").on(table.playerId),
  ]
);

export const salaryOverrides = pgTable(
  "salary_overrides",
  {
    id: serial("id").primaryKey(),
    contractId: integer("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    salary: numeric("salary", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_override_per_year").on(table.contractId, table.year),
  ]
);

export const draftPicks = pgTable(
  "draft_picks",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    round: integer("round").notNull(),
    pickNumber: integer("pick_number"),
    originalTeamId: integer("original_team_id")
      .notNull()
      .references(() => teams.id),
    currentTeamId: integer("current_team_id")
      .notNull()
      .references(() => teams.id),
    playerId: integer("player_id").references(() => players.id),
    isUsed: boolean("is_used").notNull().default(false),
    salaryOverride: integer("salary_override"), // For adjusting 1st round pick values
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_draft_pick").on(
      table.year,
      table.round,
      table.originalTeamId
    ),
    index("idx_draft_picks_current_team").on(table.currentTeamId),
  ]
);

export const draftPickSalaryScale = pgTable(
  "draft_pick_salary_scale",
  {
    id: serial("id").primaryKey(),
    round: integer("round").notNull(),
    pickFrom: integer("pick_from").notNull(),
    pickTo: integer("pick_to").notNull(),
    baseSalary: numeric("base_salary", { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [
    uniqueIndex("uq_salary_scale").on(table.round, table.pickFrom, table.pickTo),
  ]
);

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  tradeDate: date("trade_date").notNull(),
  season: integer("season").notNull(),
  notes: text("notes"),
  recordedBy: uuid("recorded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tradeParticipants = pgTable(
  "trade_participants",
  {
    id: serial("id").primaryKey(),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
  },
  (table) => [
    uniqueIndex("uq_trade_participant").on(table.tradeId, table.teamId),
  ]
);

export const tradeAssets = pgTable(
  "trade_assets",
  {
    id: serial("id").primaryKey(),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    assetType: tradeAssetTypeEnum("asset_type").notNull(),
    playerId: integer("player_id").references(() => players.id),
    contractId: integer("contract_id").references(() => contracts.id),
    draftPickId: integer("draft_pick_id").references(() => draftPicks.id),
    fromTeamId: integer("from_team_id")
      .notNull()
      .references(() => teams.id),
    toTeamId: integer("to_team_id")
      .notNull()
      .references(() => teams.id),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_trade_assets_trade").on(table.tradeId)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    playerId: integer("player_id").references(() => players.id),
    contractId: integer("contract_id").references(() => contracts.id),
    action: text("action").notNull(),
    details: jsonb("details"),
    performedBy: uuid("performed_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_transactions_team").on(table.teamId),
    index("idx_transactions_date").on(table.createdAt),
  ]
);

export const droppedPlayerHistory = pgTable(
  "dropped_player_history",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    droppedByTeamId: integer("dropped_by_team_id")
      .notNull()
      .references(() => teams.id),
    salaryAtDrop: numeric("salary_at_drop", {
      precision: 10,
      scale: 2,
    }).notNull(),
    yearDropped: integer("year_dropped").notNull(),
    yearAcquired: integer("year_acquired").notNull(),
    acquisitionType: acquisitionTypeEnum("acquisition_type").notNull(),
    canReacquireCheaper: boolean("can_reacquire_cheaper")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_dropped_history_player").on(table.playerId),
  ]
);

// ============================================================
// RELATIONS
// ============================================================

export const teamsRelations = relations(teams, ({ many }) => ({
  contracts: many(contracts),
  draftPicksOriginal: many(draftPicks, { relationName: "originalTeam" }),
  draftPicksCurrent: many(draftPicks, { relationName: "currentTeam" }),
  transactions: many(transactions),
}));

export const playersRelations = relations(players, ({ many }) => ({
  contracts: many(contracts),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  player: one(players, {
    fields: [contracts.playerId],
    references: [players.id],
  }),
  team: one(teams, {
    fields: [contracts.teamId],
    references: [teams.id],
  }),
  salaryOverrides: many(salaryOverrides),
}));

export const salaryOverridesRelations = relations(
  salaryOverrides,
  ({ one }) => ({
    contract: one(contracts, {
      fields: [salaryOverrides.contractId],
      references: [contracts.id],
    }),
  })
);

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  originalTeam: one(teams, {
    fields: [draftPicks.originalTeamId],
    references: [teams.id],
    relationName: "originalTeam",
  }),
  currentTeam: one(teams, {
    fields: [draftPicks.currentTeamId],
    references: [teams.id],
    relationName: "currentTeam",
  }),
  player: one(players, {
    fields: [draftPicks.playerId],
    references: [players.id],
  }),
}));

export const tradesRelations = relations(trades, ({ many }) => ({
  participants: many(tradeParticipants),
  assets: many(tradeAssets),
}));

export const tradeParticipantsRelations = relations(
  tradeParticipants,
  ({ one }) => ({
    trade: one(trades, {
      fields: [tradeParticipants.tradeId],
      references: [trades.id],
    }),
    team: one(teams, {
      fields: [tradeParticipants.teamId],
      references: [teams.id],
    }),
  })
);

export const tradeAssetsRelations = relations(tradeAssets, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeAssets.tradeId],
    references: [trades.id],
  }),
  player: one(players, {
    fields: [tradeAssets.playerId],
    references: [players.id],
  }),
  fromTeam: one(teams, {
    fields: [tradeAssets.fromTeamId],
    references: [teams.id],
    relationName: "fromTeam",
  }),
  toTeam: one(teams, {
    fields: [tradeAssets.toTeamId],
    references: [teams.id],
    relationName: "toTeam",
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  team: one(teams, {
    fields: [transactions.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [transactions.playerId],
    references: [players.id],
  }),
}));
