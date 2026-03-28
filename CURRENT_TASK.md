# CURRENT_TASK

- Task: Fix wrong low loads caused by stale questionnaire RM keys overriding real action 1RM mappings
- Scope:
  - confirmed with real Water subscription data that Day 51 pull-up was incorrectly resolving `actionId -> questionnaire RM 53` instead of `canonical/name -> student action 1RM 65`
  - `src/app/api/student/get-current-1rm/route.ts` now uses service-role Supabase client for server-side 1RM aggregation after explicit permission checks
  - `src/app/api/plan-lib/get-instance/route.ts` now resolves 1RM in priority order `canonical -> name -> actionId`
  - `src/app/api/execution/start/route.ts` now resolves 1RM in priority order `canonical -> name -> actionId`
  - `src/app/api/plan-lib/create-ai-instance/match.ts` and `service.ts` aligned to the same lookup priority for newly generated plans
  - legacy raw `actionId` lookup is kept only as a last-resort compatibility fallback and must never override canonical/name matches
  - recent main-branch work also added deploy version traceability (`appVersion + gitCommitId + buildTime`) via build metadata, version helper, APIs, and meta tags
- Status: completed
- Supporting work on `2026-03-29` for linked miniapp `寻找单杠`:
  - added backend-backed location contributor leaderboard instead of client-side full-table aggregation
  - enriched `/api/streetlifting-index/stats` with location overview analytics for mobile summary cards
  - location create/update now persist contributor identity fields and rebuild contributor aggregates after writes
- Blocker: repository still has historical TypeScript errors unrelated to this fix (`npm run typecheck` not fully green baseline)
- Next step: verify with coach `枭马葛` and student `water` that Day 51 pull-up now resolves to `57.9kg / 50.1kg` instead of the stale `46.5kg / 39.4kg`
- Last updated: `2026-03-29`
