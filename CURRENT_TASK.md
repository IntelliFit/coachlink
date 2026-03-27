# CURRENT_TASK

- Task: Fix mixed old/new plan loads after progress day (e.g. Day 51 shows correct load on progressed days but stale load on future days)
- Scope:
  - added unified dynamic-intensity detector `hasDynamicIntensityTarget` in `src/lib/rmCaculator.ts`
  - updated `src/app/api/plan-lib/get-instance/route.ts`:
    - fixed-weight sets keep stored `params.load`
    - RM/% sets now refresh load even when an old `params.load` exists
  - updated `src/app/api/execution/start/route.ts` with the same policy when generating planned set weights
- Status: completed (code + checks done, pending user-side data verification)
- Blocker: repository still has historical TypeScript errors unrelated to this fix (`npm run typecheck` not fully green baseline)
- Next step: verify with coach `枭马葛` and student `water` on Day 51 that post-progress future training days no longer keep stale loads
- Last updated: `2026-03-27`
