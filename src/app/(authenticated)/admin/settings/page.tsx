import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { leagueSettings, draftPicks, teams } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const dynamic = "force-dynamic";

const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

async function updateCurrentSeason(formData: FormData) {
  "use server";
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/");

  const year = formData.get("currentSeason") as string;
  const newYear = parseInt(year, 10);

  // Upsert the current_season setting
  await db
    .insert(leagueSettings)
    .values({
      key: "current_season",
      value: year,
      description: "The current active season year",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: leagueSettings.key,
      set: {
        value: year,
        updatedAt: new Date(),
      },
    });

  // Auto-create draft picks for N+2 year if they don't exist
  const futureYear = newYear + 2;

  // Get all teams
  const allTeams = await db.select({ id: teams.id }).from(teams);

  // Check if picks already exist for this future year
  const existingPicks = await db
    .select({ id: draftPicks.id })
    .from(draftPicks)
    .where(eq(draftPicks.year, futureYear))
    .limit(1);

  // Only create picks if none exist for that year
  if (existingPicks.length === 0 && allTeams.length > 0) {
    const picksToCreate: {
      year: number;
      round: number;
      originalTeamId: number;
      currentTeamId: number;
    }[] = [];

    // Create 4 rounds of picks for each team
    for (const team of allTeams) {
      for (let round = 1; round <= 4; round++) {
        picksToCreate.push({
          year: futureYear,
          round,
          originalTeamId: team.id,
          currentTeamId: team.id, // Initially owned by the original team
        });
      }
    }

    if (picksToCreate.length > 0) {
      await db.insert(draftPicks).values(picksToCreate);
    }
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/draft-picks");
  revalidatePath("/teams");
  revalidatePath("/teams/[slug]", "page");
  revalidatePath("/dashboard");
}

async function updateSetting(formData: FormData) {
  "use server";
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/");

  const key = formData.get("key") as string;
  const value = formData.get("value") as string;
  const description = formData.get("description") as string;

  await db
    .insert(leagueSettings)
    .values({
      key,
      value,
      description: description || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: leagueSettings.key,
      set: {
        value,
        description: description || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/admin/settings");
}

export default async function AdminSettingsPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  const settings = await db.select().from(leagueSettings);
  const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
  const currentSeason = settingsMap.get("current_season") || "2025";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">League Settings</h1>
        <p className="text-muted-foreground">
          View and manage league configuration
        </p>
      </div>

      {/* Current Season Setting */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle>Current Season</CardTitle>
          <CardDescription>
            Set the active season year. This affects salary displays on team pages.
            Changing to a new year will automatically create draft picks for N+2 years out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCurrentSeason} className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentSeason">Season Year</Label>
              <Select name="currentSeason" defaultValue={currentSeason}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      {/* All Settings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {settings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No settings configured yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map((setting) => (
                  <TableRow key={setting.key}>
                    <TableCell className="font-mono text-sm">
                      {setting.key}
                    </TableCell>
                    <TableCell className="font-medium">
                      {setting.value}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {setting.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* League Documents */}
      <Card>
        <CardHeader>
          <CardTitle>League Documents</CardTitle>
          <CardDescription>
            Add URLs for league documents that appear on the League Docs page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Use these keys to add document links:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 font-mono text-xs">
              <li>doc_constitution_url - League Constitution</li>
              <li>doc_salary_rules_url - Salary & Cap Rules</li>
              <li>doc_draft_rules_url - Draft Rules</li>
            </ul>
            <p className="mt-2">
              Set the value to the full URL of your Google Doc, Notion page, or other document.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add New Setting */}
      <Card>
        <CardHeader>
          <CardTitle>Add Custom Setting</CardTitle>
          <CardDescription>
            Add or update a custom league setting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateSetting} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  name="key"
                  placeholder="setting_key"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  name="value"
                  placeholder="value"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Optional description"
                />
              </div>
            </div>
            <Button type="submit">Add Setting</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
