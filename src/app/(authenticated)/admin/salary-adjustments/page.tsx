import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { salaryOverrides, contracts, players, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SalaryAdjustmentsPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const overrides = await db
    .select({
      id: salaryOverrides.id,
      year: salaryOverrides.year,
      salary: salaryOverrides.salary,
      reason: salaryOverrides.reason,
      playerName: players.name,
      teamName: teams.name,
    })
    .from(salaryOverrides)
    .innerJoin(contracts, eq(salaryOverrides.contractId, contracts.id))
    .innerJoin(players, eq(contracts.playerId, players.id))
    .innerJoin(teams, eq(contracts.teamId, teams.id))
    .orderBy(salaryOverrides.year, players.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Salary Adjustments
        </h1>
        <p className="text-muted-foreground">
          Manual salary overrides that bypass the standard escalation formula
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No salary overrides configured.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">Year</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.playerName}
                    </TableCell>
                    <TableCell>{o.teamName}</TableCell>
                    <TableCell className="text-center">{o.year}</TableCell>
                    <TableCell className="text-right">${Number(o.salary)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
