import { CoachActionRow } from "@/types";

export type GetActionRequest = {
  id: string;
};

export type GetActionResponse = {
  action?: CoachActionRow;
  success: boolean;
  message?: string;
};
