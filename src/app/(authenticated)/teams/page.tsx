import { db } from "@/lib/db";
import { teams, contracts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateSalary, calculateCapHit } from "@/lib/salary/engine";
import { CAP_BY_YEAR, SALARY_YEARS } from "@/lib/constants";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getTeamsOverview() {
  const allTeams = await db.select().from(teams).orderBy(teams.name);

  const teamsData = await Promise.all(
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

      const capByYear: Record<number, { salary: number; cap: number; space: number }> = {};
      for (const year of SALARY_YEARS) {
        const cap = CAP_BY_YEAR[year] ?? 250;
        let totalSalary = 0;
        for (const c of teamContracts) {
          const salary = calculateSalary(
            Number(c.salary2025),
            c.yearAcquired,
            year
          );
          totalSalary += calculateCapHit(salary, c.rosterStatus);
        }
        capByYear[year] = { salary: totalSalary, cap, space: cap - totalSalary };
      }

      return {
        ...team,
        rosterCount: teamContracts.length,
        capByYear,
      };
    })
  );

  return teamsData;
}

export default async function TeamsPage() {
  const teamsData = await getTeamsOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Teams</h1>
        <p className="text-muted-foreground">
          Cap space and salary projections for all 12 teams
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">Team</TableHead>
              <TableHead className="text-center">Roster</TableHead>
              {SALARY_YEARS.map((year) => (
                <TableHead key={year} className="text-right">
                  {year}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamsData.map((team, index) => (
              <TableRow
                key={team.id}
                className="row-hover animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TableCell className="sticky left-0 bg-background font-medium">
                  <Link
                    href={`/teams/${team.slug}`}
                    className="hover:underline hover:text-primary transition-colors"
                  >
                    {team.name}
                  </Link>
                </TableCell>
                <TableCell className="text-center">
                  {team.rosterCount}/32
                </TableCell>
                {SALARY_YEARS.map((year) => {
                  const data = team.capByYear[year];
                  return (
                    <TableCell key={year} className="text-right">
                      <div className="text-sm font-medium">
                        ${data.salary}
                      </div>
                      <div
                        className={`text-xs ${
                          data.space >= 0
                            ? "text-muted-foreground"
                            : "text-destructive"
                        }`}
                      >
                        {data.space >= 0 ? `$${data.space}` : `-$${Math.abs(data.space)}`} free
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
