import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftPicks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

// DELETE - Remove a draft pick by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commissioner = await isCommissioner();
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const pickId = parseInt(id, 10);
  if (isNaN(pickId)) {
    return NextResponse.json({ error: "Invalid pick ID" }, { status: 400 });
  }

  await db.delete(draftPicks).where(eq(draftPicks.id, pickId));

  return NextResponse.json({ success: true });
}
