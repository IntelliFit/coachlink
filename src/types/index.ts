import { Database } from "./database.types";

export type CoachLinkTable = Database["public"]["Tables"];

export type UsersRow = CoachLinkTable["users"]["Row"];
export type UserProfilesRow = CoachLinkTable["user_profiles"]["Row"];
export type TrainingVideoRow = CoachLinkTable["training_videos"]["Row"];
export type ExecutionSetVideoRow =
    CoachLinkTable["execution_set_videos"]["Row"];
export type PlanInstanceExecutionRow =
    CoachLinkTable["plan_instance_executions"]["Row"];
export type CoachesRow = CoachLinkTable["coaches"]["Row"];
export type SpecialtiesRow = CoachLinkTable["specialties"]["Row"];

export type TrainingPlanRow = CoachLinkTable["training_plans"]["Row"];
export type TrainingDetailRow = CoachLinkTable["training_plan_details"]["Row"];
export type CoachSubscriptionRow = CoachLinkTable["coach_subscriptions"]["Row"];
export type CoachContentRow = CoachLinkTable["coach_contents"]["Row"];
// CoachActionRow 使用自定义类型以支持 type 字段（数据库迁移后会自动同步）
export type { CoachActionInsert, CoachActionRow } from "./coach";

export type CoachPlanTemplateRow =
    CoachLinkTable["coach_plan_templates"]["Row"];
export type CoachQuestionnairesRow =
    CoachLinkTable["coach_questionnaires"]["Row"];
export type CoachPricingRow = CoachLinkTable["coach_pricing"]["Row"];
export type CoachReviewRow = CoachLinkTable["coach_reviews"]["Row"];
export type CoachPlanInstanceRow =
    CoachLinkTable["coach_plan_instances"]["Row"];
export type CoachStudentCommentRow = CoachLinkTable["student_comments"]["Row"];
export type CoachContentColumnRow =
    CoachLinkTable["coach_content_columns"]["Row"];
export type TrainingItemRow = CoachLinkTable["training_items"]["Row"];
export type CoachApplicationRow = CoachLinkTable["coach_applications"]["Row"];
export type LeaderboardTemplateRow =
    CoachLinkTable["leaderboard_templates"]["Row"];
export type LeaderboardEntriesRow =
    CoachLinkTable["leaderboard_entries"]["Row"];

export type KnowledgeBookRow = CoachLinkTable["knowledge_books"]["Row"];
export type KnowledgeSubscriptionRow =
    CoachLinkTable["knowledge_subscriptions"]["Row"];
export type KnowledgeVideoRow = CoachLinkTable["knowledge_videos"]["Row"];
export type KnowledgeProgressRow = CoachLinkTable["knowledge_progress"]["Row"];

// 强度描述系统类型
export * from "./intensity";

// 项目类型（力量/饮食/有氧/习惯）
export type { ItemType } from "./student";

// 计划项目多态类型
export * from "./plan-item";
