import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Nav } from "@/components/nav";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const isCommissioner = user.user_metadata?.role === "commissioner";

  // Find the user's team
  let teamSlug: string | undefined;
  const userTeam = await db
    .select({ slug: teams.slug })
    .from(teams)
    .where(eq(teams.userId, user.id))
    .limit(1);

  if (userTeam.length > 0) {
    teamSlug = userTeam[0].slug;
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav
        userEmail={user.email}
        isCommissioner={isCommissioner}
        teamSlug={teamSlug}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
