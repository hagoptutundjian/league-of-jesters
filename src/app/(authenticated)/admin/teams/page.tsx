import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

async function getTeams() {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      abbreviation: teams.abbreviation,
      ownerName: teams.ownerName,
    })
    .from(teams)
    .orderBy(teams.name);
}

async function updateTeam(formData: FormData) {
  "use server";
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/");

  const teamId = parseInt(formData.get("teamId") as string);
  const name = formData.get("name") as string;
  const abbreviation = formData.get("abbreviation") as string;
  const ownerName = formData.get("ownerName") as string;

  // Generate slug from name
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  await db
    .update(teams)
    .set({
      name,
      slug,
      abbreviation,
      ownerName: ownerName || null,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  revalidatePath("/admin/teams");
  revalidatePath("/teams");
}

export default async function TeamsAdminPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/");
  const allTeams = await getTeams();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground">
          Edit team names, abbreviations, and owner names
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allTeams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{team.name}</CardTitle>
              <CardDescription>
                URL: /teams/{team.slug}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateTeam} className="space-y-4">
                <input type="hidden" name="teamId" value={team.id} />

                <div className="space-y-2">
                  <Label htmlFor={`name-${team.id}`}>Team Name</Label>
                  <Input
                    id={`name-${team.id}`}
                    name="name"
                    defaultValue={team.name}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`abbr-${team.id}`}>Abbreviation</Label>
                  <Input
                    id={`abbr-${team.id}`}
                    name="abbreviation"
                    defaultValue={team.abbreviation}
                    maxLength={5}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`owner-${team.id}`}>Owner Name</Label>
                  <Input
                    id={`owner-${team.id}`}
                    name="ownerName"
                    defaultValue={team.ownerName || ""}
                    placeholder="Optional"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
