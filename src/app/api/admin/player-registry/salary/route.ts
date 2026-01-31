import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser, isCommissioner } from "@/lib/auth/server";

// PATCH - Update a contract's salary (commissioner only)
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
  const { contractId, salary, salaryYear } = body;

  if (!contractId) {
    return NextResponse.json({ error: "contractId is required" }, { status: 400 });
  }

  if (salary === undefined || salary === null) {
    return NextResponse.json({ error: "salary is required" }, { status: 400 });
  }

  if (typeof salary !== "number" || salary < 0) {
    return NextResponse.json({ error: "salary must be a non-negative number" }, { status: 400 });
  }

  // Update the contract's salary
  await db
    .update(contracts)
    .set({
      salary2025: salary.toString(),
      salaryYear: salaryYear || undefined,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  return NextResponse.json({ success: true });
}
