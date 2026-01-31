import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Commissioner Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage league operations
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/player-registry">
          <Card className="transition-colors hover:bg-accent/50 border-primary h-full">
            <CardHeader>
              <CardTitle>Player Registry</CardTitle>
              <CardDescription>
                Master list of all players
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/teams">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardHeader>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Edit team names and owners
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/draft-picks">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardHeader>
              <CardTitle>Draft Picks</CardTitle>
              <CardDescription>
                Manage draft pick ownership
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/free-agent-auction">
          <Card className="transition-colors hover:bg-accent/50 border-green-500 h-full">
            <CardHeader>
              <CardTitle>Free Agent Auction</CardTitle>
              <CardDescription>
                Run auctions and track results
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/trades/new">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardHeader>
              <CardTitle>Record Trade</CardTitle>
              <CardDescription>
                Enter a new trade between teams
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/settings">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardHeader>
              <CardTitle>League Settings</CardTitle>
              <CardDescription>
                Update cap and escalation rates
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/export">
          <Card className="transition-colors hover:bg-accent/50 h-full">
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>
                Download CSV files for all data
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
