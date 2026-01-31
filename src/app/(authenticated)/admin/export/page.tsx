import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportButtons } from "@/components/export-buttons";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Export</h1>
        <p className="text-muted-foreground">
          Download CSV files with up-to-the-minute league data
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Team Rosters & Salaries</CardTitle>
            <CardDescription>
              All teams with player salaries for current year + 3 years
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons type="rosters" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Draft Picks</CardTitle>
            <CardDescription>
              All draft picks with original and current ownership
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons type="draft-picks" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Player Registry</CardTitle>
            <CardDescription>
              Complete master player list with positions and teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons type="player-registry" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trade History</CardTitle>
            <CardDescription>
              Full history of all trades with assets exchanged
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons type="trades" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rookie Draft History</CardTitle>
            <CardDescription>
              Complete rookie draft results by year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons type="rookie-draft" />
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Full League Export</CardTitle>
            <CardDescription>
              Download all data as a single ZIP file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportButtons type="all" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
