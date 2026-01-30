import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminRosterPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const allTeams = await db.select().from(teams).orderBy(teams.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Roster Management
        </h1>
        <p className="text-muted-foreground">
          Select a team to manage their roster
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allTeams.map((team) => (
          <Link key={team.id} href={`/teams/${team.slug}`}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="py-4">
                <CardTitle className="text-base">{team.name}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
