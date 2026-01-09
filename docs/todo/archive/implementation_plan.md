# Plan Sync & Dynamic 1RM Fix

## Goal Description

Resolve the two key synchronization issues identified in the system:

1. **Sync Delay**: Student execution views are "stuck" on old snapshots even if
   the Coach updates the plan.
2. **Missing PR Updates**: Coach Plan Editor calculates weights based _only_ on
   the Questionnaire, ignoring recent PRs.

## User Review Required

> [!IMPORTANT]
> This change modifies how "In Progress" training days are handled. If a student
> has already started a day, we will now _overwrite_ their planned weights with
> the Coach's latest plan, while preserving their _actual_ inputs (completed
> sets).

## Proposed Changes

### Component: Student Execution (Sync Fix)

#### [MODIFY] [start/route.ts](file:///d:/files/coachlink/src/app/api/execution/start/route.ts)

- Logic Update: When retrieving an existing `in_progress` execution:
  1. Fetch the latest `coach_plan_instances` for that day.
  2. Check for discrepancies in `planned_weight`, `reps`, or `sets` between the
     Execution Snapshot and the Master Plan.
  3. If differences exist, update the `action_executions` in the DB (syncing
     Master -> Snapshot) before returning the data.
  4. _Constraint_: Do not overwrite `completed` sets or user-entered
     `actual_weight`.

### Component: Coach Plan Editor (Dynamic 1RM Fix)

#### [MODIFY] [ActionSetForm.tsx](file:///d:/files/coachlink/src/app/dashboard/plan-lib/components/ActionSetForm.tsx)

- **Remove**: Logic that reads `subscription.subscribe_data` for 1RM.
- **Add**: Logic to fetch `current1RM` using the `e1rmService` (or direct API
  call to `/api/student/get-current-1rm`).
- **Behavior**: On component mount or action change, fetch the _true_ aggregated
  1RM (Questionnaire + PRs) and use it for `calcRecommendedLoad`.

## Verification Plan

### Manual Verification

1. **Sync Test**:
   - Student starts Day 1 (starts "In Progress", weight 50kg).
   - Coach updates Day 1 weight to 60kg.
   - Student refreshes/re-enters Day 1.
   - **Success**: Student sees 60kg.
2. **Dynamic 1RM Test**:
   - Student logs a PR (e.g., Squat 100kg).
   - Coach opens Plan Editor for that student.
   - **Success**: Editor auto-calculates weights based on 100kg (not the old
     questionnaire value).
