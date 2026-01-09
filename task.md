# Task: Fix Plan Synchronization & Dynamic 1RM Logic

## Objectives

- [ ] **Sync Pending Executions**: Ensure that "In Progress" (but pending)
      student executions automatically sync with the Coach's master plan.
- [ ] **Enable PR-Driven Updates**: Update the Coach Plan Editor
      (`ActionSetForm`) to use the _real_ aggregated 1RM (Max of Questionnaire &
      PRs) instead of just the Questionnaire.

## Implementation Steps

### 1. Synchronization Logic (Student Side)

- [ ] Modify `src/app/api/execution/start/route.ts` (or relevant getter)
  - [ ] When fetching an existing `in_progress` execution:
  - [ ] Compare its `planned_weight`/`reps` with the current
        `coach_plan_instances`.
  - [ ] If different (and student hasn't entered custom data?), update the
        execution record.

### 2. Dynamic 1RM Logic (Coach Side)

- [ ] Modify `src/app/dashboard/plan-lib/components/ActionSetForm.tsx`
  - [ ] Remove dependency on `subscription.subscribe_data` for 1RM.
  - [ ] Implement `e1rmService.getCurrent` to fetch the true 1RM for the action.
  - [ ] Use this true 1RM for `calcRecommendedLoad`.

## Verification

- [ ] **Test Sync**: Coach changes weight -> Student sees new weight immediately
      (without creating new day).
- [ ] **Test PR Update**: Student sets new PR -> Coach opens Editor -> Editor
      calculates weight based on new PR.
