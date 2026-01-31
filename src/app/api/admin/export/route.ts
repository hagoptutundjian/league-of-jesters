import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  teams,
  players,
  contracts,
  draftPicks,
  trades,
  tradeAssets,
  tradeParticipants,
  rookieDraftHistory,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";
import { calculateSalary } from "@/lib/salary/engine";
import { type AcquisitionType } from "@/lib/constants";
import { getDraftPickCapValue } from "@/lib/salary/rookie-scale";
import { getCurrentSeason } from "@/lib/settings";

// Helper to escape CSV values
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper to create CSV from array of objects
function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

async function exportRosters() {
  const currentSeason = await getCurrentSeason();
  const years = [currentSeason, currentSeason + 1, currentSeason + 2, currentSeason + 3];

  const allTeams = await db.select().from(teams).orderBy(teams.name);
  const allContracts = await db
    .select({
      teamId: contracts.teamId,
      playerId: contracts.playerId,
      playerName: players.name,
      position: players.position,
      salary2025: contracts.salary2025,
      salaryYear: contracts.salaryYear,
      yearAcquired: contracts.yearAcquired,
      acquisitionType: contracts.acquisitionType,
      rosterStatus: contracts.rosterStatus,
    })
    .from(contracts)
    .innerJoin(players, eq(contracts.playerId, players.id))
    .where(eq(contracts.isActive, true));

  const teamMap = new Map(allTeams.map((t) => [t.id, t.name]));

  const headers = [
    "Team",
    "Player",
    "Position",
    "Roster Status",
    "Acquisition Type",
    "Year Acquired",
    `Salary ${years[0]}`,
    `Salary ${years[1]}`,
    `Salary ${years[2]}`,
    `Salary ${years[3]}`,
  ];

  const rows = allContracts.map((c) => {
    const salaries = years.map((year) =>
      calculateSalary(
        Number(c.salary2025),
        c.yearAcquired,
        year,
        undefined,
        c.salaryYear ?? 2025,
        c.acquisitionType as AcquisitionType
      )
    );

    return [
      teamMap.get(c.teamId) || "Unknown",
      c.playerName,
      c.position,
      c.rosterStatus,
      c.acquisitionType,
      c.yearAcquired,
      ...salaries,
    ];
  });

  // Sort by team name, then by position, then by salary descending
  rows.sort((a, b) => {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]));
    if (a[2] !== b[2]) return String(a[2]).localeCompare(String(b[2]));
    return Number(b[6]) - Number(a[6]); // Sort by current year salary desc
  });

  return toCSV(headers, rows);
}

async function exportDraftPicks() {
  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t.name]));

  const allPicks = await db
    .select()
    .from(draftPicks)
    .orderBy(draftPicks.year, draftPicks.round, draftPicks.originalTeamId);

  const headers = [
    "Year",
    "Round",
    "Pick Number",
    "Original Team",
    "Current Owner",
    "Salary Value",
    "Used",
  ];

  const rows = allPicks.map((p) => [
    p.year,
    p.round,
    p.pickNumber || "",
    teamMap.get(p.originalTeamId) || "Unknown",
    teamMap.get(p.currentTeamId) || "Unknown",
    p.salaryOverride ?? getDraftPickCapValue(p.round),
    p.isUsed ? "Yes" : "No",
  ]);

  return toCSV(headers, rows);
}

async function exportPlayerRegistry() {
  const currentSeason = await getCurrentSeason();

  const allPlayers = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      nflTeam: players.nflTeam,
      yearAcquired: players.yearAcquired,
      isActive: players.isActive,
    })
    .from(players)
    .where(eq(players.isActive, true))
    .orderBy(players.name);

  const activeContracts = await db
    .select({
      playerId: contracts.playerId,
      teamId: contracts.teamId,
      salary2025: contracts.salary2025,
      salaryYear: contracts.salaryYear,
      acquisitionType: contracts.acquisitionType,
      rosterStatus: contracts.rosterStatus,
    })
    .from(contracts)
    .where(eq(contracts.isActive, true));

  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t.name]));
  const contractMap = new Map(activeContracts.map((c) => [c.playerId, c]));

  const headers = [
    "Player",
    "Position",
    "NFL Team",
    "Year Acquired",
    "Fantasy Team",
    "Roster Status",
    `Salary ${currentSeason}`,
  ];

  const rows = allPlayers.map((p) => {
    const contract = contractMap.get(p.id);
    const fantasyTeam = contract ? teamMap.get(contract.teamId) : null;
    const salary = contract
      ? calculateSalary(
          Number(contract.salary2025),
          p.yearAcquired,
          currentSeason,
          undefined,
          contract.salaryYear ?? 2025,
          contract.acquisitionType as AcquisitionType
        )
      : null;

    return [
      p.name,
      p.position,
      p.nflTeam,
      p.yearAcquired,
      fantasyTeam || "Free Agent",
      contract?.rosterStatus || "",
      salary ?? "",
    ];
  });

  return toCSV(headers, rows);
}

async function exportTrades() {
  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t.name]));

  const allTrades = await db
    .select()
    .from(trades)
    .orderBy(desc(trades.tradeDate));

  const allParticipants = await db.select().from(tradeParticipants);
  const allAssets = await db
    .select({
      id: tradeAssets.id,
      tradeId: tradeAssets.tradeId,
      assetType: tradeAssets.assetType,
      playerId: tradeAssets.playerId,
      draftPickId: tradeAssets.draftPickId,
      fromTeamId: tradeAssets.fromTeamId,
      toTeamId: tradeAssets.toTeamId,
      description: tradeAssets.description,
      playerName: players.name,
    })
    .from(tradeAssets)
    .leftJoin(players, eq(tradeAssets.playerId, players.id));

  const allDraftPicks = await db.select().from(draftPicks);
  const pickMap = new Map(allDraftPicks.map((p) => [p.id, p]));

  // Group participants and assets by trade
  const participantsByTrade = new Map<number, number[]>();
  for (const p of allParticipants) {
    if (!participantsByTrade.has(p.tradeId)) {
      participantsByTrade.set(p.tradeId, []);
    }
    participantsByTrade.get(p.tradeId)!.push(p.teamId);
  }

  const assetsByTrade = new Map<number, typeof allAssets>();
  for (const a of allAssets) {
    if (!assetsByTrade.has(a.tradeId)) {
      assetsByTrade.set(a.tradeId, []);
    }
    assetsByTrade.get(a.tradeId)!.push(a);
  }

  const headers = [
    "Trade Date",
    "Season",
    "Teams Involved",
    "Assets Exchanged",
    "Notes",
  ];

  const rows = allTrades.map((t) => {
    const participants = participantsByTrade.get(t.id) || [];
    const teamsInvolved = participants.map((id) => teamMap.get(id) || "Unknown").join(" / ");

    const assets = assetsByTrade.get(t.id) || [];
    const assetDescriptions = assets.map((a) => {
      const from = teamMap.get(a.fromTeamId) || "Unknown";
      const to = teamMap.get(a.toTeamId) || "Unknown";

      if (a.assetType === "player") {
        return `${a.playerName || "Unknown Player"}: ${from} → ${to}`;
      } else if (a.draftPickId) {
        const pick = pickMap.get(a.draftPickId);
        if (pick) {
          return `${pick.year} Round ${pick.round} pick: ${from} → ${to}`;
        }
      }
      return a.description || "Unknown asset";
    });

    return [
      t.tradeDate,
      t.season,
      teamsInvolved,
      assetDescriptions.join("; "),
      t.notes || "",
    ];
  });

  return toCSV(headers, rows);
}

async function exportRookieDraft() {
  const allTeams = await db.select().from(teams);
  const teamMap = new Map(allTeams.map((t) => [t.id, t.name]));

  const history = await db
    .select()
    .from(rookieDraftHistory)
    .orderBy(desc(rookieDraftHistory.year), rookieDraftHistory.round, rookieDraftHistory.pick);

  const headers = [
    "Year",
    "Round",
    "Pick",
    "Overall Pick",
    "Team",
    "Player Selected",
  ];

  const rows = history.map((h) => [
    h.year,
    h.round,
    h.pick,
    h.overallPick,
    teamMap.get(h.teamId) || "Unknown",
    h.playerName,
  ]);

  return toCSV(headers, rows);
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const today = new Date().toISOString().split("T")[0];

  try {
    let csv: string;
    let filename: string;

    switch (type) {
      case "rosters":
        csv = await exportRosters();
        filename = `loj-rosters-${today}.csv`;
        break;
      case "draft-picks":
        csv = await exportDraftPicks();
        filename = `loj-draft-picks-${today}.csv`;
        break;
      case "player-registry":
        csv = await exportPlayerRegistry();
        filename = `loj-player-registry-${today}.csv`;
        break;
      case "trades":
        csv = await exportTrades();
        filename = `loj-trade-history-${today}.csv`;
        break;
      case "rookie-draft":
        csv = await exportRookieDraft();
        filename = `loj-rookie-draft-history-${today}.csv`;
        break;
      case "all":
        // For "all", we'll create a simple combined export
        // In a production app, you'd use a ZIP library
        const rosters = await exportRosters();
        const draftPicksData = await exportDraftPicks();
        const registry = await exportPlayerRegistry();
        const tradesData = await exportTrades();
        const rookieDraft = await exportRookieDraft();

        csv = [
          "=== TEAM ROSTERS & SALARIES ===",
          rosters,
          "",
          "=== DRAFT PICKS ===",
          draftPicksData,
          "",
          "=== PLAYER REGISTRY ===",
          registry,
          "",
          "=== TRADE HISTORY ===",
          tradesData,
          "",
          "=== ROOKIE DRAFT HISTORY ===",
          rookieDraft,
        ].join("\n");
        filename = `loj-full-export-${today}.csv`;
        break;
      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
