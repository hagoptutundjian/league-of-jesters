import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftPicks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is commissioner or team owner
  const commissioner = await isCommissioner();

  const { id } = await params;
  const pickId = parseInt(id, 10);

  // Get the pick to check ownership
  const pick = await db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.id, pickId))
    .limit(1);

  if (pick.length === 0) {
    return NextResponse.json({ error: "Draft pick not found" }, { status: 404 });
  }

  // For now, only commissioners can edit pick salaries
  // Later we can add team owner check
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const body = await request.json();
  const { salary } = body;

  if (typeof salary !== "number" || salary < 1) {
    return NextResponse.json({ error: "Invalid salary" }, { status: 400 });
  }

  await db
    .update(draftPicks)
    .set({
      salaryOverride: salary,
      updatedAt: new Date(),
    })
    .where(eq(draftPicks.id, pickId));

  return NextResponse.json({ success: true });
}
