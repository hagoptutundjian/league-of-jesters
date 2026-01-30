import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { leagueSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

  revalidatePath("/admin/settings");
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
