import { LeaderboardEntriesRow } from "@/types";

export interface DeleteEntryDto {
  id: string;
}

export interface DeleteEntryResponseDto {
  entry: LeaderboardEntriesRow;
}