import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rookieDraftHistory, players } from "@/lib/db/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { isCommissioner } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";

// Normalize a name for matching (lowercase, remove punctuation, trim)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.',-]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/\bjr\b|\bsr\b|\bii\b|\biii\b|\biv\b/gi, "") // Remove suffixes
    .trim();
}

// Calculate similarity between two strings (Levenshtein-based)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// GET - Preview matches
export async function GET() {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get unlinked rookie draft picks
  const unlinkedPicks = await db
    .select({
      id: rookieDraftHistory.id,
      playerName: rookieDraftHistory.playerName,
      year: rookieDraftHistory.year,
      round: rookieDraftHistory.round,
      pick: rookieDraftHistory.pick,
    })
    .from(rookieDraftHistory)
    .where(isNull(rookieDraftHistory.playerId));

  // Get all players from registry
  const allPlayers = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
    })
    .from(players);

  // Build a map for quick lookup
  const playerMap = new Map<string, typeof allPlayers>();
  for (const player of allPlayers) {
    const normalized = normalizeName(player.name);
    if (!playerMap.has(normalized)) {
      playerMap.set(normalized, []);
    }
    playerMap.get(normalized)!.push(player);
  }

  // Match each unlinked pick
  const matches: {
    pickId: number;
    pickName: string;
    year: number;
    matchedPlayerId: number | null;
    matchedPlayerName: string | null;
    matchedPosition: string | null;
    confidence: "exact" | "high" | "medium" | "low" | "none";
    similarityScore: number;
  }[] = [];

  for (const pick of unlinkedPicks) {
    const normalizedPickName = normalizeName(pick.playerName);

    // Try exact match first
    const exactMatches = playerMap.get(normalizedPickName);
    if (exactMatches && exactMatches.length === 1) {
      matches.push({
        pickId: pick.id,
        pickName: pick.playerName,
        year: pick.year,
        matchedPlayerId: exactMatches[0].id,
        matchedPlayerName: exactMatches[0].name,
        matchedPosition: exactMatches[0].position,
        confidence: "exact",
        similarityScore: 1.0,
      });
      continue;
    }

    // Try fuzzy match
    let bestMatch: typeof allPlayers[0] | null = null;
    let bestScore = 0;

    for (const player of allPlayers) {
      const score = similarity(normalizedPickName, normalizeName(player.name));
      if (score > bestScore && score >= 0.8) {
        bestScore = score;
        bestMatch = player;
      }
    }

    if (bestMatch) {
      let confidence: "high" | "medium" | "low";
      if (bestScore >= 0.95) confidence = "high";
      else if (bestScore >= 0.85) confidence = "medium";
      else confidence = "low";

      matches.push({
        pickId: pick.id,
        pickName: pick.playerName,
        year: pick.year,
        matchedPlayerId: bestMatch.id,
        matchedPlayerName: bestMatch.name,
        matchedPosition: bestMatch.position,
        confidence,
        similarityScore: bestScore,
      });
    } else {
      matches.push({
        pickId: pick.id,
        pickName: pick.playerName,
        year: pick.year,
        matchedPlayerId: null,
        matchedPlayerName: null,
        matchedPosition: null,
        confidence: "none",
        similarityScore: 0,
      });
    }
  }

  // Sort by confidence (exact first, then high, medium, low, none)
  const confidenceOrder = { exact: 0, high: 1, medium: 2, low: 3, none: 4 };
  matches.sort((a, b) => {
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    return b.year - a.year;
  });

  const stats = {
    total: unlinkedPicks.length,
    exact: matches.filter((m) => m.confidence === "exact").length,
    high: matches.filter((m) => m.confidence === "high").length,
    medium: matches.filter((m) => m.confidence === "medium").length,
    low: matches.filter((m) => m.confidence === "low").length,
    none: matches.filter((m) => m.confidence === "none").length,
  };

  return NextResponse.json({ matches, stats });
}

// POST - Apply matches
export async function POST(request: Request) {
  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { matches } = body as {
    matches: { pickId: number; playerId: number }[];
  };

  if (!matches || !Array.isArray(matches)) {
    return NextResponse.json({ error: "Invalid matches" }, { status: 400 });
  }

  let updated = 0;
  for (const match of matches) {
    if (match.pickId && match.playerId) {
      await db
        .update(rookieDraftHistory)
        .set({ playerId: match.playerId })
        .where(eq(rookieDraftHistory.id, match.pickId));
      updated++;
    }
  }

  revalidatePath("/rookie-draft");
  revalidatePath("/admin/player-registry");

  return NextResponse.json({ success: true, updated });
}
