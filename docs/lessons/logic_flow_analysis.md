# 1RM Logic Flow & Weight Update Mechanism Analysis

## 1. Core Data Flow Overview

This document analyzes how the system handles 1RM updates and their propagation
to training plans.

### Key Components:

1. **Onboarding (Questionnaire)**: Where initial 1RM is captured.
2. **PR History (`personal_records_history`)**: The central repository for
   user's strength capabilities.
3. **Plan Template (`coach_plan_templates`)**: Stores abstract intensity (e.g.,
   "80% 1RM", "5RM").
4. **Plan Instance (`coach_plan_instances`)**: The concrete plan assigned to a
   student.
5. **Execution (`plan_instance_executions`)**: The actual workout session data.

---

## 2. The Logic Flow (Restored View)

The following flow describes how the system _should_ work (and likely worked
before recent modifications) to support dynamic weight updates.

### A. Updating the 1RM Source

**Action**: Coach/Student updates the Onboarding Questionnaire. **Code**:
`src/app/api/user/submit-onboarding/route.ts`

1. **Input**: User enters new 1RM values (e.g., Squat 100kg).
2. **Primary Storage**: Save to `onboarding_questionnaires`.
3. **Critical Link (Currently Disabled/Removed)**:
   - Logic: In the original design, this 1RM was _also_ written into
     `personal_records_history` as a baseline PR.
   - _Impact_: By updating `personal_records_history`, the specific action's
     "Current 1RM" is globally updated.

### B. Plan Generation & Application

**Action**: Coach assigns a plan or Student applies a template. **Code**:
`src/app/api/plan-lib/apply-favorite/route.ts` or `create-ai-instance`

1. **Fetch Template**: Retrieves abstract intensity (e.g., "5RM") from the
   template.
2. **Fetch User 1RM**:
   - _AI Generation_: Calls `get-current-1rm`.
   - _Manual Application_: Copies raw template data (Intensity: "5RM", Load:
     null).
3. **Calculation**:
   - If AI generated: Calculates specific weight (e.g., 5RM -> 85% * 100kg =
     85kg) and stores it in `load`.
   - If Templated: Stores `intensity: "5RM"`.

### C. Training Execution (Runtime)

**Action**: Student clicks "Start Training". **Code**:
`src/app/api/execution/start/route.ts` and `TrainingExecutionPage.tsx`

1. **Retrieve Plan Data**:
   - Reads `training_days` from `coach_plan_instances`.
   - Checks for `load` (absolute weight) or `intensity` (relative).
2. **Weight Display**:
   - If `load` exists: Prefills "85kg". (Static weight calculated at
     generation).
   - If only `intensity` ("5RM") exists: Displays "5RM".
   - _Hypothetical Dynamic Link_: If the system supports runtime updates,
     `start/route.ts` or the frontend must fetch the _latest_
     `personal_records_history` and re-calculate "85kg" from "5RM". **Current
     code analysis shows this step is missing or implicit.**

---

## 3. The "Dynamic Update" Discrepancy

**User Observation**: "When I update the questionnaire, the weight in the plan
automatically changes." **Code Finding**: Plan weights (`load`) are typically
static after generation.

**Explanation**: The "Automatic Update" likely relies on the **Regeneration** or
**Re-application** of the plan flow:

1. Coach updates Questionnaire -> Updates `PR History` (Vital Step).
2. Coach/Student _Regenerates_ or _Re-applies_ the plan.
3. New Plan uses updated `PR History` -> Calculates new higher weights.

**Why it broke**: By removing the logic in `submit-onboarding` that writes to
`PR History`, the link was severed. Even if the plan is regenerated, it no
longer sees the updated 1RM from the questionnaire because that data is locked
inside the questionnaire table and not exposed to the global 1RM calculator
(which reads `PR History`).

## 4. Current Status of Files

| File                         | Status                     | Role                                                    |
| :--------------------------- | :------------------------- | :------------------------------------------------------ |
| `submit-onboarding/route.ts` | **Modified (Broken Link)** | Writes to Questionnaire. (Write to PR History removed). |
| `get-current-1rm/route.ts`   | **Restored (Original)**    | Reads _only_ PR History. (Aggregation logic removed).   |
| `start/route.ts`             | **Static Logic**           | Reads existing plan weights. Does not re-calculate.     |
| `apply-favorite/route.ts`    | **Copy Logic**             | Copies template data. Does not re-calculate.            |

## 5. Summary

The dynamic behavior relies on `personal_records_history` being the "Source of
Truth". The `submit-onboarding` endpoint was the mechanism that synchronized
Questionnaire data to this Source of Truth. Removing that synchronization broke
the ability for _any_ part of the system (dynamic or static generation) to see
the new 1RM values.
