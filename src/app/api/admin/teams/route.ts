import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

// GET - List all teams (commissioner only)
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const allTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      abbreviation: teams.abbreviation,
      ownerName: teams.ownerName,
    })
    .from(teams)
    .orderBy(teams.name);

  return NextResponse.json(allTeams);
}

// PATCH - Update a team (commissioner only)
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { teamId, name, slug, abbreviation, ownerName } = body;

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const updates: Partial<{
    name: string;
    slug: string;
    abbreviation: string;
    ownerName: string;
    updatedAt: Date;
  }> = { updatedAt: new Date() };

  if (name) updates.name = name;
  if (slug) updates.slug = slug;
  if (abbreviation) updates.abbreviation = abbreviation;
  if (ownerName !== undefined) updates.ownerName = ownerName || null;

  await db.update(teams).set(updates).where(eq(teams.id, teamId));

  return NextResponse.json({ success: true });
}

// PUT - Bulk update team names (commissioner only)
export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { updates } = body as {
    updates: Array<{
      oldName: string;
      newName: string;
      newSlug?: string;
      newAbbreviation?: string;
    }>;
  };

  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  const results: string[] = [];

  for (const update of updates) {
    // Find the team by old name
    const team = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.name, update.oldName))
      .limit(1);

    if (team.length === 0) {
      results.push(`⚠ Team "${update.oldName}" not found`);
      continue;
    }

    // Generate slug from new name if not provided
    const newSlug = update.newSlug || update.newName.toLowerCase().replace(/\s+/g, "-");
    // Use first 4 chars as abbreviation if not provided
    const newAbbreviation = update.newAbbreviation || update.newName.replace(/\s+/g, "").substring(0, 4).toUpperCase();

    await db
      .update(teams)
      .set({
        name: update.newName,
        slug: newSlug,
        abbreviation: newAbbreviation,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team[0].id));

    results.push(`✓ Updated "${update.oldName}" → "${update.newName}"`);
  }

  return NextResponse.json({ success: true, results });
}
