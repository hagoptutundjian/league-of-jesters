import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { LinkRookieDraftAdmin } from "@/components/link-rookie-draft-admin";

export const dynamic = "force-dynamic";

export default async function LinkRookieDraftPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Link Rookie Draft Players</h1>
        <p className="text-muted-foreground">
          Match rookie draft history to player registry for position data
        </p>
      </div>

      <LinkRookieDraftAdmin />
    </div>
  );
}
