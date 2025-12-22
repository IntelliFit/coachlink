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
export type CoachPricingRow = CoachLinkTable['coach_pricing']['Row'];
export type CoachReviewRow = CoachLinkTable['coach_reviews']['Row'];
export type CoachPlanInstanceRow = CoachLinkTable['coach_plan_instances']['Row'];
export type CoachStudentCommentRow = CoachLinkTable['student_comments']['Row'];
export type TrainingItemRow = CoachLinkTable['training_items']['Row'];
export type CoachApplicationRow = CoachLinkTable['coach_applications']['Row'];