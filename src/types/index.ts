import { Database } from "./database.types";

export type CoachLinkTable = Database['public']['Tables'];

export type UsersRow = CoachLinkTable['users']['Row'];
export type UserProfilesRow = CoachLinkTable['user_profiles']['Row'];
