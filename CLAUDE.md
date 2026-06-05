# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

This is a **monorepo with two products** sharing one git history:

- **Web (主站)** — Next.js 16 App Router. All code under `src/`. This is what `npm run dev` / `npm run build` operate on.
- **WeChat Mini Program (微信小程序)** — Taro 4.x React project under `wechat_app/`. Has its own `package.json`, build pipeline, and `node_modules`. Never put a top-level `app/` directory at the repo root — Next.js will treat it as App Router and clobber `src/app/` routes.

Both products talk to the same Supabase backend. The mini-program calls Web API routes; do not invent mini-program-only API contracts when a Web one exists (see `DECISIONS.md` for the long list of parity calls).

## Commands

### Web (run from repo root)

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server via `scripts/start-dev.mjs`. Auto-cleans `.next/dev` cache and restarts on `ENOENT`/manifest errors (up to 5 times). Defaults to Webpack; set `COACHLINK_FAST_DEV=1` for Turbopack + larger heap. |
| `npm run build` | Production build via `scripts/build-prod.js`. Wipes `.next/`, runs `next build` (Turbopack default; `COACHLINK_BUILD_USE_WEBPACK=1` to fall back), then copies `static/`, `public/`, and `docs/assets/` into `.next/standalone/` (deployable artifact). |
| `npm run start` | Production start via `scripts/start-prod.mjs`. It runs the same config bootstrap before `next start` or standalone `server.js`. |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.typecheck.json`. **This is the real lint gate** — `ignoreBuildErrors: true` in `next.config.ts` means production build will not catch type errors. The `tsconfig.typecheck.json` excludes `wechat_app/`, `.next/`, and other historical noise so the gate stays green; new errors in the maintained surface must be fixed. |
| `npm run lint` | **No-op stub.** Next 16 removed `next lint` and ESLint isn't installed here. The script just prints a hint to run typecheck. Don't add ESLint without team agreement. |
| `npm test` | `vitest run` — unit tests in `src/**/*.test.ts` and `tests/**/*.test.ts`. Reports go to `test-results/vitest/`. Run a single file with `npx vitest run path/to/file.test.ts`. |
| `npm run test:watch` | Vitest watch mode. |
| `npm run test:e2e` | `playwright test` — specs in `e2e/`. The runner spawns `node scripts/start-dev.mjs` on port 3000 with `reuseExistingServer: true` (uses your already-running `npm run dev` if present, avoiding `.next/dev/lock` collisions). |
| `npm run check-env` | Legacy env-file presence check. Runtime source selection is now governed by root `.env`; see Runtime configuration below. |
| `npm run pre-deploy-check` | Pre-deploy validation. |
| `npm run push-docker-ccr` | Build & push the Docker image to Tencent Cloud CCR (`ccr.ccs.tencentyun.com/coachlink/coachlink:production`). |

**Push gate (required before `git push`):** `npm run typecheck && npm test && npm run test:e2e` — `npm run lint` is a no-op so the typecheck step replaces it.

### Runtime configuration

Web runtime config is a strict single-source model documented in `docs/done/system-design/runtime-config.md`.

- Root `.env` is the bootstrap file. It selects `CONFIG_SOURCE=local` or `CONFIG_SOURCE=apollo`.
- `local` loads exactly one business env file: `LOCAL_ENV_FILE`, defaulting to `.env.development` for dev and `.env.production` for production build/start.
- `apollo` reads only Apollo bootstrap settings from `.env`, then fetches all business config from Apollo. It must not load or merge `.env.development`, `.env.production`, or `.env.local`.
- `APOLLO_CONFIG_SERVER_URL` must be the final URL, preferably `https://...`. Do not use an `http://` URL that redirects to HTTPS, because Node fetch can drop `Authorization` / `Timestamp` across cross-protocol redirects and Apollo will log them as null.
- Normal Web commands (`npm run dev`, `npm run build`, `npm run start`) all go through `scripts/config/bootstrap-env.mjs`, which marks Next env loading as already processed so Next.js does not auto-merge local `.env*` files.
- `NEXT_PUBLIC_*` values are build-time client values. If Apollo owns them, Apollo must be reachable and correct before `npm run build`.

Do not tell collaborators to copy `.env.example` to `.env.local` for Web runtime setup. The correct answer is to configure root `.env` and then populate either the selected local env file or Apollo.

### WeChat Mini Program (run from `wechat_app/`)

| Command | Purpose |
| --- | --- |
| `npm run dev:weapp` | Watch build for WeChat dev tools (`scripts/dev-weapp-with-fixes.js local`). |
| `npm run build:weapp` | Local build. |
| `npm run build:weapp:release` | Release build for upload. |
| `npm run build:h5` / `:alipay` / `:tt` / `:swan` | Cross-platform Taro builds. |

The mini-program is built into `wechat_app/dist/`; do not edit `dist/` by hand. After changing pages or component paths, you may need `npm run fix:weapp-wxml` or `npm run fix:weapp-comp` (the dev script normally chains these automatically).

## High-level architecture

### Layered request flow (do not bypass)

```
Page / Component  →  src/app/service/*Service.ts  →  src/app/api/*/route.ts  →  Supabase
                          (web-side service)             (Next.js Route Handler)
```

The mini-program has its own service layer at `wechat_app/src/services/` that calls the same Web API routes via `wechat_app/src/utils/request.ts`. Frontend code (Web or mini-program) **must not** hit Supabase directly. Identity comes from the session/JWT — never trust user-supplied user IDs in API handlers, and always enforce coach/student boundary checks server-side.

### Five business primitives (memorize these — see `docs/PROJECT_BIBLE.md` for the full bible)

1. **User** — single user can carry both Coach and Student roles.
2. **CoachSubscription** — coach↔student contract under the **B1 credits model**. The product sells "4 weeks / 1 month" but internally tracks **training-day credits**; `start_date` is set on the *first training execution* (not on payment), and `end_date` is an *estimated completion date* for UI only — expiry is decided by `remainingCredits === 0`.
3. **CoachPlanTemplate / CoachPlanInstance** — templates are reusable; instances are deep-copied per student and edited independently. `coach_plan_instances.start_execution_day` supports starting from a non-1 dayIndex (offline migration).
4. **PlanInstanceExecution** — student's *real* execution record. **Foreign key is `instance_id`** (a historical bug used `plan_instance_id` and froze "today's training" on day 1 forever — do not regress).
5. **Membership / Quota** — entitlement config in `MEMBER_BENEFITS`, per-user counters in `student_quotas`. Lazy-reset: monthly quotas are only refreshed when the user *uses* the feature and `last_reset_date` is in a previous month. Downgrades soft-limit (block uploads) without deleting data.

Credits accounting lives in `src/lib/subscriptionCredits.ts` (treat the matching `.test.ts` as executable spec). Auto-weight calculation in `src/lib/rmCaculator.ts` — RM mode adds bodyweight `αW` for self-loaded movements (squat, pull-up, push-up, plank), percentage mode does not.

### Top-level Web routes (`src/app/`)

- `api/` — Route Handlers grouped by domain: `coach/`, `plan-lib/`, `execution/`, `subscription/`, `membership/`, `payment/`, `chat/`, `knowledge/`, `push/`, `wechat/`, etc. Coach-facing endpoints assume coach session; student-facing assume student.
- `service/` — Higher-level service modules used by route handlers (`alipayService`, `subscriptionService`, `studentMembershipService`, `executionService`, `fulfillmentService`, ...).
- `dashboard/` — Coach workstation (Web). Sub-areas: `plan-lib`, `students`, `questionnaire`, `content`, `revenue`, `wallet`, `videos`, `knowledge`, `chat`, `pricing`.
- `coach/profile/[id]/` — Public coach profile + subscription/questionnaire flow for prospective students.
- `today-training/`, `training-execution/`, `impromptu-training/` — Student-side execution surfaces.
- `me/` — Student profile and membership dashboard. Web `/me/membership` is the source of truth for the mini-program "我的会员" page.

### Supabase

- Migrations: `supabase/migrations/*.sql`, ordered by date prefix (`20251121_…` → `20260422_…`). Apply in order; the codebase often runs in *compatibility mode* if a migration hasn't been applied yet (queries gracefully avoid columns that don't exist) — when you see `column X does not exist` errors, check whether the migration file exists and whether prod has run it.
- Generated types: `src/types/database.types.ts`. Regenerate via `scripts/update-supabase-types.bash`.
- Schema reference: `supabase_schema.md` (huge file; use Grep to locate tables).

## Project-specific conventions

These are non-obvious rules from `AGENTS.md` / `.cursorrules` that you cannot infer from the code:

### Verification & verification skills

- **Web UI changes** must be verified using the `web-devtools` skill (browser screenshots + at least one interaction path that exercises the change).
- **Mini-program UI changes** must be verified using the `weapp-devtools` skill — it's different from Web verification.
- If verification can't run, say so explicitly in the final reply rather than claiming success.
- Exception: if the user says they'll verify manually (e.g., "不用你测试，我来手动运行就行"), skip UI verification and state that in the reply.

### Design rules (enforced)

- **No gradient backgrounds on buttons** — `linear-gradient` / `radial-gradient` are forbidden. Primary buttons use brand color `#CF6D4E`; secondary use white with border. `:active` may only adjust opacity/darken, never switch to a gradient.
- **8rpx grid (mini-program)** — `margin`, `padding`, `gap`, and element dimensions must be multiples of 8rpx. `border-radius` should be 8/16/24/32/48rpx (or 9999rpx for pills). `font-size`, `line-height`, `border-width`, `box-shadow`, `letter-spacing` are exempt.

### Mobile data caching contract (mini-program)

Local-first, cloud wins on conflict, 60-day retention. Two well-known cache surfaces:

| Use | Storage key | Utility |
| --- | --- | --- |
| Today's training page aggregate (subscription + plan + per-day execution summaries) | `today_training_page_cache_v1` | `wechat_app/src/utils/todayTrainingPageCache.ts` |
| Training execution snapshot (full execution + planInstance + actions) | `training_execution_snapshots_v1` | `wechat_app/src/utils/trainingExecutionCache.ts` |

When adding any UI that mutates execution state, the success callback **must** persist via the existing `syncTrainingExecutionToStorage` / `syncExecutionToCaches` style helpers and call `patchExecutionInTodayTrainingPageCache` for the matching `instanceId` — otherwise users see stale progress when returning to the today-training page on weak networks.

### Test discipline

- Tests must be idempotent — every created row is tracked and removed in `finally` (or equivalent), even on assertion failure.
- **Do not modify existing tests** (`*.test.ts`, `e2e/*.spec.ts`, test config) unless the user explicitly asked for a test change. If a business change breaks a test, surface the failure and let the user decide.
- The repo carries known historical type errors. Focus on *new* errors in `npm run typecheck`.

### Knowledge capture (recurring bugs)

When a fix matches one of these triggers, append durable notes:

1. Same bug pattern appears in 2+ different files/modules; or
2. Bug belongs to a high-risk class: index mismatch (`dayIndex` vs `arrayIndex`), async state/persistence mismatch, `null`/`undefined`/`''` semantic mismatch, permission/session boundary mismatch; or
3. The fix has CRUD/list-edit regression risk.

Where to write:
- Pattern-level: append a compact block to `docs/done/engineering/高频复发Bug清单.md` (现象 / 根因 / 统一规则 / 改动前自检).
- Checkable guardrails: append to `docs/done/engineering/代码检查清单.md` (错误示例 vs 正确示例 + checklist item).

In the final reply for any non-trivial coding task, include:
- `是否触发知识沉淀：是/否`
- `若是，已更新文件：…`

### Durable state files (read at session start)

The agent setup expects these to be the source of truth over chat memory. Read them at session start and after any compaction:

- `IDENTITY.md`, `SOUL.md`, `USER.md` — agent identity, project ownership, user profile.
- `PROJECT_STATE.md`, `CURRENT_TASK.md`, `DECISIONS.md` — current work, durable architectural decisions.
- `memory/YYYY-MM-DD.md` — dated working notes; create one for today if absent before doing non-trivial work.

`DECISIONS.md` is the long-running ledger of "we already decided this" — search it before making cross-cutting calls (especially Web↔mini-program parity, payment flows, knowledge-base structure).

### Git remotes (push behavior)

`origin` is configured to **push to both GitHub and Gitee simultaneously**. `git remote -v` should show two push URLs. CI deploys from main; merging to `main` triggers automated deployment.

## Common gotchas (from `docs/PROJECT_BIBLE.md` §5)

1. `coach_subscriptions.end_date` is **not** a hard expiry under the B1 model — only `remainingCredits === 0` ends a subscription.
2. `plan_instance_executions.instance_id` is the correct foreign key; using `plan_instance_id` will silently break "next day" calculation.
3. "Cover current plan" vs "new phase" change `dayIndex` semantics — statistics align by dayIndex, so covering can produce phantom progress.
4. Questionnaire `is_active`/`status` and `is_default`/`coaches.profile.default_questionnaire_id` may diverge — `set-default-questionnaire` must sync both sides.
5. Web Push permission requires a real user gesture (especially on iOS 16.4+).

## Where to look for deeper context

- `docs/PROJECT_BIBLE.md` — onboarding bible (business, schema, key code pointers per module).
- `docs/done/engineering/PROMPT.md` — preflight checklist for engineering changes.
- `docs/FEATURES.md` — feature inventory with per-item design/analysis links.
- `AGENTS.md` — operational rules for coding agents (this file is the human-readable mirror; both should stay in sync if you edit one).
- `DECISIONS.md` — append-only architectural decision log.
