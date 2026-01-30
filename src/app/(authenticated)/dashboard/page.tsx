import { db } from "@/lib/db";
import { teams, contracts, players } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateSalary, calculateCapHit } from "@/lib/salary/engine";
import { CAP_BY_YEAR } from "@/lib/constants";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getTeamsWithCap() {
  const allTeams = await db.select().from(teams).orderBy(teams.name);
  const currentYear = 2025;
  const cap = CAP_BY_YEAR[currentYear] ?? 300;

  const teamsWithCap = await Promise.all(
    allTeams.map(async (team) => {
      const teamContracts = await db
        .select({
          salary2025: contracts.salary2025,
          yearAcquired: contracts.yearAcquired,
          rosterStatus: contracts.rosterStatus,
        })
        .from(contracts)
        .where(
          and(eq(contracts.teamId, team.id), eq(contracts.isActive, true))
        );

      let totalSalary = 0;
      let activeCount = 0;
      let psCount = 0;
      let irCount = 0;

      for (const c of teamContracts) {
        const salary = calculateSalary(
          Number(c.salary2025),
          c.yearAcquired,
          currentYear
        );
        const capHit = calculateCapHit(salary, c.rosterStatus);
        totalSalary += capHit;

        if (c.rosterStatus === "active") activeCount++;
        else if (c.rosterStatus === "practice_squad") psCount++;
        else if (c.rosterStatus === "injured_reserve") irCount++;
      }

      return {
        ...team,
        salaryCap: cap,
        totalSalary,
        capSpace: cap - totalSalary,
        rosterCount: teamContracts.length,
        activeCount,
        psCount,
        irCount,
      };
    })
  );

  return teamsWithCap;
}

export default async function DashboardPage() {
  const teamsWithCap = await getTeamsWithCap();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">League Of Jesters</h1>
        <p className="text-muted-foreground">
          2025 Season &mdash; 12 Team Salary Cap League
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teamsWithCap.map((team) => (
          <Link key={team.id} href={`/teams/${team.slug}`}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <Badge
                    variant={team.capSpace >= 0 ? "secondary" : "destructive"}
                  >
                    {team.capSpace >= 0 ? `$${team.capSpace}` : `-$${Math.abs(team.capSpace)}`} cap
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Salary Cap</span>
                    <span className="font-medium text-foreground">
                      ${team.salaryCap}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Salary</span>
                    <span className="font-medium text-foreground">
                      ${team.totalSalary}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Roster</span>
                    <span className="font-medium text-foreground">
                      {team.rosterCount}/32
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({team.activeCount}A / {team.psCount}PS / {team.irCount}IR)
                      </span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
