import type { RosterStatus, Position, AcquisitionType } from "@/lib/constants";

export interface Team {
  id: number;
  name: string;
  slug: string;
  abbreviation: string;
  ownerName: string | null;
}

export interface Player {
  id: number;
  name: string;
  position: Position;
  nflTeam: string | null;
  isActive: boolean;
}

export interface Contract {
  id: number;
  playerId: number;
  teamId: number;
  salary2025: number;
  yearAcquired: number;
  acquisitionType: AcquisitionType;
  rosterStatus: RosterStatus;
  practiceSquadYears: number;
  isActive: boolean;
  notes: string | null;
}

export interface ContractWithPlayer extends Contract {
  player: Player;
}

export interface ContractWithPlayerAndTeam extends ContractWithPlayer {
  team: Team;
}

export interface DraftPick {
  id: number;
  year: number;
  round: number;
  pickNumber: number | null;
  originalTeamId: number;
  currentTeamId: number;
  playerId: number | null;
  isUsed: boolean;
}

export interface DraftPickWithTeams extends DraftPick {
  originalTeam: Team;
  currentTeam: Team;
}

export interface Trade {
  id: number;
  tradeDate: string;
  season: number;
  notes: string | null;
}

export interface TradeAsset {
  id: number;
  tradeId: number;
  assetType: "player" | "draft_pick";
  playerId: number | null;
  draftPickId: number | null;
  fromTeamId: number;
  toTeamId: number;
  description: string | null;
}

export interface TradeWithDetails extends Trade {
  participants: { team: Team }[];
  assets: (TradeAsset & {
    player?: Player | null;
    fromTeam: Team;
    toTeam: Team;
  })[];
}

export interface TeamWithCap extends Team {
  capSpace: number;
  totalSalary: number;
  salaryCap: number;
  rosterCount: number;
}
