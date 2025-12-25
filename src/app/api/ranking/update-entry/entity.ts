import { LeaderboardEntriesRow } from "@/types";

export interface UpdateEntryDto {
  id: string;
  form_data?: any;
  score?: number | null;
  evidence_url?: string | null;
  status?: string;
}

export interface UpdateEntryResponseDto {
  entry: LeaderboardEntriesRow;
}