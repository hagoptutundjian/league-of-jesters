import { isCommissioner } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { FreeAgentAuctionAdmin } from "@/components/free-agent-auction-admin";

export const dynamic = "force-dynamic";

export default async function FreeAgentAuctionAdminPage() {
  const commissioner = await isCommissioner();
  if (!commissioner) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Free Agent Auction</h1>
        <p className="text-muted-foreground">
          Draft free agents and track auction results
        </p>
      </div>

      <FreeAgentAuctionAdmin />
    </div>
  );
}
