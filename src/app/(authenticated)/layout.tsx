import { getUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Nav } from "@/components/nav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  // Public access allowed - user may be null
  const isCommissioner = user?.user_metadata?.role === "commissioner" ?? false;

  // Find the user's team (if logged in)
  let teamSlug: string | undefined;
  if (user) {
    const userTeam = await db
      .select({ slug: teams.slug })
      .from(teams)
      .where(eq(teams.userId, user.id))
      .limit(1);

    if (userTeam.length > 0) {
      teamSlug = userTeam[0].slug;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav
        userEmail={user?.email}
        isCommissioner={isCommissioner}
        teamSlug={teamSlug}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
