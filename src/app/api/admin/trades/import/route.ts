import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trades, tradeAssets, tradeParticipants, teams } from "@/lib/db/schema";
import { isCommissioner, getUser } from "@/lib/auth/server";
import { eq } from "drizzle-orm";

interface TeamTradeData {
  name: string;
  sent: string[];
  received: string[];
}

interface ParsedTrade {
  date: string;
  season: number;
  teams: TeamTradeData[];
}

function parseAssetList(assetString: string): string[] {
  // Remove quotes and split by newlines
  const cleaned = assetString.replace(/^"|"$/g, "").trim();
  // Split by newlines and clean up numbered prefixes
  return cleaned
    .split("\n")
    .map((item) => item.replace(/^\d+\.\s*/, "").trim())
    .filter((item) => item.length > 0);
}

// Parse the entire data string, handling multi-line quoted fields
function tokenizeRows(data: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const nextChar = data[i + 1];

    if (char === '"') {
      inQuotes = !inQuotes;
      currentField += char;
    } else if (char === "\t" && !inQuotes) {
      // End of field
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      // End of row (but not if we're inside quotes)
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else if (char === "\r" && nextChar === "\n" && !inQuotes) {
      // Handle Windows line endings
      currentRow.push(currentField);
      if (currentRow.some(f => f.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      i++; // Skip the \n
    } else {
      currentField += char;
    }
  }

  // Don't forget the last field and row
  currentRow.push(currentField);
  if (currentRow.some(f => f.trim())) {
    rows.push(currentRow);
  }

  return rows;
}

function parseImportData(data: string): ParsedTrade[] {
  const rows = tokenizeRows(data);
  const trades: ParsedTrade[] = [];

  let currentTrade: ParsedTrade | null = null;
  let currentDate = "";
  let currentSeason = 0;

  for (const parts of rows) {
    // Parse the row - ensure we have at least some fields
    const [date, teamName, sent, received, season] = parts;

    // Clean up fields
    const cleanDate = date?.trim() || "";
    const cleanTeam = teamName?.trim() || "";
    const cleanSent = sent || "";
    const cleanReceived = received || "";
    const cleanSeason = season?.trim() || "";

    // Check if this looks like a date (contains / or is MM/DD/YYYY format)
    const looksLikeDate = cleanDate && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanDate);

    // If we have a date, this is the first row of a new trade
    if (looksLikeDate) {
      // Save previous trade if exists and has at least 2 teams
      if (currentTrade && currentTrade.teams.length >= 2) {
        trades.push(currentTrade);
      }

      currentDate = cleanDate;
      currentSeason = parseInt(cleanSeason) || 2025;

      currentTrade = {
        date: currentDate,
        season: currentSeason,
        teams: [
          {
            name: cleanTeam,
            sent: parseAssetList(cleanSent),
            received: parseAssetList(cleanReceived),
          },
        ],
      };
    } else if (currentTrade && cleanTeam) {
      // This is an additional row of the same trade (2nd, 3rd, 4th team, etc.)
      const rowSeason = cleanSeason ? parseInt(cleanSeason) : currentSeason;

      currentTrade.teams.push({
        name: cleanTeam,
        sent: parseAssetList(cleanSent),
        received: parseAssetList(cleanReceived),
      });

      // Use the season from any row that has it
      if (rowSeason && !isNaN(rowSeason)) {
        currentTrade.season = rowSeason;
      }
    }
    // Skip rows that don't have a team name and aren't starting a new trade
  }

  // Don't forget the last trade
  if (currentTrade && currentTrade.teams.length >= 2) {
    trades.push(currentTrade);
  }

  return trades;
}

function parseDate(dateStr: string): string {
  // Handle MM/DD/YYYY format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // Return as-is if already in correct format
  return dateStr;
}

// POST - Import historical trades
export async function POST(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "string") {
      return NextResponse.json(
        { error: "No data provided" },
        { status: 400 }
      );
    }

    // Get all teams for lookup - create multiple lookup maps
    const allTeams = await db.select().from(teams);
    const teamByName = new Map(allTeams.map((t) => [t.name.toLowerCase(), t]));
    const teamByAbbr = new Map(allTeams.map((t) => [t.abbreviation.toLowerCase(), t]));
    const teamBySlug = new Map(allTeams.map((t) => [t.slug.toLowerCase(), t]));

    // Also create lookups without spaces/special chars for fuzzy matching
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const teamByNormalizedName = new Map(allTeams.map((t) => [normalize(t.name), t]));
    const teamByNormalizedAbbr = new Map(allTeams.map((t) => [normalize(t.abbreviation), t]));

    const findTeam = (name: string) => {
      const lower = name.toLowerCase().trim();
      const normalized = normalize(name);

      // Try exact matches first
      if (teamByName.has(lower)) return teamByName.get(lower);
      if (teamByAbbr.has(lower)) return teamByAbbr.get(lower);
      if (teamBySlug.has(lower)) return teamBySlug.get(lower);

      // Try normalized (no spaces/special chars)
      if (teamByNormalizedName.has(normalized)) return teamByNormalizedName.get(normalized);
      if (teamByNormalizedAbbr.has(normalized)) return teamByNormalizedAbbr.get(normalized);

      // Try partial match - if input contains team name or vice versa
      for (const team of allTeams) {
        const teamNameLower = team.name.toLowerCase();
        const teamAbbrLower = team.abbreviation.toLowerCase();
        if (lower.includes(teamNameLower) || teamNameLower.includes(lower)) {
          return team;
        }
        if (lower.includes(teamAbbrLower) || teamAbbrLower.includes(lower)) {
          return team;
        }
      }

      return undefined;
    };

    // Parse the import data
    const parsedTrades = parseImportData(data);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const trade of parsedTrades) {
      // Look up all teams in this trade
      const resolvedTeams: { dbTeam: typeof allTeams[0]; data: TeamTradeData }[] = [];
      let hasError = false;

      for (const teamData of trade.teams) {
        const dbTeam = findTeam(teamData.name);
        if (!dbTeam) {
          errors.push(`Team not found: ${teamData.name}`);
          hasError = true;
          break;
        }
        resolvedTeams.push({ dbTeam, data: teamData });
      }

      if (hasError) {
        skipped++;
        continue;
      }

      try {
        // Create the trade record
        const tradeDate = parseDate(trade.date);
        const [newTrade] = await db
          .insert(trades)
          .values({
            tradeDate,
            season: trade.season,
            notes: resolvedTeams.length > 2 ? `${resolvedTeams.length}-team trade` : null,
            recordedBy: user.id,
          })
          .returning({ id: trades.id });

        const tradeId = newTrade.id;

        // Insert all participants
        for (const { dbTeam } of resolvedTeams) {
          await db.insert(tradeParticipants).values({
            tradeId,
            teamId: dbTeam.id,
          });
        }

        // For each team, what they sent = assets going OUT from them
        // What they received = assets coming IN to them
        // We need to figure out who sent what to whom

        // For 2-team trades: Team A's sent goes to Team B, Team B's sent goes to Team A
        // For 3+ team trades: Use the "received" column to determine destinations

        if (resolvedTeams.length === 2) {
          // Simple 2-team trade
          const [team1, team2] = resolvedTeams;

          // What team1 sent goes to team2
          for (const asset of team1.data.sent) {
            await db.insert(tradeAssets).values({
              tradeId,
              assetType: asset.toLowerCase().includes("round pick") ? "draft_pick" : "player",
              fromTeamId: team1.dbTeam.id,
              toTeamId: team2.dbTeam.id,
              description: asset,
            });
          }

          // What team2 sent goes to team1
          for (const asset of team2.data.sent) {
            await db.insert(tradeAssets).values({
              tradeId,
              assetType: asset.toLowerCase().includes("round pick") ? "draft_pick" : "player",
              fromTeamId: team2.dbTeam.id,
              toTeamId: team1.dbTeam.id,
              description: asset,
            });
          }
        } else {
          // Multi-team trade: Use "received" to determine who gets what
          // Build a map of what each team receives
          for (const receiver of resolvedTeams) {
            for (const assetDesc of receiver.data.received) {
              // Find which team sent this asset
              let senderTeam: typeof resolvedTeams[0] | null = null;
              for (const sender of resolvedTeams) {
                if (sender.dbTeam.id === receiver.dbTeam.id) continue;
                if (sender.data.sent.some(s => s === assetDesc)) {
                  senderTeam = sender;
                  break;
                }
              }

              if (senderTeam) {
                await db.insert(tradeAssets).values({
                  tradeId,
                  assetType: assetDesc.toLowerCase().includes("round pick") ? "draft_pick" : "player",
                  fromTeamId: senderTeam.dbTeam.id,
                  toTeamId: receiver.dbTeam.id,
                  description: assetDesc,
                });
              } else {
                // Couldn't find sender, just record with first non-receiver team as sender
                const fallbackSender = resolvedTeams.find(t => t.dbTeam.id !== receiver.dbTeam.id);
                if (fallbackSender) {
                  await db.insert(tradeAssets).values({
                    tradeId,
                    assetType: assetDesc.toLowerCase().includes("round pick") ? "draft_pick" : "player",
                    fromTeamId: fallbackSender.dbTeam.id,
                    toTeamId: receiver.dbTeam.id,
                    description: assetDesc,
                  });
                }
              }
            }
          }
        }

        imported++;
      } catch (err) {
        console.error("Error importing trade:", err);
        errors.push(`Failed to import trade on ${trade.date}: ${err}`);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Only return first 10 errors
    });
  } catch (error) {
    console.error("Error importing trades:", error);
    return NextResponse.json(
      { error: "Failed to import trades" },
      { status: 500 }
    );
  }
}
