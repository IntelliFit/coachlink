import { Database } from "./database.types";

export type CoachLinkTable = Database['public']['Tables'];

export type UsersRow = CoachLinkTable['users']['Row'];
export type UserProfilesRow = CoachLinkTable['user_profiles']['Row'];
export type TrainingVideoRow = CoachLinkTable['training_videos']['Row'];
export type CoachesRow = CoachLinkTable['coaches']['Row'];
export type SpecialtiesRow = CoachLinkTable['specialties']['Row'];

export type TrainingPlanRow = CoachLinkTable['training_plans']['Row'];
export type TrainingDetailRow = CoachLinkTable['training_plan_details']['Row'];
export type CoachSubscriptionRow = CoachLinkTable['coach_subscriptions']['Row'];
export type CoachContentRow = CoachLinkTable['coach_contents']['Row'];
export type CoachActionRow = CoachLinkTable['coach_actions']['Row'];

export type CoachPlanTemplateRow = CoachLinkTable['coach_plan_templates']['Row'];
export type CoachQuestionnairesRow = CoachLinkTable['coach_questionnaires']['Row'];

