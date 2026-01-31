import { db } from "@/lib/db";
import { teams, contracts, players, draftPicks, salaryOverrides } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  calculateSalary,
  calculateCapHit,
  calculateTeamCap,
  isLoyaltyBumpYear,
  type ContractForCap,
  type DraftPickCapHit,
} from "@/lib/salary/engine";
import { getDraftPickCapValue } from "@/lib/salary/rookie-scale";
import { CAP_BY_YEAR, type AcquisitionType } from "@/lib/constants";
import { getCurrentSeason, getSalaryYearsForDisplay } from "@/lib/settings";
import { getUser } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RosterActions } from "@/components/roster-actions";
import { SalaryModeler, type ModelPlayer, type ModelDraftPick } from "@/components/salary-modeler";
import { AddPlayerInline } from "@/components/add-player-inline";
import { DraftPickActions } from "@/components/draft-pick-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function statusBadge(status: string) {
  switch (status) {
    case "practice_squad":
      return <Badge variant="outline">PS</Badge>;
    case "injured_reserve":
      return <Badge variant="destructive">IR</Badge>;
    default:
      return null;
  }
}

// Position color scheme
const positionColors: Record<string, { bg: string; border: string; text: string; badge: string; cellBg: string }> = {
  QB: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-l-4 border-l-red-500",
    text: "text-red-700 dark:text-red-400",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    cellBg: "bg-red-50 dark:bg-red-950/30"
  },
  WR: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-l-4 border-l-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    cellBg: "bg-blue-50 dark:bg-blue-950/30"
  },
  RB: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-l-4 border-l-green-500",
    text: "text-green-700 dark:text-green-400",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    cellBg: "bg-green-50 dark:bg-green-950/30"
  },
  TE: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-l-4 border-l-purple-500",
    text: "text-purple-700 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    cellBg: "bg-purple-50 dark:bg-purple-950/30"
  },
};


function getPositionName(pos: string) {
  switch (pos) {
    case "QB": return "Quarterbacks";
    case "WR": return "Wide Receivers";
    case "RB": return "Running Backs";
    case "TE": return "Tight Ends";
    default: return pos;
  }
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const team = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  if (team.length === 0) {
    notFound();
  }

  const currentTeam = team[0];
  const user = await getUser();
  const isOwner = user?.id === currentTeam.userId;
  const isCommissioner = user?.user_metadata?.role === "commissioner";
  const canEdit = isOwner || isCommissioner;

  // Get current season from settings
  const currentSeason = await getCurrentSeason();
  const displayYears = getSalaryYearsForDisplay(currentSeason);

  // Get all active contracts with player info
  const teamContracts = await db
    .select({
      id: contracts.id,
      playerId: contracts.playerId,
      salary2025: contracts.salary2025,
      salaryYear: contracts.salaryYear,
      yearAcquired: contracts.yearAcquired,
      acquisitionType: contracts.acquisitionType,
      rosterStatus: contracts.rosterStatus,
      practiceSquadYears: contracts.practiceSquadYears,
      playerName: players.name,
      position: players.position,
    })
    .from(contracts)
    .innerJoin(players, eq(contracts.playerId, players.id))
    .where(
      and(eq(contracts.teamId, currentTeam.id), eq(contracts.isActive, true))
    )
    .orderBy(players.position, players.name);

  // Get salary overrides
  const overrides = await db
    .select()
    .from(salaryOverrides)
    .where(
      eq(
        salaryOverrides.contractId,
        // We'll fetch all overrides for this team's contracts
        // Using a subquery approach
        0 // placeholder - handled below
      )
    );

  // Actually get overrides for all team contracts
  const contractIds = teamContracts.map((c) => c.id);
  const allOverrides =
    contractIds.length > 0
      ? await db
          .select()
          .from(salaryOverrides)
          .where(
            contractIds.length === 1
              ? eq(salaryOverrides.contractId, contractIds[0])
              : eq(salaryOverrides.contractId, contractIds[0]) // simplified
          )
      : [];

  // Build overrides map: contractId -> year -> salary
  const overrideMap = new Map<number, Map<number, number>>();
  for (const o of allOverrides) {
    if (!overrideMap.has(o.contractId)) {
      overrideMap.set(o.contractId, new Map());
    }
    overrideMap.get(o.contractId)!.set(o.year, Number(o.salary));
  }

  // Get all teams for lookup (needed for "Via" column in draft picks)
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamNameMap = new Map(allTeams.map((t) => [t.id, t.name]));

  // Get draft picks with original team info
  const teamDraftPicks = await db
    .select({
      id: draftPicks.id,
      year: draftPicks.year,
      round: draftPicks.round,
      pickNumber: draftPicks.pickNumber,
      originalTeamId: draftPicks.originalTeamId,
      currentTeamId: draftPicks.currentTeamId,
      isUsed: draftPicks.isUsed,
      salaryOverride: draftPicks.salaryOverride,
    })
    .from(draftPicks)
    .where(
      and(
        eq(draftPicks.currentTeamId, currentTeam.id),
        eq(draftPicks.isUsed, false)
      )
    )
    .orderBy(draftPicks.year, draftPicks.round);

  // Group players by position and sort by current season salary (descending)
  const positionOrder = ["QB", "WR", "RB", "TE"];
  const groupedContracts = positionOrder.map((pos) => ({
    position: pos,
    players: teamContracts
      .filter((c) => c.position === pos)
      .sort((a, b) => {
        const salaryA = calculateSalary(Number(a.salary2025), a.yearAcquired, currentSeason, undefined, a.salaryYear, a.acquisitionType as AcquisitionType);
        const salaryB = calculateSalary(Number(b.salary2025), b.yearAcquired, currentSeason, undefined, b.salaryYear, b.acquisitionType as AcquisitionType);
        return salaryB - salaryA; // Descending order
      }),
  }));

  // Calculate cap summary for current year
  const currentYear = currentSeason;
  const capContractsForCalc: ContractForCap[] = teamContracts.map((c) => ({
    id: c.id,
    playerId: c.playerId,
    playerName: c.playerName,
    position: c.position,
    salary2025: Number(c.salary2025),
    yearAcquired: c.yearAcquired,
    rosterStatus: c.rosterStatus,
    acquisitionType: c.acquisitionType,
    salaryYear: c.salaryYear ?? 2025,
  }));

  // Only include draft picks for the current year in cap calculation
  const draftPickCapHits: DraftPickCapHit[] = teamDraftPicks
    .filter((dp) => dp.year === currentSeason)
    .map((dp) => ({
      draftPickId: dp.id,
      year: dp.year,
      round: dp.round,
      originalTeam: dp.originalTeamId === currentTeam.id ? "Own" : "Trade",
      salary: dp.salaryOverride ?? getDraftPickCapValue(dp.round),
    }));

  const capSummary = calculateTeamCap(
    capContractsForCalc,
    draftPickCapHits,
    currentYear
  );

  // Prepare data for salary modeler
  const modelerPlayers: ModelPlayer[] = teamContracts.map((c) => ({
    contractId: c.id,
    playerName: c.playerName,
    position: c.position,
    salary2025: Number(c.salary2025),
    yearAcquired: c.yearAcquired,
    rosterStatus: c.rosterStatus,
    salaryYear: c.salaryYear ?? 2025,
  }));

  // Sort draft picks by round then year
  const sortedDraftPicks = [...teamDraftPicks].sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.year - b.year;
  });

  // Prepare draft picks for salary modeler
  const modelerDraftPicks: ModelDraftPick[] = teamDraftPicks.map((dp) => ({
    id: dp.id,
    year: dp.year,
    round: dp.round,
    pickNumber: dp.pickNumber,
    originalTeamId: dp.originalTeamId,
    originalTeamName: dp.originalTeamId !== currentTeam.id ? teamNameMap.get(dp.originalTeamId) : undefined,
    salaryOverride: dp.salaryOverride,
  }));

  function getRoundLabel(round: number) {
    switch (round) {
      case 1: return "1st";
      case 2: return "2nd";
      case 3: return "3rd";
      default: return `${round}th`;
    }
  }

  // Define consistent column widths for alignment across all tables (in pixels)
  // Mobile-friendly: smaller widths on mobile
  const colPixels = {
    player: 120, // Smaller for mobile, CSS will handle overflow
    yearAcq: 50,
    year: 60,
    status: 70,
    actions: 60,
  };

  // Colgroup to enforce exact column widths across all tables
  const TableColgroup = () => (
    <colgroup>
      <col style={{ width: colPixels.player }} />
      <col style={{ width: colPixels.yearAcq }} />
      {displayYears.map((year) => (
        <col key={year} style={{ width: colPixels.year }} />
      ))}
      <col style={{ width: colPixels.status }} />
      {canEdit && <col style={{ width: colPixels.actions }} />}
    </colgroup>
  );

  // Column classes for styling (padding, alignment) - responsive text sizes
  const colStyles = {
    player: "text-left text-xs md:text-lg",
    status: "text-right pl-2 md:pl-4 text-xs md:text-lg",
    yearAcq: "text-center text-xs md:text-lg",
    year: "text-right text-xs md:text-lg",
    actions: "text-right text-xs md:text-lg",
  };

  // Table class
  const tableClass = "table-fixed";

  // Row highlighting for roster status (distinct from position section colors)
  const getStatusRowClass = (rosterStatus: string) => {
    switch (rosterStatus) {
      case "practice_squad":
        return "bg-gray-100 dark:bg-gray-800/40";
      case "injured_reserve":
        return "bg-rose-200 dark:bg-rose-900/50"; // Distinct pink/rose, not red like QB
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 text-sm md:text-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">
            {currentTeam.name}
          </h1>
          {currentTeam.ownerName && (
            <p className="text-sm md:text-base text-muted-foreground">
              Manager: {currentTeam.ownerName}
            </p>
          )}
        </div>
        {canEdit && (
          <Badge variant="secondary" className="text-xs md:text-sm">
            {isCommissioner ? "Commissioner" : "Your Team"}
          </Badge>
        )}
      </div>

      {/* Cap Summary */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4">
        <Card className="p-2 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Salary Cap
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-lg md:text-2xl font-bold">${capSummary.salaryCap}</div>
          </CardContent>
        </Card>
        <Card className="p-2 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Total Salary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-lg md:text-2xl font-bold">${capSummary.totalSalary}</div>
          </CardContent>
        </Card>
        <Card className="p-2 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Cap Space
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div
              className={`text-lg md:text-2xl font-bold ${
                capSummary.capSpace >= 0 ? "text-green-600" : "text-destructive"
              }`}
            >
              {capSummary.capSpace >= 0
                ? `$${capSummary.capSpace}`
                : `-$${Math.abs(capSummary.capSpace)}`}
            </div>
          </CardContent>
        </Card>
        <Card className="p-2 md:p-0">
          <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              Roster
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="text-lg md:text-2xl font-bold">
              {capSummary.rosterCount}/32
            </div>
            <p className="text-xs text-muted-foreground">
              {capSummary.activeCount}A / {capSummary.practiceSquadCount}PS /{" "}
              {capSummary.irCount}IR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Year Cap Projection */}
      <Card>
        <CardHeader className="pb-2 px-3 md:px-6">
          <CardTitle className="text-sm md:text-lg font-extrabold tracking-tight">Salary Projection ({currentSeason}-{currentSeason + 2})</CardTitle>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <Table className={tableClass}>
              <TableColgroup />
              <TableHeader>
                <TableRow>
                  <TableHead className={`${colStyles.player} sticky left-0 bg-white dark:bg-slate-950`}></TableHead>
                  <TableHead className={colStyles.yearAcq}></TableHead>
                  {displayYears.map((year) => (
                    <TableHead key={year} className={colStyles.year}>
                      {year}
                    </TableHead>
                  ))}
                  <TableHead className={colStyles.status}></TableHead>
                  {canEdit && <TableHead className={colStyles.actions}></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className={`${colStyles.player} sticky left-0 bg-white dark:bg-slate-950 font-semibold`}>Cap</TableCell>
                  <TableCell className={colStyles.yearAcq}></TableCell>
                  {displayYears.map((year) => (
                    <TableCell key={year} className={colStyles.year}>
                      ${CAP_BY_YEAR[year] ?? 250}
                    </TableCell>
                  ))}
                  <TableCell className={colStyles.status}></TableCell>
                  {canEdit && <TableCell className={colStyles.actions}></TableCell>}
                </TableRow>
                <TableRow>
                  <TableCell className={`${colStyles.player} sticky left-0 bg-white dark:bg-slate-950 font-semibold`}>Salary</TableCell>
                  <TableCell className={colStyles.yearAcq}></TableCell>
                  {displayYears.map((year) => {
                    let total = 0;
                    // Add player salaries
                    for (const c of teamContracts) {
                      const salary = calculateSalary(
                        Number(c.salary2025),
                        c.yearAcquired,
                        year,
                        undefined,
                        c.salaryYear ?? 2025,
                        c.acquisitionType as AcquisitionType
                      );
                      total += calculateCapHit(salary, c.rosterStatus);
                    }
                    // Add draft pick salaries for picks in this year
                    for (const pick of teamDraftPicks) {
                      if (pick.year === year) {
                        const pickSalary = pick.salaryOverride ?? getDraftPickCapValue(pick.round);
                        total += pickSalary;
                      }
                    }
                    return (
                      <TableCell key={year} className={colStyles.year}>
                        ${total}
                      </TableCell>
                    );
                  })}
                  <TableCell className={colStyles.status}></TableCell>
                  {canEdit && <TableCell className={colStyles.actions}></TableCell>}
                </TableRow>
                <TableRow>
                  <TableCell className={`${colStyles.player} sticky left-0 bg-white dark:bg-slate-950 font-semibold`}>Space</TableCell>
                  <TableCell className={colStyles.yearAcq}></TableCell>
                  {displayYears.map((year) => {
                    const cap = CAP_BY_YEAR[year] ?? 250;
                    let total = 0;
                    // Add player salaries
                    for (const c of teamContracts) {
                      const salary = calculateSalary(
                        Number(c.salary2025),
                        c.yearAcquired,
                        year,
                        undefined,
                        c.salaryYear ?? 2025,
                        c.acquisitionType as AcquisitionType
                      );
                      total += calculateCapHit(salary, c.rosterStatus);
                    }
                    // Add draft pick salaries for picks in this year
                    for (const pick of teamDraftPicks) {
                      if (pick.year === year) {
                        const pickSalary = pick.salaryOverride ?? getDraftPickCapValue(pick.round);
                        total += pickSalary;
                      }
                    }
                    const space = cap - total;
                    return (
                      <TableCell
                        key={year}
                        className={`${colStyles.year} font-medium ${
                          space >= 0 ? "" : "text-destructive"
                        }`}
                      >
                        {space >= 0 ? `$${space}` : `-$${Math.abs(space)}`}
                      </TableCell>
                    );
                  })}
                  <TableCell className={colStyles.status}></TableCell>
                  {canEdit && <TableCell className={colStyles.actions}></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Roster by Position */}
      {groupedContracts.map((group) => {
        const colors = positionColors[group.position] || positionColors.QB;
        return (
        <Card key={group.position} className={`${colors.border} ${colors.bg}`}>
          <CardHeader className="pb-2 px-3 md:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm md:text-lg font-extrabold tracking-tight flex items-center gap-2 ${colors.text}`}>
                <span className="hidden md:inline">{getPositionName(group.position)}</span>
                <span className="md:hidden">{group.position}</span>
                <span className={`inline-flex items-center rounded-full px-1.5 md:px-2.5 py-0.5 text-xs md:text-sm font-semibold ${colors.badge}`}>
                  {group.players.length}
                </span>
              </CardTitle>
              {canEdit && (
                <AddPlayerInline
                  teamSlug={slug}
                  position={group.position}
                  label="Add"
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <div className="overflow-x-auto -mx-2 md:mx-0">
              <Table className={tableClass}>
                <TableColgroup />
                <TableHeader>
                  <TableRow>
                    <TableHead className={`${colStyles.player} sticky left-0 ${colors.cellBg}`}>
                      Player
                    </TableHead>
                    <TableHead className={colStyles.yearAcq}>Year</TableHead>
                    {displayYears.map((year) => (
                      <TableHead key={year} className={colStyles.year}>
                        {year}
                      </TableHead>
                    ))}
                    <TableHead className={colStyles.status}>Status</TableHead>
                    {canEdit && <TableHead className={colStyles.actions}>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.players.map((contract) => {
                    const statusRowClass = getStatusRowClass(contract.rosterStatus);
                    // Use status row class if present, otherwise fall back to position color
                    const cellBgClass = statusRowClass || colors.cellBg;
                    return (
                    <TableRow key={contract.id} className={statusRowClass}>
                      <TableCell className={`${colStyles.player} sticky left-0 ${cellBgClass} font-semibold truncate max-w-[100px] md:max-w-none`}>
                        {contract.playerName}
                      </TableCell>
                      <TableCell className={`${colStyles.yearAcq} ${cellBgClass}`}>
                        {contract.yearAcquired}
                      </TableCell>
                      {displayYears.map((year) => {
                        const override = overrideMap
                          .get(contract.id)
                          ?.get(year);
                        const salary =
                          override ??
                          calculateSalary(
                            Number(contract.salary2025),
                            contract.yearAcquired,
                            year,
                            undefined,
                            contract.salaryYear ?? 2025,
                            contract.acquisitionType as AcquisitionType
                          );
                        const capHit = calculateCapHit(
                          salary,
                          contract.rosterStatus
                        );
                        const isBumpYear = isLoyaltyBumpYear(contract.yearAcquired, year);
                        return (
                          <TableCell key={year} className={`${colStyles.year} ${cellBgClass}`}>
                            {isBumpYear ? (
                              <span
                                title={`Year 5 Loyalty Bump! Cap hit: $${capHit}`}
                                className="inline-block px-0.5 md:px-1 rounded border md:border-2 border-blue-700 bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 font-bold text-xs md:text-base"
                              >
                                ${salary}
                              </span>
                            ) : (
                              <span title={`Cap hit: $${capHit}`}>
                                ${salary}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`${colStyles.status} ${cellBgClass}`}>
                        {statusBadge(contract.rosterStatus)}
                      </TableCell>
                      {canEdit && (
                        <TableCell className={`${colStyles.actions} ${cellBgClass}`}>
                          <RosterActions
                            contractId={contract.id}
                            playerName={contract.playerName}
                            currentStatus={contract.rosterStatus}
                            teamSlug={slug}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                  {group.players.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4 + displayYears.length}
                        className="text-center text-muted-foreground text-xs md:text-base"
                      >
                        No players
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        );
      })}

      {/* Salary Modeler */}
      {canEdit && (
        <SalaryModeler
          players={modelerPlayers}
          draftPicks={modelerDraftPicks}
          currentSeason={currentSeason}
        />
      )}

      {/* Draft Picks */}
      <Card className="border-l-4 border-l-slate-500">
        <CardHeader className="pb-2 px-3 md:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm md:text-lg font-extrabold tracking-tight flex items-center gap-2 text-slate-700 dark:text-slate-400">
              Draft Picks
              <span className="inline-flex items-center rounded-full px-1.5 md:px-2.5 py-0.5 text-xs md:text-sm font-semibold bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {teamDraftPicks.length}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <Table className={tableClass}>
              <TableColgroup />
              <TableHeader>
                <TableRow>
                  <TableHead className={`${colStyles.player} sticky left-0 bg-white dark:bg-slate-950`}>
                    Pick
                  </TableHead>
                  <TableHead className={colStyles.yearAcq}>Via</TableHead>
                  {displayYears.map((year) => (
                    <TableHead key={year} className={colStyles.year}>
                      {year}
                    </TableHead>
                  ))}
                  <TableHead className={colStyles.status}></TableHead>
                  {canEdit && <TableHead className={colStyles.actions}>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDraftPicks.map((pick) => {
                  const defaultSalary = getDraftPickCapValue(pick.round);
                  const salary = pick.salaryOverride ?? defaultSalary;
                  const originalTeamName = teamNameMap.get(pick.originalTeamId) || "Unknown";
                  const isOwnPick = pick.originalTeamId === currentTeam.id;

                  // Use explicit classes for Tailwind to detect
                  const rowColorClass =
                    pick.round === 1 ? "bg-amber-100 dark:bg-amber-900/30" :
                    pick.round === 2 ? "bg-slate-200 dark:bg-slate-700/30" :
                    pick.round === 3 ? "bg-orange-100 dark:bg-orange-900/30" :
                    pick.round === 4 ? "bg-sky-100 dark:bg-sky-900/30" : "";

                  return (
                    <TableRow key={pick.id} className={rowColorClass}>
                      <TableCell className={`${colStyles.player} sticky left-0 ${rowColorClass} font-semibold truncate max-w-[100px] md:max-w-none`}>
                        <span className="hidden md:inline">{pick.year} {getRoundLabel(pick.round)} Rd Pick</span>
                        <span className="md:hidden">{pick.year} R{pick.round}</span>
                      </TableCell>
                      <TableCell className={`${colStyles.yearAcq} ${rowColorClass}`}>
                        {isOwnPick ? (
                          <span className="text-muted-foreground">Own</span>
                        ) : (
                          <span className="text-muted-foreground"><span className="hidden md:inline">via </span>{originalTeamName}</span>
                        )}
                      </TableCell>
                      {displayYears.map((year) => {
                        // Only show salary if this pick is for this year
                        const showSalary = pick.year === year;
                        return (
                          <TableCell key={year} className={`${colStyles.year} ${rowColorClass}`}>
                            {showSalary ? (
                              <span>${salary}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`${colStyles.status} ${rowColorClass}`}></TableCell>
                      {canEdit && (
                        <TableCell className={`${colStyles.actions} ${rowColorClass}`}>
                          <DraftPickActions
                            pickId={pick.id}
                            pickLabel={`${pick.year} ${getRoundLabel(pick.round)} Rd Pick`}
                            round={pick.round}
                            currentSalary={salary}
                            teamSlug={slug}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {teamDraftPicks.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3 + displayYears.length + (canEdit ? 1 : 0)}
                      className="text-center text-muted-foreground text-xs md:text-base"
                    >
                      No picks
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
