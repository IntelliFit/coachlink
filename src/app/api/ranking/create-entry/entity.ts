import { LeaderboardEntriesRow } from "@/types";

export interface CreateEntryDto {
  template_id: string;
  form_data: any;
  score?: number | null;
  evidence_url?: string | null;
  status?: string;
  user_id?: string;
}

export interface CreateEntryResponseDto {
  entry: LeaderboardEntriesRow;
}