# DECISIONS

- `2026-03-27`: Added persistent state files so `coachlink` context survives session resets and compaction better.
- `2026-03-27`: Project ownership must come from `IDENTITY.md` plus state files, not stale transcript memory.
- `2026-03-27`: Durable requirements, blockers, and handoffs must be written to files instead of relying on chat history alone.
- `2026-03-27`: For current Next.js 16 Turbopack dev stability, avoid `next/font/google` runtime fetch path in root layout; use system stack (`font-sans`) until a local-font strategy is introduced.
- `2026-03-27`: Plan load policy is unified as: fixed-weight sets preserve stored `params.load`; RM/% (dynamic-intensity) sets must refresh by current 1RM even if old load exists, in both `get-instance` and `execution/start`.
- `2026-03-27`: Use build-injected metadata (`NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_GIT_COMMIT_ID`, `NEXT_PUBLIC_BUILD_TIME`) as the single source for deploy version tracking; expose it through both `/api/system/version` and global HTML meta tags.
- `2026-03-28`: For coach-plan/student-plan 1RM resolution, do not trust raw `actionId` first. Old questionnaire RM keys can reuse historical coach action IDs and override the real current action 1RM. Resolve in priority order `canonical_action_id -> action name -> actionId`.
- `2026-03-28`: `getCurrent1RMRecords` is a server-only aggregation helper and must use `serviceRoleSupabase` after explicit permission checks; using the anonymous client can silently fall back to stale questionnaire RM data.
- `2026-03-28`: Legacy raw `actionId` RM lookup may remain only as a lowest-priority compatibility fallback. It must never outrank `canonical_action_id` or action-name matches, because historical questionnaire keys can reuse old coach action IDs and inject stale 1RM data.
