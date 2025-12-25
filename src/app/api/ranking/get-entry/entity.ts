import { LeaderboardEntriesRow } from "@/types";

export interface GetEntryDto {
  id: string;
}

export interface GetEntryResponseDto {
  entry: LeaderboardEntriesRow;
}