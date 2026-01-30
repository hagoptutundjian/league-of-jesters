import { NextResponse } from "next/server";
import { getCurrentSeason } from "@/lib/settings";

export async function GET() {
  const currentSeason = await getCurrentSeason();
  return NextResponse.json({ currentSeason });
}
