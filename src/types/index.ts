import { Database } from "./database.types";

export type CoachLinkTable = Database['public']['Tables'];

export type UsersRow = CoachLinkTable['users']['Row'];
export type UserProfilesRow = CoachLinkTable['user_profiles']['Row'];
export type TrainingVideoRow = CoachLinkTable['training_videos']['Row'];
export type CoachesRow = CoachLinkTable['coaches']['Row'];
export type SpecialtiesRow = CoachLinkTable['specialties']['Row'];

export type TrainingPlanRow = CoachLinkTable['training_plans']['Row'];
export type CoachSubscriptionRow = CoachLinkTable['coach_subscriptions']['Row'];