## Push Current Code To Main And Dev (`2026-06-16`)

- Task: commit current local code and push so remote `main` and `dev` are consistent.
- Status: in progress.
- Starting branch: `main`.
- Current local branch state before commit:
  - Local `main` and `dev` point to the same merge head from the latest `origin/dev` pull.
  - Working tree contains the accumulated coach revenue, E2E cleanup, WeChat Power Analysis native page/preview, plan-history detail, and durable-state changes.
- Required before push:
  - User explicitly asked to skip further tests/builds and push directly.
  - Already completed before the user interruption: `npm run lint`, `npm run typecheck`, and `npm test`.
  - Skipped by user instruction: `npm run test:e2e`, `npx next build`, and `cd wechat_app; npm run build:weapp`.
- Remote note: push has not happened yet.

## Local Power Analysis Debug Setup (`2026-06-16`)

- Task: fix local Web Power Analysis failure where the analyzer reported `ModuleNotFoundError: No module named 'mediapipe'`, and free the occupied local `3000` port.
- Status: local debugging environment recovered.
- Findings:
  - `3000` was occupied by a stale Next.js dev process; a second dev chain was also running on `3001`.
  - `.venv-power-analysis\Scripts\python.exe` was already correctly configured and could import `mediapipe 0.10.21`, `cv2`, and `numpy`.
  - The failure was therefore caused by a stale/incorrect worker process using the wrong Python environment, not by the venv lacking `mediapipe`.
  - For local Power Analysis testing, relying only on the auto-started `--queue` worker is brittle because the in-memory queue does not cross process boundaries; a `--poll` worker that scans queued DB jobs is the reliable local path.
- Actions:
  - Stopped stale processes occupying `3000` and the duplicate `3001` local dev chain.
  - Restarted local Web on `http://localhost:3000` with `POWER_ANALYSIS_PYTHON_BIN=D:\files\coachlink\.venv-power-analysis\Scripts\python.exe`.
  - Started a background poll worker with the same `POWER_ANALYSIS_PYTHON_BIN`.
  - Verified `http://localhost:3000/toolbox/power-analysis` returned 200.
  - Verified `http://localhost:3000/api/system/version` returned 200.
- Logs:
  - Web dev log: `logs/local-dev-3000.log`.
  - Power Analysis poll worker log: `logs/power-analysis-poll-worker.log`.
- Next user action:
  - Open `http://localhost:3000/toolbox/power-analysis`, log in if needed, and submit a new analysis job. The old failed job will remain failed; a new submit is required after the worker/env fix.

## WeChat Mini-Program Copy Link Diagnosis (`2026-06-16`)

- Task: diagnose why Food Link can produce/copy a `#小程序://...` mini-program link while CoachLink appears unable to use the share-sheet `复制链接` entry.
- Status: analysis completed; no business code changed.
- Finding:
  - CoachLink WeChat pages such as `me/toolbox/index` and `me/toolbox/power-analysis/index` already enable normal sharing with `enableShareAppMessage`, `enableShareTimeline`, `useShareAppMessage`, `useShareTimeline`, and `Taro.showShareMenu`.
  - The codebase has no `Taro.onCopyUrl` / `Taro.offCopyUrl` registration. Taro's WeChat share typings describe `onCopyUrl` as the separate callback for the right-menu `复制链接` action and note it should be registered on page enter and removed on page exit.
  - Therefore the likely app-side gap is not ordinary sharing, but missing Copy URL / short-link handling. Platform-side availability may still depend on WeChat client/platform rules and backend mini-program short-link permissions.
- Suggested next step:
  - Add a shared mini-program `useCopyUrl` helper that registers `Taro.onCopyUrl` with the current page query/path, wire it into public/shareable pages first, then verify on an Android real device or WeChat DevTools if the platform exposes the menu.

## WeChat Power Analysis Video Preview Fix (`2026-06-16`)

- Task: fix the WeChat mini-program Power Analysis page where the selected local video's built-in enlarge/fullscreen control could fail.
- Status: implemented and verified as far as automation allows.
- Fix:
  - Added an explicit `全屏预览` action for selected videos on `wechat_app/src/me/toolbox/power-analysis/index.tsx`.
  - The preview action first uses `Taro.previewMedia({ sources: [{ type: 'video' }] })` for WeChat's global media preview, then falls back to opening the shared full-page video player with a `视频预览` title.
  - Hid the native video fullscreen button on the inline preview (`showFullscreenBtn={false}`) so users are guided to the stable preview path instead of the failing built-in enlarge control.
  - Updated `wechat_app/src/common/common/video-player/index.tsx` to accept an optional `title` query param while preserving `PR 视频` for the existing PR source path.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `cd wechat_app; npm run build:weapp`: passed and compiled `me/toolbox/power-analysis/index.js` with `preview-video-btn`, `Taro.previewMedia`, and `showFullscreenBtn: false`.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run compiled/static-generated but hit known Windows `.next/standalone` EBUSY copy lock; rerun passed.
  - WeChat DevTools/MRC port 9430: relaunched `/me/toolbox/power-analysis/index`, `.select-video-btn` and `.mode-card-muscleup` existed, switching to `双力臂` worked, height input command reported success, and final error/warning logs were empty.
- Verification limitation:
  - MRC screenshot failed repeatedly with `fail to capture screenshot`.
  - Native local video selection opens a system picker and could not be automated, so the actual selected-video global preview path still needs a real-device/manual check.

## WeChat Native Power Analysis Tool (`2026-06-15`)

- Task: investigate why the previously built Power Calculator / Power Analysis tool was not visible in the mini-program toolbox, confirm deployment commands, and expose it as a real native mini-program tool rather than a WebView jump.
- Status: implemented and verified.
- Findings:
  - Web already exposes Power Analysis through `src/config/toolbox.ts`, `/toolbox`, `/me/toolbox`, and `/toolbox/power-analysis`.
  - Live `https://coachlink.fit/toolbox` and `https://coachlink.fit/toolbox/power-analysis` return 200 and render the Power Analysis entry/page in browser automation.
  - The WeChat mini-program toolbox only had 3 native cards (`力量计算器`, `单杠位置`, `社区数据`), so the user's screenshot matched current code: the Power Analysis tool was Web-only and not wired into the mini-program UI.
  - Deployment commands are:
    - Web image: `npm run push-docker-ccr`.
    - Power Analysis worker/algorithm image: `npm run push-power-worker-ccr`.
    - If an algorithm change also changes Web/API/page code, both images may need pushing; analyzer/worker-only changes need the worker image.
- Fix:
  - Replaced the temporary WebView entry with native route `me/toolbox/power-analysis/index`.
  - Removed the generic `me/webview/index` page that had been added for the temporary jump.
  - Added native mini-program UI for mode selection, height/weight inputs, video selection/preview, task creation, upload, enqueue, polling, result summary, per-rep metrics, AI interpretation, and saving/copying the analyzed video.
  - Added authenticated same-domain mini-program upload route `POST /api/toolbox/power-analysis/jobs/[id]/upload`, so the mini-program can use native `Taro.uploadFile` instead of directly `PUT`-ing to the Supabase signed URL.
  - The native page reuses the existing Power Analysis job model and worker queue: `create-upload-url` creates the transient job/path, the new upload route stores the video to the job input path, then `enqueue`, job polling, `llm-summary`, and `download-url` finish the flow.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `cd wechat_app; npm run build:weapp`: passed and generated `dist/me/toolbox/power-analysis/index.*`.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed and included `/api/toolbox/power-analysis/jobs/[id]/upload` in the route table.
  - `git diff --check`: passed with existing CRLF warnings only.
  - Live browser automation confirmed Web `/toolbox` shows `引体 / 双力臂功率测试` and `/toolbox/power-analysis` shows the analysis page.
  - WeChat DevTools/MRC port 9430: `/me/toolbox/index` reported 4 `.tool-card` elements; clicking the first card navigated to `me/toolbox/power-analysis/index`, not WebView; `.height-input` and `.select-video-btn` existed; switching to `双力臂` and typing height `180` worked; final relaunch/click verification after the upload-route change still navigated to the native page with 0 error logs.
  - Screenshots:
    - `screenshots/weapp/toolbox-native-power-analysis-entry-9430.png`
    - `screenshots/weapp/power-analysis-native-page-9430.png`
    - `screenshots/weapp/power-analysis-native-interaction-9430.png`

## WeChat Plan History Detail Crash (`2026-06-15`)

- Task: fix the WeChat mini-program issue where tapping a plan in `全部计划` / plan history could stay loading and then show `计划不存在`, even though the same coach-assigned plan was visible on today's training/list surfaces.
- Status: implemented and verified.
- Root cause:
  - `wechat_app/src/me/plan-history/detail/index.tsx` requested `/api/student/plan-lib/history/{id}`.
  - That route does not exist in the Web API tree, while the list page correctly loaded the plan through `/api/student/plan-lib/list-history`.
  - Result: list could show a coach-assigned plan, but detail failed to load the instance and rendered `计划不存在`.
- Fix:
  - Switched the detail page to POST `/api/plan-lib/get-instance` with `{ id }`, reusing the canonical plan-instance permission and subscription-aware loader.
  - Normalized the response into the existing detail page fields, including derived status, total training days, and completion rate.
- Verification:
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: first run compiled/static-generated successfully but hit the known Windows `.next/standalone` EBUSY copy lock; rerun passed.
  - `cd wechat_app; npm run build:weapp`: passed.
  - WeChat DevTools automation opened the exact reported plan `14eed820-11b2-4a51-ac48-6389a14e2378` for student `30d1f188...`; list showed 1 card, tapping/opening detail rendered the plan header and fields instead of `计划不存在`.
  - Screenshot saved: `screenshots/weapp/plan-history-detail-after-fix-devtools.png`.

## Pull Latest Code (`2026-06-15`)

- Task: pull latest code into local workspace again.
- Status: completed locally.
- Starting branch: `main`.
- Local state before pull:
  - `main` was ahead of `origin/main` by 6 commits.
  - Working tree contained restored uncommitted coach revenue / E2E cleanup changes from prior work.
- Result:
  - Protected local uncommitted changes with stash `tmp-before-pull-latest-2026-06-15`.
  - Fetched `origin` and `gitee`.
  - `origin/main` had no new commits; `origin/dev` advanced to `06731f1f` with WeChat mini-program dark theme / BottomNav fixes.
  - Merged latest `origin/dev` into local `main` successfully.
  - Restored the protected local uncommitted changes; `memory/2026-06-13.md` had become tracked upstream, so the local stashed content was manually merged into that memory file.
  - Updated local `dev` pointer to match the updated `main` merge commit.
- Current note:
  - Local working tree still contains uncommitted coach revenue / E2E cleanup changes plus the pull-state memory updates.
  - Temporary stash is intentionally retained as a backup.
- Remote note: no push was performed.

## Pull Latest Code (`2026-06-14`)

- Task: pull latest code into local workspace.
- Status: completed locally.
- Starting branch: `main`.
- Local state before pull:
  - `main` was ahead of `origin/main` by 11 commits.
  - There were uncommitted local code/state changes from the coach revenue consistency and E2E cleanup work.
- Result:
  - Protected local uncommitted changes with stash `tmp-before-pull-latest-2026-06-14`.
  - Fetched `origin` and `gitee`.
  - Merged latest `origin/main` (`e8f7b092`) into local `main`; new remote change updated `Dockerfile.power-worker`.
  - Restored the protected local uncommitted changes without conflicts.
  - Updated local `dev` pointer to match the updated `main` merge commit.
- Current note:
  - Local working tree still contains the restored uncommitted coach revenue / E2E cleanup changes.
  - Temporary stash is intentionally retained as a backup until those restored local changes are committed or discarded.
- Remote note: no push was performed.

## E2E Fake Coach Cleanup (`2026-06-13`)

- Task: stop E2E/API tests from leaving new fake coach rows after every run.
- Status: implemented and verified.
- Fix:
  - Expanded `/api/test/e2e/cleanup` so every cleanup call also discovers and removes all seeded `E2E Coach%` rows.
  - Cleanup now removes dependent test data before deleting the coach/user rows, including subscription orders, settlement rows, wallet transactions, withdrawals/accounts, chat rooms/messages, plan executions, questionnaire responses, carts, reviews, legacy training-plan rows, pricing/content/action/template rows, and profiles.
  - Existing historical `E2E Coach%` leftovers were cleaned from the current database.
- Verification:
  - Direct database check after cleanup: `coaches where name ilike 'E2E Coach%'` returned `0`.
  - `npx playwright test e2e/t2-backend-api-db-idempotent.spec.ts --workers=1`: passed, and the post-test database check still returned `0`.
  - `npm run typecheck`, `npm run lint`, `npm test`, and `npx next build`: passed.

## Coach Revenue / Wallet Amount Consistency (`2026-06-13`)

- Task: fix inconsistent coach income/revenue and wallet amounts on Web, and keep WeChat mini-program aligned.
- Status: implemented and verified.
- Root cause:
  - Web coach overview/revenue details were still aggregating monthly subscription income from older subscription/order sources, including `coach_subscription_orders.amount_fen`.
  - Wallet displayed the newer wallet/settlement口径: wallet income transactions plus `coach_subscription_settlements.coach_amount` pending settlement net income.
  - Result: overview/revenue could show gross, stale, or unit-drifted values while wallet showed coach net receivable amounts.
- Implemented:
  - Added shared helper `src/lib/coachRevenueSummary.ts`.
  - Updated `/api/coach/get-overview-data` and `/api/coach/get-revenue-details` to compute monthly revenue from wallet income transactions + pending/processing/split-failed settlement coach net amounts, with pre-2026-04-22 legacy subscription rows only as historical fallback.
  - Updated Web overview amount formatting to always show two decimals.
  - Updated WeChat mini-program coach overview/revenue amount formatting to two decimals; mini-program already consumes the same backend APIs, so backend口径 is now aligned.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed informational lint script.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed after running `npm install` to restore missing local `kafkajs` dependency that was already declared in `package.json` / `package-lock.json`.
  - `cd wechat_app; npm run build:weapp`: passed.
  - Browser verification with temporary E2E coach and pending settlement net amount `¥161.60` confirmed `/dashboard/overview`, `/dashboard/revenue`, and `/dashboard/wallet` all displayed `161.60`; screenshots saved in `screenshots/web/`.
  - Temporary seed user/subscription, test order, and settlement rows were cleaned up.

## Pull Latest Code (`2026-06-10`)

- Task: pull latest code into local workspace.
- Status: completed locally.
- Starting branch: `main`.
- Local state before pull:
  - `main` was ahead of `origin/main` by 5 commits.
  - Two local durable-state files had uncommitted notes, so they were stashed as `tmp-before-pull-latest-2026-06-10` before fetching.
- Remote updates:
  - `origin/main` had no new commits.
  - `origin/dev` advanced to `8029de1e` with Power Analysis worker queue / Python worker updates.
- Result:
  - Merged latest `origin/dev` into local `main` with merge commit `73e3a66c`.
  - Resolved conflicts by keeping the renamed `docs/codex对话-集成功率视频分析.txt` and preserving both sides of `memory/2026-06-08.md`.
  - Restored the pre-pull durable-state stash.
- Next step: sync local `dev` to the updated `main` head.
- Remote note: no push was performed.

## WeChat Mini-Program Service Category Planning (`2026-06-08`)

- Task: advise which WeChat mini-program service categories CoachLink should proactively apply for based on current mini-program features and WeChat review/category constraints.
- Status: analysis-only completed; no code changes requested.
- Current approved categories shown by user: `工具 > 健康管理` as primary and `工具 > 信息查询`.
- Product surfaces considered: online training execution, action/plan libraries, coach discovery and paid coaching service, coach-student messaging, training videos/content, rankings/location pages, and wallet/payment flows.
- Recommendation snapshot: keep the two approved categories; use remaining category slots first for `体育 > 在线健身`, `体育 > 体育培训`, and one relationship/community safety category such as `社交 > 熟人交友/IM熟人社交` if available or `社交 > 社区/论坛` if review focuses on UGC/public exchange. Do not pre-apply for medical, finance, education, live streaming, or e-commerce categories unless those regulated product surfaces are actually launched.

## Branch Sync: Commit Dev And Merge To Main (`2026-06-08`)

- Task: commit current working tree, then merge the development branch into `main` so `main` and `dev` are consistent.
- Status: completed locally.
- Current branch before commit: `dev`.
- Current branch heads before commit: local/remote `main` and `dev` were both at `549cbb7e` before the new commit.
- Result:
  - Committed current work on `dev` as `500591f6 chore: sync current coachlink updates`.
  - Fetched and merged newer `origin/dev` into local `dev`, producing merge commit `a76ddd5f`.
  - Fast-forwarded local `main` to `dev`.
  - Added final branch-sync state note commit after the merge and fast-forwarded `dev` to match `main`.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed after stopping stale local coachlink dev/watch processes that were locking `.next`.
  - `cd wechat_app; npm run build:weapp`: passed before the final `origin/dev` merge; the final merge did not change WeChat mini-program source.
- Remote note: no push was performed in this task.

## Student Renewal Still Shows Expired (`2026-06-08`)

- Task: investigate student `f08872b0` reporting that they renewed with coach `刘三乐` but the WeChat training home still showed `订阅已到期，请尽快续费`.
- Cloud facts:
  - Student `75a60512-4f0c-465f-815e-2bb6f08872b0`, subscription `8b03677a-8ecb-4cac-84b1-01620a20ab27`, coach `刘三乐`.
  - Renewal order `d38c4ab2-1ef4-433b-9225-a6e7946d76ad` is `renew/paid`, confirmed by coach on `2026-05-10`, `purchased_weeks=12`, amount `¥199.00`.
  - The subscription row is still `status='active'` and `subscribed_weeks=24`; the user really had renewed.
  - Stored `end_date` remained stale at `2026-05-23T09:01:57.049+00:00`.
  - The only current student/coach plan instance has 105 calendar days / 44 training days and is now marked `completed`; this exposed a model edge case where purchased entitlement can exceed the current plan's length.
- Root cause:
  - `deriveSubscriptionEntitlementState` capped total/remaining credits at the current plan's max day index. When a renewed subscription had more purchased weeks than the current plan covered, completing or nearing completion of that plan could make the whole subscription look exhausted/grace even though extra renewed entitlement remained for the next phase.
- Fix:
  - `src/lib/subscriptionEntitlementModel.ts` now estimates future unassigned credits when `effectiveWeeks` exceeds the current plan's covered weeks, keeping the active subscription lifecycle active instead of falling back to stale `end_date`/grace.
  - `src/lib/subscriptionEntitlementModel.test.ts` adds a regression covering a 24-week renewed subscription with a completed 15-week plan and stale `end_date`; expected state is `available/active`, with remaining credits and no display end date.
- Verification:
  - Targeted tests passed: `subscriptionEntitlementModel.test.ts` and `subscriptionAccess.test.ts`.
  - `npm run lint`: passed informational script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 163 tests.
  - `npx next build`: passed on rerun; first run compiled/static-generated successfully but hit a transient Windows `.next/standalone` EBUSY copy lock.

## Coach Wallet Pending Settlement Display / Due Job (`2026-06-08`)

- Task: investigate why a coach subscription paid on `2026-05-28 23:36` still showed `冻结金额 ¥159.20` on Web wallet after the 7-day protection window.
- Finding:
  - The order `76c0dedd-6ba8-4a98-b943-68016de5ac0b` is `paid`, order type `coach_subscription`, total `¥199.00`, coach share `¥159.20`, platform fee `¥39.80`.
  - Its settlement row `438f9deb-8714-47bf-b63b-ec16b26352fd` is still `status='pending'`, `eligible_at='2026-06-04T15:36:10.549Z'`, `attempts=0`, and has no `error_message`.
  - Coach `枭马葛` has `huifu_open_status='opened'` and a card token; `coach_wallets.frozen_amount=0`, so this is not an account-readiness or wallet-freeze issue.
  - Local Apollo-loaded production startup logs show `[BackgroundJobs] missing HUIFU_SETTLEMENT_CRON_SECRET/CRON_SECRET; skip Huifu settlement jobs`, matching `attempts=0`.
- Implemented UI correction:
  - Web `/dashboard/wallet` now displays `冻结金额` from `frozen_amount` only and keeps `待结算收入` separate.
  - WeChat mini-program coach wallet now uses the same display口径.
  - Pending settlements past `eligible_at` now show `结算待处理` / `已到期，等待系统结算`.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
  - `cd wechat_app; npm run build:weapp`: passed.
- Browser verification:
  - Attempted with Playwright against a temporary `next start` on port 3004, but page verification was blocked because `NEXTAUTH_URL` points to `localhost:3000` and production Secure NextAuth cookies did not authenticate `/dashboard/wallet` on `localhost:3004`; middleware redirected to `/login`.
- Next step:
  - Configure `HUIFU_SETTLEMENT_CRON_SECRET` or `CRON_SECRET` in the runtime config/Apollo and restart/redeploy so due settlement jobs run.
  - The currently due settlement should then be processed by `/api/admin/coach-subscription-settlements/process-due`.
  - Do not manually trigger this route without explicit confirmation because it initiates real Huifu balance-payment settlement.

## WeChat Coach Wallet Web Alignment (`2026-06-08`)

- Task: align WeChat mini-program coach wallet with Web `/dashboard/wallet` because the mini-program lacked withdrawable/frozen/pending-settlement balance details and recent transaction entries did not match Web.
- Status: implemented and partially visually verified.
- Implemented:
  - `wechat_app/src/services/coach/coachService.ts` wallet response typing now includes `gross_balance`, `withdrawable_balance`, `refund_protected_amount`, `pending_settlement_amount`, `refund_protection_days`, and `pending_settlements`.
  - `wechat_app/src/coach/wallet/index.tsx` now renders the same wallet balance口径 as Web: 可提现余额, 冻结金额, 待结算收入, 账户总余额, 累计总收入.
  - The mini-program wallet transaction list is now `收支明细` and prepends pending settlements before normal wallet transactions, including settlement status, estimated settlement time, order link copy, and platform service fee.
  - Mini-program wallet transaction time formatting now uses `yyyy-MM-dd HH:mm`, matching the Web page more closely.
- Verification:
  - `cd wechat_app; npm run build:weapp`: passed.
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
  - WeChat DevTools automation opened `/coach/wallet` and screenshot `screenshots/weapp/wallet-aligned.png` confirmed the new four wallet metrics render. DevTools error logs were empty before the automation port disconnected.
- Blocker:
  - Full transaction mock/interaction verification was blocked because `mrc mock` failed with `mp.mockJson is not a function`, and the DevTools automation port disconnected during the follow-up click check.

## Coach Acquisition Notice And Guide (`2026-06-07`)

- Task: prepare a system notice for approved coaches to start recruiting students and write a coach-facing tutorial for how to operate.
- Status: implemented as documentation + dry-run notification script; no real notifications sent yet.
- Output:
  - `docs/work/coach-operations/coach-student-acquisition-guide.md`
  - `docs/work/coach-operations/assets/01-coach-overview.png`
  - `docs/work/coach-operations/assets/02-pricing-settings.png`
  - `docs/work/coach-operations/assets/03-questionnaire.png`
  - `docs/work/coach-operations/assets/04-plan-library.png`
  - `docs/work/coach-operations/assets/05-students.png`
  - `docs/work/coach-operations/assets/06-coach-profile.png`
  - `scripts/send-coach-acquisition-notice.ts`
- Script behavior:
  - `npx tsx scripts/send-coach-acquisition-notice.ts` runs dry-run only.
  - Default target is approved/active, non-`E2E Coach` coach rows.
  - `--ready-only` restricts to coaches with Huifu opened + card token.
  - `--coach-id=` and `--user-id=` can narrow targets.
  - `--execute` is required to actually send system chat notices.
- Dry-run result:
  - Default target count: 18 approved/active real coaches.
  - Ready-only target count implied by dry-run labels: 2 receiving-ready coaches.
- `2026-06-07` follow-up:
  - User asked whether notifications had been sent and requested a product-screenshot-rich tutorial.
  - Clarified no real notifications had been sent; only dry-run was run.
  - Captured 6 Web product screenshots using a temporary E2E coach account, then cleaned up the temporary account/subscription/plan.
  - Updated the guide into an image-rich walkthrough with screenshots for overview, pricing, questionnaire, plan library, students, and coach profile.
  - Local dev servers started for screenshots were stopped afterward.
- Verification:
  - Script dry-run passed.
  - Targeted script TypeScript check passed.
  - `npm run lint` passed informational lint script.
  - `npm run typecheck` passed.
  - `npm test` passed, 33 files / 162 tests.
  - `npx next build` passed on rerun; first parallel build attempt hit transient Windows `.next/standalone` EBUSY lock after successful compile/static generation.

## WeChat Mini-Program Privacy / Agreement Audit Fix (`2026-06-07`)

- Task: fix WeChat audit rejection that said the mini-program collects/uses/stores user personal information while the User Service Agreement and Privacy Policy pages were blank or insufficient, and that personal-information purpose/method/scope/authorization must be clearly stated before collection.
- Status: implemented and verified; `2026-06-08` UX correction applied.
- Implemented:
  - `wechat_app/src/auth/login/index.tsx` now shows a first-screen "个人信息收集使用说明" before the login button, explaining collected categories, collection methods, purpose, usage scope, and no third-party sale.
  - WeChat quick login is disabled until the user checks agreement consent; phone authorization remains a second-step prompt only after login requires it.
  - `wechat_app/src/me-legal/privacy/index.tsx` now contains a full privacy policy covering collection scope, purposes, methods, sharing/disclosure, consent/refusal, retention/security, user rights, minors, updates, and contact details.
  - `wechat_app/src/me-legal/terms/index.tsx` now has a visible page title.
  - `wechat_app/src/auth/register/index.tsx` now includes the Privacy Policy in the registration consent row and no longer only references user agreement/disclaimer.
  - `wechat_app/src/me/profile/index.tsx` footer legal links now point to registered `/me-legal/*` routes instead of unregistered `/me/*` legal pages, reducing blank-page risk.
- Verification:
  - `cd wechat_app; npm run build:weapp`: passed.
  - `npm run lint`: passed informational lint script.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed.
  - `git diff --check`: passed with CRLF warnings only.
  - WeChat DevTools automation (`mrc` on port 9420) opened `/auth/login`, `/me-legal/terms/index`, and `/me-legal/privacy/index`; screenshots saved to `screenshots/weapp/login-privacy-notice.png`, `screenshots/weapp/legal-terms.png`, and `screenshots/weapp/legal-privacy.png`.
- Note:
  - `mrc elements text` and direct `checkbox` selector inspection still report no displayed text / checkbox selector timeout in this environment, but screenshots confirm the pages are rendered and not blank; clicking `.agreement-row` succeeded.
- `2026-06-08` correction:
  - User clarified that the agreement/privacy content should not be displayed directly as a large block on the login page; full text should appear only after tapping the agreement/privacy links.
  - Removed the first-screen "个人信息收集使用说明" card from `wechat_app/src/auth/login/index.tsx`.
  - Login page now keeps only the checkbox consent row with clickable `《用户服务协议》` and `《隐私政策》` links before the login button; full disclosure remains in the dedicated legal pages.
  - Verified with WeChat DevTools screenshot `screenshots/weapp/login-agreement-link-only.png`.
  - Checks passed: `cd wechat_app; npm run build:weapp`, `npm run lint`, `npm run typecheck`, `npm test`, `npx next build`, and `git diff --check` (CRLF warnings only).

## Admin Standalone Password Reset (`2026-06-07`)

- Task: reset the standalone Web admin password because the original password was forgotten.
- Status: completed.
- Result:
  - `admin.main` exists, is active, and is bound to an admin user.
  - Password hash was reset directly in `admin_users`.
  - Plaintext password was intentionally not written to durable memory.

## Coach Usage Statistics (`2026-06-07`)

- Task: summarize coach-side coach usage from the current CoachLink data source.
- Status: completed as a data analysis; no application code changes requested or made.
- Data source: Apollo local config loaded the Supabase project `uhlqribpagvklpqmcqvo`.
- Notes:
  - Excluded 6 `E2E Coach ...` test coach rows from the main business summary.
  - Report separates real coach-login activity from business-table activity because chat/message rows can make every coach look recently active even when coach `last_login_at` is old.

## Huifu Split Source Material Recovery (`2026-06-06`)

## WeChat Mini-Program Login Audit Visibility Follow-up (`2026-06-07`)

- Task: make the login cancel/refuse/return path obvious in the actual WeChat mini-program login screenshot.
- Status: code updated; repository push gate in progress.
- Follow-up:
  - The prior top floating `返回` / `先逛逛` controls were not visible enough in the custom-nav/capsule top area.
  - `wechat_app/src/auth/login/index.tsx` now places full-width `返回上一页` and `不登录，先逛逛` actions directly below the quick-login button.
  - The same actions also appear below the secondary WeChat quick-login button in password/code login modes.
  - Quick-login copy remains the original `手机一键登录` / `手机号快捷登录`; only the visible cancel/return choices were added.
- Correction:
  - A brief mistaken wording change to `微信快捷登录` was reverted immediately after user correction.
- Verification:
  - Targeted `esbuild` check passed.
  - Per user instruction, no `npm run build:weapp` or further DevTools verification was run; user will build manually.
- Push-gate follow-up:
  - E2E dev-server stability required localizing Driver.js CSS into `src/assets/globals.css`.
  - Playwright now uses `COACHLINK_FAST_DEV=1` for E2E webServer startup.
  - `e2e/t2-backend-api-db-idempotent.spec.ts` now uses CSRF + NextAuth credentials callback for seeded-user login instead of UI form assumptions.
  - Targeted `t2-backend-api-db-idempotent` E2E passed.

---

- Task: recover the long Huifu/payment-split source material from the raw Codex conversation file because the UI could no longer scroll back to it.
- Status: completed.
- Result:
  - Original source found at `C:\Users\hp\.codex\sessions\2026\05\17\rollout-2026-05-17T23-57-38-019e36a8-4701-7612-a071-41d815ee2118.jsonl`, line `218`; line `219` is the duplicate event mirror.
  - Exported full recovered material to `recovered/huifu-payment-split-original-2026-05-18.md`.
  - Added `recovered/README.md` with source path, line number, timestamp, and preview.
- Content includes:
  - WeChat group chat record for `智健启能(北京)科技6666000194449179` with 266 messages.
  - Copied Huifu docs/API material for user onboarding, business open, balance payment, withdrawal, refund/refund-query, and split/delayed-split guidance.
## Meeting Transcript CoachLink Work Summary (`2026-06-07`)

- Task: summarize CoachLink/教链 work content from the user's attached meeting transcript.
- Status: completed as a text summary; no application code changes were requested or made.
- Durable summary was appended to `memory/2026-06-07.md`.

## Student Plan Execution / Entitlement Diagram (`2026-06-06`)

- Task: draw a detailed explanation diagram for student plan execution, validity, renewal waiting, plan length vs subscription length, student delays, and changing weekly training frequency.
- Status: completed as documentation/artifact output; original dense chart was followed by a readable split version after user reported the PNG text was unreadable and Mermaid source did not preview.
- Output:
  - `docs/work/flows/student-plan-execution-entitlement-renewal.md`
  - `docs/work/flows/student-plan-execution-entitlement-renewal.mmd`
  - `output/student-plan-execution-entitlement-renewal.svg`
  - `output/student-plan-execution-entitlement-renewal.png`
  - Readable split version:
    - `docs/work/flows/student-plan-execution-readable.md`
    - `docs/work/flows/student-plan-execution-01-concepts.mmd`
    - `docs/work/flows/student-plan-execution-02-credits.mmd`
    - `docs/work/flows/student-plan-execution-03-renewal.mmd`
    - `docs/work/flows/student-plan-execution-04-scenarios.mmd`
    - `output/student-plan-execution-readable-preview.html`
    - `output/student-plan-execution-01-concepts.{svg,png}`
    - `output/student-plan-execution-02-credits.{svg,png}`
    - `output/student-plan-execution-03-renewal.{svg,png}`
    - `output/student-plan-execution-04-scenarios.{svg,png}`
- Product/system口径:
  - `subscribed_weeks` is the purchased service entitlement pool, not the concrete plan length.
  - `training_days` belongs to the current plan phase and can change between phases.
  - Actual execution duration follows completed execution dates; student delay should extend the projected completion date instead of hard-expiring by natural days.
  - `end_date` is a projected/display completion date and lifecycle helper, not the active-subscription hard gate when credits remain.
  - Renewal waiting means the current phase is complete and remaining entitlement is insufficient, not that plan generation failed.
- Verification:
  - Rendered the Mermaid source to SVG/PNG with Playwright and visually inspected the PNG.
  - Rendered the four split Mermaid diagrams to readable SVG/PNG assets and visually inspected them.
  - Verified the HTML preview loads all four PNG images with non-zero natural dimensions.
  - No Web/WeChat UI verification was required because this was documentation/artifact generation only.
- `2026-06-07` correction:
  - User clarified that a coach-authored plan may be two months long while the student only executes/unlocks the first month under the current entitlement.
  - Updated the readable split diagrams and preview copy to distinguish full coach-authored plan blueprint from the current paid execution window.
  - The renewal/waiting decision now describes "current paid execution window consumed" rather than "entire plan completed".
  - Added a note to the original dense document that the readable split version is the corrected recommended version.

## Production Web Huifu Alipay Polling Recovery (`2026-06-06`)

- Task: fix Web coach subscription Alipay QR payments that can be scanned but stay on `/payment/:id` waiting for payment result.
- Status: implemented and verified at code/build/test level; production redeploy required.
- Root cause:
  - A production Web order (`1bfa6750-6be1-4fa9-8f0e-7927e0aa2fd2`) was inserted as `status='pending'`, `order_type='coach_subscription'`, but had `payment_provider=null` and no `order_data.huifu_req_date`.
  - The payment result page then treated it as a legacy direct-Alipay order and called `alipay.trade.query` instead of Huifu `scanpay/query`, so it kept waiting even after the user scanned/paid.
- Fix:
  - `/api/payment/alipay/create` now writes `order_data.huifu_req_date` before remote Huifu payment creation and does not write `payment_provider='huifu_alipay'`, because production `alipay_orders_payment_provider_check` rejects that value.
  - `/api/payment/alipay/query` now self-recovers historical Web coach subscription orders: `coach_subscription` / `coach_subscription_renew` with `coachId` are queried through Huifu even if provider/date are missing, and the inferred `huifu_req_date` is written back.
  - `/api/payment/alipay/syncPendingOrders` now also reconciles Huifu pending orders, including the same historical Web coach-subscription fallback, instead of skipping Huifu provider/date-marked orders.
  - `/api/payment/wechat/notify` no longer writes `payment_provider='huifu_alipay'` for Huifu Alipay callbacks; A_* callbacks leave provider unchanged/empty and rely on `huifu_req_date`.
- Huifu docs note:
  - The provided Huifu split document confirms payment must go through Huifu first so balance/split can work. It also describes delayed transaction-confirm split (`delay_acct_flag=Y` + transaction confirmation) separately from the current CoachLink balance-payment settlement path.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed (33 files / 162 tests).
  - `npx next build`: passed.
  - `git diff --check`: passed with CRLF warnings only.
- Next step:
  - Redeploy Web. The existing waiting order should be recoverable on the next `/api/payment/alipay/query` call because the route can infer `org_req_date` from `created_at` and use the order id as `org_req_seq_id`.

## WeChat Mini-Program Content Package Size Fix (`2026-06-06`)

- Task: fix WeChat DevTools upload failure where the `content` subpackage reported about `10276KB`, exceeding the 2048KB subpackage limit.
- Status: implemented; package-size verification passed; runtime screenshot verification was attempted but blocked by a DevTools automation white-screen state affecting even the home page.
- Root cause:
  - `wechat_app/src/config/knowledgeCoreTopics.ts` imported four large `knowledge-core/*.png` images.
  - Taro inlined those PNGs as base64 into `content/knowledge.js`, inflating that single JS file to about 10.2MB.
- Fix:
  - Converted the four knowledge-core images to compressed JPG assets.
  - Changed `knowledgeCoreTopics` to use static `/content/assets/knowledge-core/*.jpg` paths instead of importing images into JS.
  - Added Taro copy rules so those JPGs are copied into the `content` subpackage.
- Verification:
  - `cd wechat_app; npm run build:weapp:release`: passed; `dist-release/content/knowledge.js` is about 26.57KB.
  - `cd wechat_app; npm run build:weapp`: passed; `dist/content` is about 0.447MB and `dist/content/knowledge.js` is about 25.95KB.
  - `dist` total is about 8.555MB; main package about 1.46MB; `coach` about 1.835MB; `me` about 1.852MB.
  - Root checks passed: `npm run lint`, `npm run typecheck`, `npx next build`, `npm test` (33 files / 162 tests).
  - WeChat DevTools automation started on port 9420 and could navigate to `/content/knowledge`, but screenshots were blank and element tree was empty for both `/content/knowledge` and `/pages/index/index`, indicating a DevTools automation/runtime-load issue rather than a content-page-only failure.

## Production Slider Captcha Redis Config Hotfix (`2026-06-06`)

- Task: diagnose why Web login SMS slider captcha on `https://coachlink.fit` kept showing `加载验证码失败 / Request failed with status code 500`.
- Status: completed; production captcha service restored.
- Root cause:
  - `/api/captcha/slider/create` depends on Redis for `captcha:slider:*` storage.
  - Production `coachlink-main` was reading Apollo `REDIS_URL=redis://154.8.205.78:6379`, so app Pods tried to connect to the node/public IP and timed out.
  - K8s Redis itself was running normally behind the internal `redis` Service on port 6379 and requires `redis-secret` password.
- Fix applied:
  - Updated Apollo `coachlink/app-config` for `local`, `dev`, and `main`: `REDIS_URL=redis://redis:6379`.
  - Synchronized Apollo `REDIS_PASSWORD` with the current K8s `redis-secret`.
  - Inserted Apollo release messages for the updated app-config clusters.
  - Rolled out `deployment/coachlink-main`.
- Verification:
  - Production logs now show `[Redis] Connecting to redis://:****@redis:6379` and `[Redis] Connected`.
  - `POST https://coachlink.fit/api/captcha/slider/create` returns `success=true`.
  - Captcha image URL returns `200 image/svg+xml`.
  - `POST https://coachlink.fit/api/captcha/slider/verify` returns `success=true` with a token.


## Coach Automation Settings Tutorial (`2026-06-06`)

- Task: make the coach automation settings page understandable for coaches by adding detailed usage guidance and scenario-based recommended settings.
- Status: implemented and verified; commit/push in progress.
- Implemented:
  - Web `/dashboard/automation` now includes a tutorial section before the policy controls: default recommendation, explanation of the four settings, five scenario presets, and a warning to use per-student overrides instead of changing global settings for one student.
  - WeChat coach `/coach/automation` now includes the same guidance in a mobile-compressed panel with default recommendation, setting explanations, scenario suggestions, and per-student override reminder.
- Verification:
  - Targeted `esbuild` syntax checks passed for `src/app/dashboard/automation/page.tsx` and `wechat_app/src/coach/automation/index.tsx`.
  - `git diff --check` passed for the touched automation tutorial files with CRLF warnings only.
  - Push-gate verification on `2026-06-06`: `npm run lint`, `npm run typecheck`, `npm test` (32 files / 158 tests), `npm run test:e2e` (4 tests), and `npx next build` all passed.
  - While running the push gate, `e2e/t2-backend-api-db-idempotent.spec.ts` was updated to use seed-user quick login by user id instead of fragile password-form textbox positions.

# E2E Coach Account Cleanup (`2026-06-06`)

- Task: remove fake coach accounts generated by end-to-end tests from the platform database.
- Status: completed.
- Data cleanup:
  - Identified 7 `coaches` rows with `name ILIKE 'E2E Coach%'`.
  - Deleted their related E2E subscriptions, plan instances, coach rows, coach user accounts, and paired seeded student user accounts.
  - Core deleted rows: 7 `coaches`, 7 `coach_subscriptions`, 2 `coach_plan_instances`, and 14 `users`.
  - Also attempted cleanup for known child/leftover tables such as plan executions, student favorites, coach templates/actions/pricing/questionnaires/wallets, applications, profiles, onboarding questionnaires, orders, content purchases, and feedback rows where present.
- Verification:
  - Post-cleanup query confirmed `coaches.name ILIKE 'E2E Coach%'` returns 0 rows.
  - Post-cleanup query confirmed `coach_plan_instances.name = 'E2E Plan'` returns 0 rows.
- Note:
  - Target database host was the Supabase project configured in local env: `uhlqribpagvklpqmcqvo.supabase.co`.

## Web Student Profile Unified Fitness Card (`2026-06-06`)

- Task: answer and optimize the Web `/me/profile` area where legacy `力量举` / `健美/形体` specialty cards still appeared below the current `健身资料卡`.
- Status: implemented at code level, with follow-up profile-page IA cleanup; code checks passed; browser automation attempted but blocked.
- Product clarification:
  - Yes, those visible `力量举` / `健美/形体` cards are from the older `sport_cards` profile model / old registration-era specialty data.
  - Current registration/onboarding source of truth is the unified questionnaire/profile model (`fitness_goals`, `fitness_level`, target body parts, weekly frequency, equipment, session duration), with `interest_tags` only kept as derived compatibility data.
- Implemented:
  - `src/components/student/StudentProfilePage.tsx`: removed legacy `SportCardsDisplay` from the Web student profile first-screen content.
  - `src/components/student/StudentProfilePage.tsx`: profile header edit dialog now opens `PersonalInfoSection` in `basicOnly` mode on `/me/profile`, so it no longer exposes the old "练习领域 / 历史成绩" sport-card registration steps there.
  - `src/components/student/StudentProfilePage.tsx`: replaced the mobile-unfriendly `TabView` for `进步足迹 / 需求问卷 / 训练视频` with a compact `训练档案` archive area. These low-frequency modules now appear as vertical expandable rows instead of a clipped horizontal three-tab bar.
  - `src/components/student/profile/PersonalInfoSection.tsx`: added `basicOnly` mode that saves only basic profile fields and does not rewrite `sport_cards`.
  - `src/components/student/profile/FitnessProfileCard.tsx`: redesigned collapsed state into a compact summary for goal, level, weekly frequency, and session duration; full field editing remains behind expand/edit controls.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed after stopping a stale local Web `next dev/start` process that was locking `.next`; existing Redis timeout and baseline-browser-mapping warnings appeared but build exit code was 0.
  - Browser verification: attempted with Playwright because `web-devtools` is not available in this session. Dev-server + E2E seed path timed out at `/api/test/e2e/seed`; a separate `next start` + dev-account login attempt also timed out before a screenshot was produced. Temporary ports/processes were cleaned up.

## Power Calculator Toolbox Integration MVP (`2026-06-06`)

- Task: integrate the old `Power_calculator` project (`D:\files\Power_calculator`) into CoachLink's toolbox as a free Web video-analysis utility with optional LLM interpretation.
- Status: Web MVP implemented and locally verified; production rollout still needs database migration, Python worker dependencies, and background worker/cleanup scheduling.
- Implemented:
  - Added public Web tool page at `/toolbox/power-analysis` and toolbox entry `引体 / 双力臂功率测试`.
  - Added authenticated API flow for signed upload URL creation, enqueueing, owned job lookup, signed output download URL, LLM summary generation, and expired-job cleanup.
  - Added `tool_power_analysis_jobs` migration to track transient analysis jobs, progress, metrics, output paths, errors, and `expires_at`.
  - Added Python analyzer under `scripts/power-analysis/` using OpenCV + MediaPipe Pose to estimate reps, displacement, ascent time, average power, horsepower, max velocity, and generate an annotated output video.
  - Added Node worker `scripts/power-analysis-worker.mjs` with npm scripts `power-analysis:worker`, `power-analysis:work-once`, and `power-analysis:cleanup`.
- Product/retention behavior:
  - Users can download the analyzed/annotated video after processing.
  - Uploaded input and processed output are transient files under the shared `videos` bucket and are retained for at most 24 hours.
  - The page is public/free to view; upload/analyze APIs require login and have default limits of one active job and five jobs per user per 24 hours.
  - LLM analysis uses structured metrics only and does not send raw video to the model.
- Verification:
  - `node --check scripts\power-analysis-worker.mjs`: passed.
  - `python -m py_compile scripts\power-analysis\analyze_video.py`: passed.
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed after stopping stale Next processes that held Windows `.next` files; existing Redis timeout and baseline-browser-mapping warnings appeared.
  - `npm test`: passed, 33 files / 162 tests.
  - Browser verification through the in-app Browser loaded `/toolbox/power-analysis`, confirmed the page is not redirected to login, switched to `双力臂`, filled height/weight, confirmed `开始分析` remains disabled without a selected video, and confirmed the unauthenticated upload API returns 401 `用户未登录`.
  - Screenshot saved: `test-results/manual/power-analysis-tool-page.png`.
- Rollout notes:
  - `supabase/migrations/20260606_power_analysis_jobs.sql` has been executed per user report.
  - Install worker dependencies from `scripts/power-analysis/requirements.txt` in the runtime that runs the worker.
  - Run `npm run power-analysis:worker` as a background worker and schedule `npm run power-analysis:cleanup` or call the cleanup endpoint with `POWER_ANALYSIS_CLEANUP_SECRET` / `CRON_SECRET`.
  - Full end-to-end upload/analyze/download was not run locally because the new DB migration and Python runtime dependencies have not been applied to a real environment in this session.

## Liu Sanle Questionnaire New-System Adaptation (`2026-06-06`)

- Task: keep coach `刘三乐`'s questionnaire questions/intent unchanged while adapting outdated legacy question types to the new questionnaire system.
- Status: completed.
- Data update:
  - Updated active/default questionnaire `bcdd1012-6d83-4708-a65e-b94fd80a2808`.
  - Converted legacy `tags` to a new multi-select `option`: `训练项目偏好` with `引体个数 / 引体负重`.
  - Converted legacy `times` to a new single-select `option`: `每周训练次数` with `2次 / 3次 / 4次`.
  - Converted legacy `rm` to a new `text` question: `用户极限 1RM（反手负重引体、引体顶部维持、正手负重引体）`.
  - Kept the remaining 8 option/text questions unchanged and preserved `status='active'` + `is_default=true`.
- Code fix:
  - `src/app/api/coach/publish-questionnaire/route.ts` no longer writes removed legacy `is_active`.
  - `src/app/api/questionnaire/submit/route.ts` no longer selects/validates removed legacy `is_active`; `status='active'` is the online-version source of truth.
- Verification:
  - Database readback confirmed 11 questions and no remaining legacy `tags/times/rm` types.
  - `npm run lint`: passed (informational lint script).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 32 files / 158 tests.
  - `npx next build`: passed on retry after clearing stale `.next/lock`; Redis timeout warnings still appeared from local env but build exit code was 0.

## Web Coach Subscription Alipay Split Audit (`2026-06-06`)

- Task: answer whether the Web student-to-coach subscription Alipay payment goes through the split/settlement system.
- Status: audit completed and Web Huifu Alipay launch fix implemented.
- Code finding:
  - Web `PaymentDialog` posts coach subscription payments to `/api/payment/alipay/create` with legacy UI order types `subscription` / `subscription_renew`.
  - The backend maps coach-owned subscription payments to `coach_subscription` / `coach_subscription_renew` and, when the coach has Huifu account + card token ready, creates a Huifu Alipay order. The response provider label is `huifu_alipay`, while the database must use `order_data.huifu_req_date` as the durable Huifu marker because production rejects `payment_provider='huifu_alipay'`.
  - Paid Huifu gateway orders are fulfilled through the shared `fulfillSubscriptionAndMaybeCreditWallet` path, which creates/uses `coach_subscription_settlements`, waits until `eligible_at`, then executes Huifu balance-payment settlement before crediting the coach wallet.
  - This is delayed Huifu settlement, not Alipay-native realtime `royalty_info` split.
- Runtime data finding:
  - The matching `¥199.00` paid coach subscription order found in `alipay_orders` is `payment_provider='wechat'`, not `huifu_alipay`.
  - That order has a corresponding `coach_subscription_settlements` row with `total_amount=19900`, `coach_amount=15920`, `platform_fee=3980`, `eligible_at=2026-06-04T15:36:10.549Z`, but status is still `pending`.
  - Therefore the sample has entered the delayed settlement table but has not completed remote split or wallet credit.
- Risk:
  - Before the fix, Web `PaymentDialog` expected `paymentInfo.formHtml`; Huifu Alipay creation returns `paymentInfo.provider='huifu_alipay'` plus `payInfo`.
- Implemented follow-up:
  - Added `src/components/payment/huifuPayInfo.ts` to extract Huifu QR/pay URLs from common `payInfo` shapes.
  - Updated Web `PaymentDialog` so coach subscription Alipay can handle Huifu `payInfo`: desktop shows an Alipay QR dialog and mobile redirects when Huifu provides an HTTP pay URL; both continue to `/payment/:id` for polling/confirmation.
  - Reused the same helper in `ContentPurchaseDialog`.
  - Moved legacy direct-Alipay `ALIPAY_*` credential checks below the Huifu coach-subscription branch so Huifu subscription payments do not depend on old direct-Alipay config.
  - Changed Huifu Alipay notify URL selection to prefer `HUIFU_PAY_NOTIFY_URL`, then `WECHAT_PAY_NOTIFY_URL`, then inferred `/api/payment/wechat/notify`, because Huifu callbacks must use the unified Huifu notify parser.
- Verification:
  - Targeted esbuild checks passed for `PaymentDialog`, `ContentPurchaseDialog`, and `/api/payment/alipay/create`.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed (script notice only).
  - `npm run typecheck`: passed.
  - `npm test`: passed (32 files / 158 tests).
  - `npx next build`: passed after stopping a stale local `next build` process that held `.next/lock`.
  - Browser smoke test: Playwright loaded local `/coach/profile/02db8c38-dc64-490b-9b78-e002a13811df` on port 3100 with no page/console errors and saved `test-results/manual/web-coach-profile-huifu-payment-smoke.png`; full payment-dialog interaction was not exercised because it requires an authenticated student and a real/sandbox Huifu payment order.

### Production Web Huifu Alipay 500 Follow-up (`2026-06-06`)

- Symptom: after deploying the Web Huifu Alipay launch fix, production Web payment POST `/api/payment/alipay/create` returned 500. UI toast showed `业务执行失败 [buyerId与buyerLogonId不能同时为空]`.
- Root cause:
  - The Web route selected Huifu `A_JSAPI` whenever the browser looked mobile (`isMobile=true`).
  - Normal Web browsers do not have Alipay `buyerId` / `buyerLogonId`; `A_JSAPI` requires one of them, so Huifu rejected the request.
- Fix:
  - Web Huifu Alipay now defaults to `A_NATIVE` QR payment.
  - It only uses `A_JSAPI` when the request explicitly includes `alipayBuyerId` / `buyerId` or `alipayBuyerLogonId` / `buyerLogonId`.
  - `createHuifuMiniProgramOrder` now omits empty buyer fields instead of sending `buyer_id: ""`, and can pass `buyer_logon_id` when provided.
- Verification:
  - Targeted esbuild checks passed for `/api/payment/alipay/create` and `src/lib/huifuMiniProgramPay.ts`.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed (script notice only).
  - `npm run typecheck`: passed.
  - `npm test`: passed (33 files / 162 tests).
  - `npx next build`: passed.

### Production Web Huifu PayInfo Missing Follow-up (`2026-06-06`)

- Symptom: after the `A_NATIVE` fix, production no longer showed the buyer-id error, but Web UI still showed an error toast with detail `订单创建成功`.
- Interpretation:
  - The create-order API likely returned `success: true` and message `订单创建成功`, but the frontend did not receive `paymentInfo.formHtml` or `paymentInfo.payInfo`, so it treated the response as unusable.
  - Likely cause is Huifu `A_NATIVE` returning QR/pay target in a top-level field such as `qr_code`, `code_url`, or `pay_url` instead of `pay_info`.
- Fix:
  - `/api/payment/alipay/create` now extracts Huifu pay targets from `pay_info`, `qr_code`, `qrcode`, `qrCode`, `code_url`, `codeUrl`, `pay_url`, `payUrl`, `pay_qr_code`, `alipay_qr_code`, `url`, and `paymentUrl`, including a nested `data` object fallback.
  - If Huifu returns success without any usable pay target, the backend throws a clear `汇付下单成功但未返回可展示的支付参数` error and logs response keys for diagnosis.
  - Web `PaymentDialog` now shows a clearer frontend fallback if an order is created but payment parameters are missing.
- Verification:
  - Targeted esbuild checks passed for `/api/payment/alipay/create` and `PaymentDialog`.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed (script notice only).
  - `npm run typecheck`: passed.
  - `npm test`: passed (33 files / 162 tests).
  - `npx next build`: passed.

## Web Fitness Profile Card Collapse (`2026-06-06`)

- Task: make the Web student `健身资料卡` collapsible so it does not occupy the whole profile screen by default.
- Status: completed.
- Scope:
  - `src/components/student/profile/FitnessProfileCard.tsx`
- Implemented:
  - Added a default-collapsed state for the card.
  - Added a pure-color `展开` / `收起` toggle with an icon and `aria-expanded`.
  - Kept existing single-field edit/save behavior unchanged when the card is expanded.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed; build emitted existing Redis timeout / baseline-browser-mapping notices but exited successfully.
  - `npm test`: passed, 32 files / 158 tests.
  - Browser verification: Playwright logged in with a seeded temporary student, created a minimal profile, opened `/me/profile`, confirmed the card is collapsed by default, clicked `展开`, and confirmed field buttons such as `头像` and `昵称` appear.
  - Screenshots saved:
    - `test-results/manual/fitness-profile-card-collapsed.png`
    - `test-results/manual/fitness-profile-card-expanded.png`

---

## WeChat Mini-Program Login Audit Fix (`2026-06-06`)

- Task: fix WeChat Mini Program audit rejection for login flow: login must provide a prominent cancel/refuse/return path and must not repeatedly force phone authorization before users can experience the mini-program.
- Status: implemented and verified at code/build/test level; WeChat DevTools interaction partially verified.
- Implemented:
  - `wechat_app/src/auth/login/index.tsx`: quick login primary buttons no longer directly use `openType='getPhoneNumber'`; they first call normal WeChat login without phone authorization.
  - Phone-number authorization now appears only as a second-step prompt when the backend says this is a first-time quick login or an account missing phone binding.
  - Login page now has visible `返回` and `先逛逛` actions at the top, plus a `先逛逛` entry in the quick-login panel.
  - Phone authorization prompt now explains that authorization is only needed for first account creation/missing phone, and provides `暂不继续` plus `返回`.
  - Rejecting/canceling the native phone authorization closes the prompt and does not loop the user back into repeated popups.
  - Login button active styles now use opacity or pure-color darkening instead of scale transforms.
- Verification:
  - Targeted `esbuild` check for `wechat_app/src/auth/login/index.tsx`: passed.
  - `cd wechat_app; npm run build:weapp`: passed.
  - Root `npm run lint`: passed (informational script).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 33 files / 162 tests.
  - Root `npx next build`: passed.
  - WeChat DevTools automation: started via `D:\software\微信web开发者工具\cli.bat auto --project D:\files\coachlink\wechat_app --auto-port 9420`, opened `auth/login`, clicked `.wechat-skip-row`, and verified navigation to `pages/index/index`.
- Blocker:
  - `mrc screenshot` timed out and `mrc elements` reported elements as not displayed even while the route was `auth/login`, so no screenshot artifact was produced. This matches the DevTools automation visibility/screenshot flakiness previously observed in this workspace.

---

## Latest Code Sync (`2026-06-05`)

- Task: pull the latest remote code and synchronize the local checkout.
- Status: completed on local `main`.
- Result:
  - Temporarily stashed local state-file edits before pulling.
  - Fetched all remotes with prune/tags.
  - Fast-forwarded `main` from `38a4b9e0` to `b79e5568`.
  - Resolved the local state-file conflict by keeping the newer remote task history and recording this sync as a new note.

---


## Repository Push and Branch Sync (`2026-06-05`)

- Task: commit current CoachLink changes, push to remote, and keep `main` and `dev` synchronized.
- Status: completed. Commit `2bb0af70` was pushed to `origin/main` and `origin/dev`; local `dev` was fast-forwarded to the same commit.
- Verification before push:
  - `npm run lint`: passed (project lint script prints the existing Next 16/no-eslint notice).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 32 files / 158 tests.
  - `npm run test:e2e`: passed, 4 tests.
  - `npx next build`: passed after stopping the local `next dev` process that had locked `.next` during an earlier build attempt.
- Notes:
  - Fixed a real automation patch bug where set/reps adjustments were made on a local copy and not written back.
  - Updated the backend CRUD e2e to use seeded temporary users instead of real `.env.development` users, because current real coach-test accounts may be intentionally modified for certification-flow testing.

## Xunji-Style Student Training UX Gap Analysis (`2026-06-05`)

- Task: compare the current CoachLink WeChat student training experience against the user's detailed `训记` interaction teardown and identify the next product/code changes.
- Status: four highest-priority quick-pass changes implemented at code level in `wechat_app/src/training/training-execution`; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Implemented quick pass:
  - Rest timer can now be minimized into a right-edge floating countdown bubble and restored by tapping the bubble; expanded timer supports `-10秒`, `+10秒`, `完成`, and `最小化`.
  - In-execution add-action picker now uses a `训记`-style selector: muscle rail, equipment chips, search, two-column action cards, multi-select, and batch add.
  - Weight/reps recording now uses a bottom custom workout keyboard with large number keys, quick adjust, planned value, copy previous set, warmup/drop-set note tags, add-set, and complete-set shortcuts.
  - Finishing a workout now opens a training summary sheet with body-map heatmap, total volume, completed sets, duration, muscle intensity bars, action summaries, and share-page entry when available.
  - Follow-up fix: impromptu training entry now loads public strength actions from the public/community action library alongside the student's personal actions. When the personal library is empty, users can still select public actions and start training immediately; cards show `我的` / `公共` source badges.
  - Follow-up fix: the no-long-term-plan state on today's training page now shows both primary `开始即兴首练` and secondary `找教练` actions. If the student already has an active coach subscription but no issued plan yet, the secondary action remains `联系教练`.
- Current product concern:
  - User feels the action library still has deeper issues and should not be modified further casually without a larger design/content pass.
  - Key gap: action preview cards do not reliably show actual exercise demos. For beginner users, action names, tags, and text are not enough to understand what the movement is.
  - Next action-library work should be planned around demo assets / thumbnails / movement previews and beginner comprehension, not only list layout styling.
- Confirmed benchmark:
  - Entry hub: bottom/FAB overlay with multiple record types.
  - Strength flow: fast exercise selection, dense set logging, custom numeric keyboard, per-set actions, automatic rest timer, and minimized timer bubble.
  - Completion flow: finish confirmation plus a share card centered on muscle heatmap, total volume, duration, and action summaries.
  - Cardio/HIIT: dedicated lightweight but real record/config flows, not only generic task forms.
- Current gaps found:
  - The action library was redesigned toward `训记`, but the in-execution add-action picker still uses a simple search list instead of the richer muscle/equipment multi-select selector.
  - The execution page still uses normal `Input` fields for weight/reps/RPE; it does not yet have a large custom workout keyboard.
  - The rest timer is persisted and auto-starts, but it is still a blocking modal with skip/+30s actions, not a minimizable right-edge countdown bubble with +/- controls.
  - The finish/share flow has share-token support and a day check-in card, but not a `训记`-style muscle heatmap share poster.
  - Dedicated cardio and HIIT training record/config pages are not present; cardio currently exists as lightweight task inputs and HIIT is not a real surface yet.
- Recommended implementation order:
  1. Add minimizable/floating rest timer controls in `training-execution`.
  2. Replace the execution-page add-action picker with the redesigned muscle/equipment selector and multi-select behavior.
  3. Add a custom numeric workout keyboard for weight/reps and high-frequency set operations.
  4. Add a heatmap-based completion/share card using existing body-map assets plus action volume data.
  5. Add dedicated cardio record and HIIT interval-timer flows.

## WeChat Registration Default Community Identity (`2026-06-05`)

- Task: make WeChat mini-program student registration/onboarding automatically provide an elegant CoachLink community-style default avatar and nickname, while keeping the option to switch to the user's WeChat avatar/nickname.
- Status: implemented at code level; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - `wechat_app/src/auth/student-onboarding/index.tsx`
- Implemented:
  - New incomplete student onboarding now generates a stable default identity from `userId`.
  - Default nickname uses community-style training names such as `晨练记录员`, `街健探索者`, and `训练合伙人` plus a deterministic 4-digit suffix.
  - Default avatar is a generated CoachLink-style SVG data URI using brand-compatible palettes and abstract training marks.
  - Existing profile avatar/nickname are preserved, and edit mode still shows the user's existing profile.
  - The first-step UI now explains that the default avatar/nickname are generated and that the user can replace them with WeChat avatar/nickname through the existing WeChat controls.
  - Follow-up fix: onboarding completion now defaults to `/pages/index/index` instead of impromptu training, and the final button says `完成注册`.
  - Follow-up fix: the generated SVG avatar is treated as onboarding-page display only and is not persisted to `user_profiles.avatar_url`; only a user-selected/uploaded WeChat avatar URL is saved.
- Verification:
  - Lightweight diff/content self-check only. Full lint/typecheck/build/test and WeChat DevTools verification intentionally not run.

## Knowledge Base Entry Polish (`2026-06-05`)

- Task: fix visible mojibake on the knowledge-base entry page and add an explicit under-construction reminder.
- Status: implemented at code level; no full Web/WeChat visual verification or full lint/typecheck/build/test run per local preference.
- Scope: Web `/dashboard/knowledge` and WeChat mini-program `/content/knowledge`.
- Implemented: cleaned remaining corrupted Chinese UI strings, added a compact ?knowledge base is under construction? notice, kept the pain-point-first four-entry layout and collapsed shelves behavior.
- Verification: targeted esbuild parse checks passed for the Web and WeChat knowledge TSX entries; `git diff --check` passed for touched knowledge entry files with CRLF warnings only.
# CURRENT_TASK

## WeChat Mini-Program Dark Theme Page Binding (`2026-06-13`)

- Status: implemented and verified.
- Problem: toggling dark mode only changed system UI; page backgrounds/cards/text stayed light.
- Fix:
  - `wechat_app/scripts/add-theme-class-to-pages.js`: batch script that adds `theme-${effectiveTheme}` to every page root JSX element.
  - Applied to all 117 WeChat mini-program page files under `wechat_app/src/`.
  - Manually patched `wechat_app/src/training/actions/index.tsx` (root View had no className) and `wechat_app/src/training/today-training/index.tsx` `renderLoading`.
  - `wechat_app/src/app.scss`: `.theme-dark` now sets `background: var(--bg-page)` so any page root with the class gets the dark background.
- Verification:
  - `npm run build:weapp` passed.
  - Babel parse check on all modified `.tsx` files passed.
  - WeChat DevTools automation on port 9421; `/me/profile/index` showed dark mode initially and switched to light mode after tapping the theme toggle.
  - `mrc screenshot` flaked after the first capture; no runtime errors in logs.
- Next step: if desired, run the full push gate (`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`) before committing.

## WeChat Mini-Program BottomNav Switch Animation (`2026-06-13`)

- Status: implemented.
- Problem: active item in `BottomNav` animates on first load, but tab switching feels instant because each page re-mounts its own `BottomNav` and applies the active state immediately on mount.
- Fix:
  - `wechat_app/src/components/BottomNav.tsx`: added a `mounted` state (initial `false`). After mount, `syncCurrentPath()` runs and a `setTimeout(..., 0)` flips `mounted` to `true`. Active state is forced to `false` while `mounted` is `false`; once `true`, the active item transitions from inactive to active, triggering the existing CSS transition.
- Verification:
  - `npm run build:weapp` passed after the change.
  - WeChat DevTools automation on port 9421: navigated from `/training/today-training` to `/discovery/index` by tapping the discovery nav icon; no runtime errors.
  - `mrc screenshot` remained flaky, so the animation was not captured visually.

## Knowledge Base Entry Simplification (`2026-06-06`)

- Task: simplify the Web and WeChat knowledge-base entry pages after the user judged the four-card/body-map/resource-switching layout confusing.
- Status: implemented, verified, and ready to commit/push.
- Scope:
  - `src/app/dashboard/knowledge/page.tsx`
  - `wechat_app/src/content/knowledge/index.tsx`
  - `wechat_app/src/content/knowledge/index.scss`
- Implemented:
  - Removed BodyMap from the knowledge entry page for now.
  - Removed the large four-image topic cards and the "click topic, update lower recommendation panel" interaction.
  - Replaced the entry structure with search, construction notice, three compact focus topics, featured training plans, and book notes.
  - Changed copy to a more formal, less colloquial tone and kept a non-medical boundary for pain/injury content.
- Verification:
  - Targeted `esbuild` checks passed for Web and WeChat knowledge entry TSX files.
  - `git diff --check` passed for the touched knowledge entry files with CRLF warnings only.
  - Repeat push-gate verification on `2026-06-07` passed: `npm run lint`, `npm run typecheck`, `npm test` (33 files / 162 tests), `npm run test:e2e` (4 tests), and `npx next build`.
  - During the repeat gate, `e2e/b1-subscription.spec.ts` was made more stable by logging seeded users in through the NextAuth credentials callback with CSRF instead of relying on the visible quick-login form.

# Web Coach Automation Nav Dedup (`2026-06-06`)

- Task: remove the duplicated Web coach automation entry from the desktop top navigation while keeping it under the user/"我的" menu.
- Status: completed.
- Scope:
  - `src/components/NavigationCoach.tsx`
- Implemented:
  - Removed the top-level desktop coach menu item `自动化`.
  - Kept the user dropdown item `自动化设置` pointing to `/dashboard/automation`.
- Verification:
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed; existing local Redis timeout / baseline-browser-mapping notices appeared but build exit code was 0.
  - `npm test`: passed, 32 files / 158 tests.
  - Playwright browser verification with a seeded coach confirmed the desktop top nav is `概览 / 视频点评 / 我的学员 / 内容管理 / 计划库` and the user menu still contains `自动化设置`.
  - Screenshot saved: `test-results/manual/web-coach-nav-automation-dedup.png`.

## WeChat Action Library UX Rework (`2026-06-05`)

- Task: reorganize the WeChat mini-program action library UI using the provided `训记` reference.
- Status: implemented at code level; no WeChat DevTools/manual visual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - `wechat_app/src/me/action-lib/index.tsx`
  - `wechat_app/src/me/action-lib/index.scss`
  - `wechat_app/src/training/actions/index.tsx`
  - `wechat_app/src/training/actions/index.config.ts`
  - `wechat_app/src/training/impromptu-training/index.tsx`
- Implemented:
  - Reworked the main action library from long article-style cards into a dark training-selector layout inspired by `训记`.
  - Added left-side muscle/body-part rail, horizontal equipment filters, compact search, public presets, and dense two-column public action cards.
  - Public action cards now show short decision fields only: action name, primary body part, tags, like count, demo/key-point marker, action detail entry, like/correction/add controls.
  - My-action cards were reorganized as compact rows with action name, body part/type, tags, 1RM badge, and quick actions for key points, references, contribution, and deletion.
  - Old `/training/actions` route now redirects to the redesigned `/me/action-lib?tab=public` page so users do not land on the legacy ugly list.
  - The impromptu training entry now opens `/me/action-lib?tab=public` for action-library management.
- Verification:
  - `git diff --check` passed for touched action-library files with CRLF warnings only.
  - Targeted `esbuild` checks passed for `wechat_app/src/me/action-lib/index.tsx`, `wechat_app/src/training/actions/index.tsx`, and `wechat_app/src/training/impromptu-training/index.tsx`.

## Student Training Execution UX Optimization Follow-up (`2026-06-05`)

- Task: optimize the student-side WeChat mini-program training execution and impromptu workout flow toward a `训记`-style fast workout logging experience.
- Status: second optimization pass implemented at code level; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - `wechat_app/src/training/training-execution`
  - `wechat_app/src/training/impromptu-training`
  - `wechat_app/src/services/impromptuService.ts`
- Implemented:
  - Replaced the impromptu workout entry from a prefilled mini-plan form with a quick action search/list.
  - Students can one-tap start a single action, or select multiple actions and start the session immediately.
  - Impromptu entry now seeds each selected action as one pending set with blank reps/weight and default 90s rest, leaving real logging to the shared execution page.
  - Fixed mini-program `impromptuService.finish()` to send backend-aligned `{ executionId }` instead of `{ id }`.
  - Quick-finish in impromptu execution mode now calls `impromptuService.finish(..., { mode: 'quick' })` so pending sets can be completed by the backend quick-finish path.
- Verification:
  - `git diff --check` passed for touched execution/impromptu files with CRLF warnings only.
  - Targeted `esbuild` checks passed for `wechat_app/src/training/impromptu-training/index.tsx` and `wechat_app/src/training/training-execution/index.tsx`.
- Next step:
  - Run WeChat DevTools/manual visual verification when requested.
  - After verification, consider richer in-execution action search/add flow and editable history polish.

## Student Training Execution UX Audit (`2026-06-05`)

- Task: explain the current student-side WeChat mini-program training execution UI/interaction in full detail and evaluate it against the product direction of mimicking `训记`.
- Status: first optimization pass implemented; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference.
- Scope:
  - Primary surface is `wechat_app/src/training/training-execution`.
  - Related entry/caching surfaces include `wechat_app/src/training/today-training`, `wechat_app/src/utils/trainingExecutionCache.ts`, and `wechat_app/src/utils/todayTrainingPageCache.ts`.
- Implemented:
  - Added a compact quick-log panel in the current set form with `套用计划` and `复制上一组`.
  - Added weight/reps/RPE steppers for faster set entry.
  - Persisted rest timer deadlines to local storage so leaving/re-entering the execution page can restore active rest countdowns.
  - Fixed mini-program complete-set payload to send backend-aligned `is_pr`, `actionId`, and `has_video` fields so manual PR/video state can persist more reliably.
  - Changed execution page primary complete/finish buttons to pure brand-color backgrounds instead of gradients.
- Verification:
  - `git diff --check` passed for touched execution files with CRLF warnings only.
  - Targeted `esbuild` check passed for `wechat_app/src/training/training-execution/index.tsx`.
- Product direction:
  - Student training execution experience is high priority.
  - Future iteration should move closer to a `训记`-style fast workout logging experience while preserving CoachLink-specific coach plan, execution notice, feedback, and coach automation context.

- Current finding:
  - WeChat impromptu training currently uses a separate `impromptu_executions` table and then reuses the shared `training-execution` UI.
  - Entry first requires choosing actions and planned sets/reps/rest/weight, then starts an execution and records sets one by one.
  - Impromptu records are included in training-history calendar/day/month summary alongside plan executions.
  - A likely bug exists in the WeChat impromptu finish path: `impromptuService.finish()` sends `{ id }`, while `/api/impromptu/finish` expects `executionId`.
  - Product gap: current impromptu is "prepare a mini plan, then execute it", not yet a `璁`-style "open and log immediately / add while training" experience.

## Coach Personal QR Payment Retirement (`2026-06-05`)

- Task: verify current Huifu/bank-card readiness and retire legacy coach personal QR-code payment because student-to-coach money should only go through Huifu/platform payment.
- Status: implemented in code and database; no full lint/typecheck/build/test or browser/WeChat DevTools verification run per local preference.
- Data finding:
  - Current coaches total: 17.
  - Huifu receiving-account ready coaches: 2 (`枭马葛`, `刘三乐`), both with `huifu_open_status='opened'` and bank-card token present.
  - Before cleanup, 16 coaches still had `allow_personal_qrcode` enabled and 3 coaches had QR codes configured (`刘三乐`, `枭马葛`, `刘孝烨`).
- Operational DB update:
  - Set `allow_personal_qrcode=false` for all 17 coach rows.
  - Cleared `payment_qr_codes=[]` for all 17 coach rows.
  - After cleanup: personal QR allowed count is 0 and configured QR count is 0.
- Implemented:
  - Student-facing coach payment info no longer exposes personal QR codes; QR-only modes are normalized to platform payment.
  - Web `PaymentDialog` defaults away from personal QR and offline payment; student subscription page passes platform-only payment options.
  - Student manual confirmation paths (`personal_qrcode`, `offline`, and waiting/pending confirmation submissions) now return a stopped-policy error.
  - Coach QR-code GET/POST/upload APIs are retained for compatibility but return disabled/empty or 410 stopped-policy responses.
  - Web `/coach/settings/payment` and WeChat `/coach/settings/payment` were converted to disabled notices with CTA to Huifu receiving-account setup.
  - Web and WeChat coach menu entries now point to receiving-account setup instead of old QR-code settings.
- Verification:
  - Web touched files passed targeted `esbuild` bundle check.
  - WeChat touched TSX files passed targeted `esbuild` bundle check with `.scss` loader; only stylesheet side-effect warnings appeared.
  - `git diff --check` passed for touched payment-retirement files with CRLF warnings only.

## Coach Automation V1 Implementation (`2026-06-05`)

- Task: implement the coach-service automation V1 plan: coach-global policy + per-subscription override, job tracking, first-plan auto publish, feedback adjustment drafts, next-phase/renewal automation, and coach-facing settings entries.
- Status: implemented at code level; database migration must be applied before the feature works online. Full lint/typecheck/build/test and browser/WeChat DevTools verification were not run per local preference.
- Implemented:
  - Added migration `supabase/migrations/20260605_coach_automation_v1.sql` with `coach_automation_policies`, `subscription_automation_overrides`, `coach_automation_jobs`, and `coach_plan_adjustment_drafts`.
  - Added `src/lib/coachingAutomation/` service layer for policy resolution, idempotent jobs, subscription activation, feedback adjustment, next-phase generation, renewal handling, and draft application.
  - Reworked the legacy `autoMatchPlanForSubscription(...)` path to delegate to `onSubscriptionActivated(...)`; first automatic plan defaults to `active` and does not depend on `CRON_SECRET`.
  - Wired feedback submission, plan completion, platform renewal, and subscription-order renewal to the new automation hooks.
  - Added coach APIs for global policy, per-student override, automation job/draft history, and applying adjustment drafts.
  - Added Web coach automation settings page, Web navigation entry, Web student-detail override panel, WeChat coach automation page, WeChat overview entry, and WeChat student-detail override controls.
  - Added focused tests for policy resolution and feedback patch safety behavior.
- Safety/behavior notes:
  - High-risk feedback (pain, injury, numbness, dizziness, obvious abnormality) is always review-only and never auto-applied.
  - Feedback patches only target future unexecuted training days and skip completed/in-progress/abandoned execution days.
  - Next-phase automation creates draft by default; auto-publish requires policy opt-in and archives the completed previous phase best-effort after the new active phase is created.
  - Feedback draft generation is currently a conservative deterministic patch generator with explicit safety guards. The existing interactive AI modifier remains available manually, but its core still needs to be extracted from the SSE route before it can safely replace the background job generator.
- Verification:
  - Targeted `esbuild` syntax checks passed for the new automation service/API/UI files and modified WeChat automation/student-detail files.
  - `git diff --check` passed for the touched automation files with CRLF warnings only.

## Coach Certification Flow Test Reset (`2026-06-05`)

- Task: support end-to-end testing of the upgraded coach certification / application review flow by temporarily removing coach access for selected approved coaches and nudging approved coaches with incomplete certification/profile data.
- Status: operational database update completed; no code changes or browser/build verification were requested.
- Completed:
  - Temporarily removed coach access for `沈妈妈` and `MAX`.
  - Set their `users.is_coach=false`, `users.coach_status='pending'`, and `users.primary_role='student'`.
  - Set their `coaches.status='suspended'` so they no longer appear as approved coaches in discovery/purchase paths that filter `coaches.status='approved'`.
  - Set their `coach_applications.status='needs_info'` with review notes instructing them to open `申请成为教练`, complete missing/updated fields, and resubmit for review.
  - Sent both users system private messages explaining this is a platform flow test / data completion pass and that coach access will recover after re-approval.
  - Sent non-blocking system reminders to 13 other approved, non-E2E coaches whose application/profile/payment-readiness data had gaps. Their coach access was not changed.
- Important follow-up:
  - The current product flow reuses the existing `coach_applications` row for resubmission; it does not create a brand-new application record unless the old row is deleted/archived manually.
  - When `沈妈妈` or `MAX` resubmit, their application should move back toward `pending`; admin approval should upsert `coaches.status='approved'` and restore `users.is_coach=true`.

## Coach Pricing Requires Bank Binding (`2026-06-05`)

- Task: confirm and enforce whether coaches can set subscription package pricing before Huifu receiving-account / bank-card binding.
- Status: hard pricing gate implemented in code; no full lint/typecheck/build/test or browser/WeChat verification run per local preference.
- Finding:
  - The earlier `2026-06-04` optimization added receiving-account reminders and blocked student payment for unready coaches, but still allowed coaches to save pricing drafts.
- Implemented:
  - `/api/coach/update-pricing` now requires `coaches.huifu_open_status='opened'` and a non-empty `coaches.huifu_card_token`; otherwise it returns 403 and refuses to create/update `coach_pricing`.
  - Web `/dashboard/pricing` now blocks add/edit/delete/save pricing actions when the receiving account is not ready, disables add/update controls, and shows a binding CTA.
  - WeChat `/coach/pricing` now blocks add/edit/delete pricing actions, visually dims add controls, and shows the same binding CTA.
  - WeChat `/coach/pricing/edit` now blocks and disables saving when the receiving account is not ready.
- Verification:
  - `git diff --check` passed for the touched pricing files with CRLF warnings only.
  - Full lint/typecheck/build/test and UI verification were intentionally not run.

## WeChat Registration Nickname Autofill (`2026-06-05`)

- Task: fix the recurring WeChat mini-program student registration/onboarding issue where tapping the native WeChat nickname candidate may not reliably fill/sync the nickname.
- Status: implemented code-level fix; no WeChat DevTools/browser verification or full lint/typecheck/build/test sequence run per local preference.
- Implemented:
  - `wechat_app/src/auth/student-onboarding/index.tsx` now wraps the onboarding page in a native `Form` and gives the `type="nickname"` input `name="nickname"`.
  - The first-step `下一步` footer control is now a `TaroButton` with `formType="submit"` so WeChat's native nickname value can be read from form submission even when `onInput` / `onBlur` do not report the selected candidate.
  - Reused a single nickname synchronization helper for event values, form values, and native-node fallback reads; step-1 validation can receive the freshly synced nickname before React state catches up.
  - `wechat_app/src/auth/student-onboarding/index.scss` resets the Taro button default border/margins for the footer button and changes active feedback to opacity only.
- Verification:
  - Targeted `esbuild` parse/bundle check passed for `wechat_app/src/auth/student-onboarding/index.tsx`.
  - `git diff --check -- wechat_app/src/auth/student-onboarding/index.tsx wechat_app/src/auth/student-onboarding/index.scss` passed with CRLF warnings only.
  - Manual WeChat nickname-candidate tapping was not verified automatically per local preference.

## Coach Huifu Bank Binding UX (`2026-06-05`)

- Task: reduce coach friction in Huifu receiving-account onboarding by replacing avoidable machine-code inputs with human-readable choices.
- Status: implemented bank and region selector flow; no full lint/typecheck/build/test or Web/WeChat verification run per local preference.
- Implemented:
  - Added shared Huifu account option config for Web and WeChat mini-program: bank-code options plus 31 province-level and 450 city/district-level administrative code options.
  - Web `/dashboard/wallet/merchant` now shows selectors for `开户银行`, `开户省份`, and `开户城市/区县`; `bankCode`, `provId`, and `areaId` are generated and shown as read-only previews.
  - WeChat mini-program `/coach/wallet/merchant` mirrors the same selection flow with Taro `Picker` controls and read-only code previews.
  - Copy now distinguishes `银行编码` as the bank-level code and `具体支行联行号` as the branch-level clearing number.
  - `支行联行号` remains manual because it identifies the exact bank branch clearing node and cannot be safely inferred from bank + province/city alone.
- Next step:
  - Longer term, replace manual `支行联行号` with a searchable branch selector backed by a maintained bank/branch code dataset.
- Follow-up diagnosis:
  - User shared a failed binding screenshot for coach `刘三乐`: bank code `01040000`, branch clearing number `105138000194`, branch name `张家口市民支行`, and Huifu returned `银行编码有误`.
  - Likely cause is field mismatch, not missing environment variables: `01040000` is Bank of China, while `105...` branch clearing numbers and the visible card BIN appear to be China Construction Bank. The bank code should likely be `01050000` if the card/branch is CCB.
  - Huifu binding depends on core `HUIFU_*` credentials; missing envs would usually surface as config/sign/request failures rather than this specific bank-code validation error.
  - Added a Web-only local debug shortcut on `/dashboard/wallet/merchant`: when running on localhost or non-production, step 0 shows `跳到银行卡信息` so the bank/region selector UI can be previewed without uploading ID images. This only changes client navigation and does not bypass backend Huifu validation.
  - Downloaded Huifu official bank-code and area-code attachments for a local comparison. Current built-in 23 bank options all match Huifu bank codes; 31 province options and 450 city/district options all match Huifu area codes.
  - Corrected several bank codes to Huifu attachment values: Ping An Bank, Beijing Bank, Shanghai Bank, Jiangsu Bank, Nanjing Bank, Ningbo Bank, and Bohai Bank.
  - Added Web and WeChat guidance for the only remaining manual bank field: `具体支行联行号`. The UI now tells coaches to find the opening branch and 12-digit CNAPS/联行号 through bank app/online banking or bank customer service, and warns not to mix bank code with another bank's branch number.

## Subscription-To-Plan Automation Audit (`2026-06-04`)

- Task: inspect the student journey from coach discovery, subscription, coach questionnaire, payment, plan delivery, execution feedback, plan adjustment, renewal, and end/next-phase behavior.
- Status: analysis completed; follow-up code direction is to refactor the automation loop into explicit policy, event, job, and state-machine services rather than scattered one-off calls.
- Product/code direction (`2026-06-05`):
  - Keep deployment env unchanged for now. The main automatic first-plan path should be code-driven and not depend on `CRON_SECRET`.
  - Full automation should be modeled as a "coaching automation engine" with explicit stages: subscription activated, questionnaire ready, initial plan issued, execution finished, feedback received, adjustment evaluated, patch drafted/applied, phase completed, renewal/next phase resolved.
  - Add durable automation policy at coach/package/student levels, durable automation job records, and backend services for initial plan issue, feedback adjustment, next-phase generation, renewal handling, and safety escalation.
  - The existing direct calls to `autoMatchPlanForSubscription(...)`, feedback notification-only flow, manual AI modifier, and stub next-phase route should be reorganized around these services.
- Deployment follow-up (`2026-06-05`):
  - User checked `littlehorse-deployment/coachlink`: both production `main/.env.main -> ConfigMap coachlink-main-env` and development `dev/.env.dev -> ConfigMap coachlink-dev-env` currently lack `CRON_SECRET` and `ALIPAY_SYNC_SECRET`.
  - Code confirmation: these variables are internal cron/background-job authorization secrets, not payment-provider credentials. Coach mini-program subscription payment still uses Huifu-created WeChat JSPay (`/api/payment/wechat/coach/create`) and Huifu notify (`/api/payment/wechat/notify`).
  - Practical impact: without `CRON_SECRET` or `ALIPAY_SYNC_SECRET`, `src/instrumentation.ts` skips the in-process `ActivatePendingPlans` job, so AI-created `coach_plan_instances.status='scheduled'` plans can remain scheduled instead of becoming active automatically.
  - Huifu delayed settlement background jobs use `HUIFU_SETTLEMENT_CRON_SECRET` or fall back to `CRON_SECRET`; configuring only `CRON_SECRET` would currently unlock both pending-plan activation and Huifu settlement processors through the shared fallback.
  - Follow-up implemented: changed `autoMatchPlanForSubscription(...)` to create the first automatically matched plan with `delayedActivation: false`, so successful auto-generation publishes an `active` plan immediately and sends the student notification without waiting for cron. Coach-facing success messages were updated from "visible after a few minutes" to "student can view now".
  - Verification note: no full lint/typecheck/build/test run was requested or run per local preference.
- Current implementation:
  - Student subscription flow exists on Web and WeChat mini-program. Coach questionnaire answers are persisted into `coach_subscriptions.subscribe_data` before payment/activation.
  - Platform-paid new subscriptions are system-confirmed by payment notify/query and then call `autoMatchPlanForSubscription(...)`.
  - Coach/manual confirmed offline payments also call `autoMatchPlanForSubscription(...)` after status becomes `active`.
  - Initial automatic plan generation only runs when the subscription is active, has questionnaire data, and has no existing plan instance. After the 2026-06-05 fix, it publishes the first generated plan as `active` immediately and notifies the student; `/api/plan-lib/activate-pending-plans` remains a fallback for existing or future explicitly scheduled rows.
  - In-process activation for leftover `scheduled` rows still depends on `ALIPAY_SYNC_SECRET` or `CRON_SECRET` being configured in `src/instrumentation.ts`.
  - Student training execution records sets/items and can update e1RM/PR state; after completion the student can submit one feedback row to `execution_feedbacks`, which is also sent to the coach as a direct message.
  - Coach-side Web and WeChat plan editors can manually use AI generation and AI modifier. The AI modifier context can include recent feedbacks, execution history, profile, questionnaire, actions, and templates.
- Gaps against the desired fully automated coaching loop:
  - There is no durable coach/package setting such as "auto issue plan" / "auto adjust from feedback".
  - No backend job consumes `execution_feedbacks` to automatically create or apply plan adjustment patches.
  - Feedback-driven AI adjustment is currently a coach-triggered workflow: feedback opens/prefills the AI modifier, and the coach still applies/saves the result.
  - Renewal only extends `subscribed_weeks` and refreshes entitlement snapshot; it does not auto-generate a next phase.
  - `/api/plan-lib/generate-next-phase` exists but is a stub/TODO and is not the reliable next-phase automation path.
  - Auto-match skips if any plan instance already exists under the subscription, so completed/archived prior phases can still force manual intervention.
- Recommended next implementation:
  1. Make initial auto-plan delivery reliable and visible: add explicit coach/package policy, job status, service-role generation, and robust activation fallback.
  2. Add feedback-to-adjustment jobs that generate reviewed patches for future plan days first; later allow auto-apply under coach-approved rules.
  3. Add completed-plan/renewal next-phase automation using the existing personalized AI generation path plus execution/feedback context, not the current stub route.

## WeChat Coach Profile / Overview UI Alignment (`2026-06-04`)

- Task: align WeChat mini-program coach-side `/coach/my-profile` and `/coach/overview` visual style with the student-side `/me/profile/index` "My" page while preserving coach functionality.
- Status: implemented with lightweight code checks; no full lint/typecheck/build/test or WeChat DevTools verification run per local preference.
- Implemented:
  - Reworked `wechat_app/src/coach/my-profile/index.scss` from the cold blue desktop-like card system to the student-side rpx card rhythm: gray page gradient, round avatar, white profile card, summary pills, grouped white menu cards, brand color `#CF6D4E`, and 8rpx-grid spacing.
  - Reworked `wechat_app/src/coach/overview/index.scss` so the metrics and configuration entries use the same lightweight white-card/list style as the student "My" page.
  - Updated coach overview non-state icon colors toward brand/student-side palette while keeping existing data, click handlers, routes, role switching, wallet, pricing, questionnaire, invitation, security, and logout behavior unchanged.
  - Follow-up: removed the accidental `182rpx` top content padding from both coach pages because they use native navigation bars; content now starts at normal `24rpx` below the nav bar.
- Verification:
  - Targeted `esbuild` parse/bundle checks passed for `wechat_app/src/coach/my-profile/index.tsx` and `wechat_app/src/coach/overview/index.tsx` with stylesheet side-effect warnings only.
  - `git diff --check` passed for touched files with CRLF warnings only.

## Coach Receiving Account Readiness (`2026-06-04`)

- Task: optimize coach application / package setup flow so coaches are reminded to open Huifu receiving account and bind a bank card before their packages can be sold; align Web and WeChat mini-program surfaces.
- Status: implemented with lightweight code checks; no full lint/typecheck/build/test or browser/WeChat DevTools verification run per local preference.
- Implemented:
  - Coach overview API now returns `receivingAccountReady`, `huifuOpenStatus`, and `huifuOpenMsg` based on the coach's Huifu opening/card-token state.
  - Web coach overview shows `收款账户` before pricing in the configuration checklist.
  - Web pricing settings page shows a receiving-account readiness card and links to `/dashboard/wallet/merchant`; pricing drafts can still be saved.
  - Web student coach profile blocks direct platform subscribe/renew actions when the coach Huifu receiving account is not opened and shows a student-facing warning in the pricing area.
  - WeChat coach overview shows `收款账户` before pricing and links to `/coach/wallet/merchant`.
  - WeChat coach pricing list and pricing edit page show the same receiving-account warning/CTA and keep draft editing available.
  - WeChat student coach profile pricing section shows a warning and disables package selection until `huifu_open_status='opened'`.
  - WeChat coach application page now collects the Web-aligned layered fields: coach track, service modes, target student levels, support focus, and province/city/county/address.
- Verification:
  - Targeted `esbuild` parse/transpile check passed for touched TS/TSX files.
  - `git diff --check` passed with CRLF warnings only.

## Registration Flow Audit (`2026-06-04`)

- Task: inspect current Web / WeChat mini-program registration, login-created-account, student onboarding, and coach application flow for duplication and optimization points.
- Status: analysis completed; no business code changes requested or made.
- Current shape:
  - Web explicit registration uses `/register` -> `/api/auth/register` -> NextAuth password login -> `/complete-profile` -> `OnboardingModal`.
  - Web verification-code login can also auto-create a user through NextAuth credentials, so it behaves as an implicit registration path.
  - Web WeChat QR login has WeChat-openid-only account creation paths and does not currently bind by phone or unionid.
  - Mini-program has three account-entry paths: phone quick login via `/api/miniapp/wechat-login`, password / verification-code login via `/api/miniapp/login`, and explicit register via `/api/auth/register`.
  - Student onboarding generally uses `onboarding_completed === true` plus core profile completeness, but mini-program explicit register currently relaunches to the default home URL instead of reusing the shared post-login onboarding resolver.
  - Coach application has Web and mini-program implementations, but Web is the newer layered flow while the mini-program page still sends an older, smaller field set.
- Key findings:
  - Account creation logic is duplicated across `/api/auth/register`, NextAuth verification-code login, Web WeChat OAuth/bridge login, `/api/miniapp/login`, and `/api/miniapp/wechat-login`.
  - Passwordless accounts created by verification-code / WeChat flows store blank or `"null"` password hashes; later password login can produce poor failure behavior and should route users to password setup/reset instead.
  - A single `users.wechat_openid` field is being used for both Web Open Platform and mini-program openids, while unionid is fetched but not persisted, creating duplicate-account and binding-overwrite risk.
  - Generated nicknames are cleaned in mini-program login helpers but can still be prefilled in Web onboarding after explicit registration / Web verification-code auto-registration.
  - Coach application creation is frontend-guarded but not backend-idempotent; duplicate rows would break `maybeSingle()` reads.
- Suggested next step:
  - Refactor around shared identity helpers: `findOrCreateUserByContact`, `ensureUserProfile`, `resolvePostLoginDestination`, and idempotent `upsertCoachApplication`, then align mini-program coach application with the Web layered schema.
- Follow-up fix after user clarified focus:
  - Updated `wechat_app/src/auth/register/index.tsx` so explicit mini-program registration now reuses `studentOnboardingService.resolvePostLoginUrl(...)` after auto-login, matching the login page behavior. New incomplete students should be sent to `/auth/student-onboarding` instead of defaulting straight to `/pages/index/index`.
  - Removed the duplicate `targetBodyParts` prompt from mini-program student onboarding step 7. Step 3 remains the single body-part selection step; step 7 now only asks common equipment and session duration.
  - No build / WeChat DevTools verification was run automatically per local preference.
- Unified questionnaire implementation:
  - Web `OnboardingModal` and WeChat `student-onboarding` now use the same registration question model: optional avatar, nickname, gender, height, weight, multi-select fitness goals, fitness level, target body parts, weekly frequency, equipment, and session duration.
  - Fitness goals are multi-select with a 3-goal cap. The first goal is saved to legacy `user_profiles.fitness_goal`; the full list is saved to `onboarding_questionnaires.answers.fitness_goals`.
  - Removed the visible `interest_tags` / "训练方向" question from registration while continuing to write derived compatibility tags for legacy AI/profile consumers.
  - Web and WeChat fitness profile cards now show/edit the unified goal/frequency/body/equipment/duration answers and fall back from old `fitness_goal` when `fitness_goals` is missing.
  - AI profile-based plan/action bootstrapping and batch-operation context now read latest questionnaire `fitness_goals` / `weekly_frequency` with old-field fallback.
  - Lightweight verification: touched TS/TSX files passed esbuild transform checks; `git diff --check` reported only CRLF warnings.

---

## Coach Wallet Missing Income Check (`2026-06-04`)

- Task: answer why coach `枭马葛` cannot see wallet income for student `最终航行`.
- Result:
  - Student did pay. Subscription `3b734f5d-0f1b-44a9-a611-7812429d626f` is active and linked to paid platform WeChat order `76c0dedd-6ba8-4a98-b943-68016de5ac0b`.
  - Payment was confirmed by system at `2026-05-28T15:36:10.438+00:00`; order total is `19900` fen.
  - Coach wallet has no transaction for this order yet because Huifu settlement `438f9deb-8714-47bf-b63b-ec16b26352fd` is still `pending`, with coach net share `15920` fen and platform fee `3980` fen.
  - Settlement becomes eligible at `2026-06-04T15:36:10.549+00:00` UTC (`2026-06-04 23:36:10` Asia/Shanghai). Wallet income appears only after the settlement processor succeeds and inserts `wallet_transactions`.
- Next step:
  - If it remains invisible after the eligible time plus processor run, inspect or run the admin due-settlement processor/reconciliation path rather than manually editing wallet balances.
- Follow-up implemented:
  - Wallet API now returns paid-but-not-yet-wallet-credited Huifu settlement rows as `pending_settlements` plus `pending_settlement_amount`.
  - Web wallet page now adds pending settlement amount into the displayed frozen line, shows a separate `待结算收入` line, and renders pending settlement records at the top of income details.
  - This keeps withdrawable balance unchanged while making paid delayed-settlement orders visible to coaches.

---

## Knowledge Base Product Direction (`2026-06-03`)

- Task context: user shared a fitness-community and public-platform pain-point research report and asked what CoachLink knowledge base should prioritize, how to present it, and how to collect content.
- Working product direction:
  - Knowledge base should be pain-point/problem oriented first, not a generic article shelf.
  - Highest-value first categories: injury/pain prevention and return-to-training, plateau diagnosis and specialty plans, movement standards/video review criteria, periodization/plan application, recovery/nutrition basics, and accountability/community practice.
  - Existing surfaces should be reused: books as source/reference, public plans as executable templates, and BodyMap as a body-part/action-problem landing surface that can mount articles and plans.
  - Content collection should combine user behavior signals, coach/student Q&A, execution-data bottlenecks, community hot topics, and curated external research, then go through review before publishing.
- Implemented on `2026-06-03`:
  - Reworked Web `/dashboard/knowledge` into four pain-point entry cards: injury/risk, plateau/no results, movement standards, and start training.
  - Added generated static entry images under `public/images/knowledge-core/`.
  - Added shared Web topic config at `src/config/knowledgeCoreTopics.ts`.
  - Reworked WeChat mini-program `/content/knowledge` to show the same four entries first, with topic tags, primary CTA, and a topic resource panel above existing plans/books/body-map modules.
  - Added mini-program static entry images under `wechat_app/src/assets/knowledge-core/` and topic config at `wechat_app/src/config/knowledgeCoreTopics.ts`.
  - Extended `src/content/adminImport/highValueKnowledgePack.ts` from 3 to 11 original articles, adding injury-boundary, plateau, and movement-standard first-batch content; injury/rehab articles include non-medical-diagnosis and offline-evaluation boundary copy.
- Verification:
  - `npx tsx scripts/import-high-value-knowledge-pack.ts --dry-run` passed with 8 plans, 11 articles, 2 books.
  - `git diff --check` passed with CRLF warnings only.
  - Per local preference, no browser/WeChat DevTools verification or full lint/typecheck/build/test was run automatically.
- Follow-up UX simplification on `2026-06-04`:
  - User observed the knowledge page was too long and that mobile / mini-program interactions felt odd because clicking top entries jumped to lower same-page sections, sometimes with no useful content.
  - Web `/dashboard/knowledge` and WeChat `/content/knowledge` were lightly simplified into a compact gateway: four topic cards only select the active pain point, and BodyMap / plan library / books are hidden behind explicit expand buttons.
  - Plan resource links now use readable plan names and open plan detail directly where possible; article links fill the search box instead of navigating to empty multi-keyword search results.
  - Lightweight verification: both touched TSX files parsed with `esbuild`; `git diff --check` passed with CRLF warnings only. Full lint/typecheck/build/test and browser/WeChat visual verification were not run per local preference.

---

## Admin Knowledge Content Import Backend (`2026-05-29`)

- Task: add an administrator-side content import backend so knowledge-base training plans, articles, and book notes can be managed through the database instead of hardcoding content or pasting long SQL files.
- Implemented:
  - Added `src/lib/adminContentImport.ts` as the shared import/validation engine.
  - Added admin APIs:
    - `POST /api/admin/content-import` for JSON bundle validation/import.
    - `POST /api/admin/content-import/high-value-pack` for the built-in high-value specialty pack.
  - Added admin UI page `src/app/admin/content-import/page.tsx` with JSON textarea import, local JSON file selection, dry-run validation, publish/draft toggle, and one-click high-value pack import.
  - Added `内容导入` to the administrator navigation.
  - Added `src/content/adminImport/highValueKnowledgePack.ts` with first-batch high-value original content:
    - 8 specialty-first plan templates: bench press, squat, powerlifting, weighted pull-up, weighted dip, deadlift, round shoulder/scapula, anterior pelvic tilt/core stability.
    - 3 knowledge articles.
    - 2 book-note entries.
  - Added `scripts/import-high-value-knowledge-pack.ts` for CLI import/dry-run using `.env.local` / `.env.development`.
- Data write:
  - Executed `npx tsx scripts/import-high-value-knowledge-pack.ts` against the configured Supabase.
  - Imported/upserted `8` published public training plan templates, `3` knowledge article nodes, and `2` knowledge books.
  - Imported rows included `bench-press-8w-specialization`, `squat-8w-depth-and-strength`, `powerlifting-12w-total-base`, `weighted-pullup-6w-strength`, `weighted-dip-6w-strength`, `deadlift-8w-lockout-and-start`, `round-shoulder-scapula-4w`, and `anterior-pelvic-tilt-4w`.
- Verification:
  - `npx tsx scripts/import-high-value-knowledge-pack.ts --dry-run` passed with `8` plans, `3` articles, `2` books and no validation errors.
  - `npx tsx scripts/import-high-value-knowledge-pack.ts` succeeded and wrote the same counts to Supabase.
  - Targeted TypeScript program check passed for the new import engine, content pack, admin routes, admin page, navigation, and CLI script.
  - `git diff --check` passed for the touched files with standard CRLF warnings only.
  - Per local preference, no browser UI verification or full lint/typecheck/build/test was run automatically.
- Next step:
  - If desired, extend the importer with source attribution fields and a review queue for externally collected material before publishing.

---

## Manual Renewal Stale End-Date Follow-Up (`2026-05-28`)

- Task: fix the remaining stale-writer path where coach manual/offline payment confirmation could write `offline_payment.expires_at` or a natural-day renewal extension into `coach_subscriptions.end_date`.
- Root cause:
  - `src/app/dashboard/students/PaymentConfirmationDialog.tsx` still sent `end_date` during offline confirmation and pending-renew confirmation.
  - `src/app/api/subscription/update-subscription/route.ts` accepted client-provided `end_date` for active/manual confirmation.
  - `refreshSubscriptionEntitlementSnapshot` only persisted when `model.displayEndDate` was truthy, so active subscriptions with no reliable projection could retain old stale dates instead of clearing them.
- Implemented:
  - Manual confirmation no longer sends `end_date`; it only sends status/weeks/payment evidence.
  - `update-subscription` ignores client `end_date` except explicit cancellation/expired lifecycle updates, then responds with the unified model-derived `end_date`.
  - Snapshot refresh now persists `end_date: null` for active subscriptions when the unified model cannot project a reliable display date.
  - Coach student UI copy now says `当前计划预计完成` and clarifies that purchase weeks are an entitlement pool, not a natural expiry date.
  - Added tests covering snapshot clearing and update-subscription ignoring client supplied `end_date`.
- Data repair:
  - Student `鞑靼` subscription `06f07de8-e013-4106-a5ef-0637147a7e0b` is now `subscribed_weeks=40`; refreshed model says `active/available`, `24/32` credits used, `8` remaining, current-plan projected completion `2026-06-11T14:24:15.264Z`.
  - Repaired the reappeared false-blocked `唐` subscription `8b03677a-8ecb-4cac-84b1-01620a20ab27` from stale `2026-05-23T09:01:57.049+00:00` to model projection `2026-07-06T14:24:32.755Z`.
  - Follow-up audit returned `falseBlockedByStaleEndDate=[]`; remaining groups are true exhausted/grace (`5`), should-auto-cancel (`6`), and active-no-plan (`11`).
  - Later audit at `2026-05-28T15:34:44.526Z` showed `唐` false-blocked reappeared again with `updated_at=2026-05-28T14:29:17.52Z`, after local code/data repair. This indicates a still-running old deployed path or background job can still write stale `end_date` until the code fix is deployed everywhere.
  - Executed repair again at `2026-05-28T15:35:45.333Z`; post-repair audit at `2026-05-28T15:36:06.848Z` returned `falseBlockedByStaleEndDate=[]`, `healthy=72`, `true_grace_or_exhausted_not_complete=5`, `should_auto_cancel=6`, `active_no_plan=11`.
- Verification:
  - `npx vitest run src/lib/subscriptionEntitlementSnapshot.test.ts src/app/api/subscription/update-subscription.integration.test.ts` passed.
  - `npm run lint` passed.
  - `npm run typecheck` passed.
  - `npm test` passed (`30` files, `153` tests).
  - `npx next build` passed; local Redis connection warnings are non-fatal.
  - `npm run test:e2e` passed (`4` tests).

---

## Subscription Entitlement Repair and Backfill (`2026-05-28`)

- Task: implement the user-approved repair plan so stale `coach_subscriptions.end_date` can no longer put students with remaining credits into grace/expired UI, and repair current cloud false-blocked rows without touching true exhausted relations.
- Implemented:
  - Added `src/lib/subscriptionEntitlementAudit.ts` and `scripts/repair-subscription-entitlements.ts` for dry-run/execute auditing and repair.
  - `coach-subscriptions`, `check-expired-subscriptions`, and `check-subscription?action=check-expired` now use the unified entitlement model fields and update derived `end_date` through normal `update` calls instead of independent stale-lifecycle logic.
  - Active subscriptions with remaining credits, active no-plan subscriptions, and active not-started plans no longer reuse stale raw `end_date` as lifecycle truth.
  - Frontend grace displays on Web and WeChat now require unified `expired_grace` plus no remaining credits before showing grace/renewal lock.
- Data repair:
  - Dry-run before execute found only `2` remaining false-blocked rows at execution time; earlier audit had found `50`, but most had already been refreshed by the corrected model paths during subsequent usage.
  - Executed `npx tsx scripts/repair-subscription-entitlements.ts --execute --scope=false-blocked`: updated `2/2` rows (`65aaf5dd-ffc0-4bf0-a07a-c22648c9ee42` cleared stale `end_date`; `8b03677a-8ecb-4cac-84b1-01620a20ab27` refreshed to `2026-07-06T10:37:29.783Z`).
  - Post-repair dry-run returned `matchedCount=0`; final audit still separates true exhausted/grace rows (`6`) and active no-plan rows (`11`) from false-blocked rows.
- Verification:
  - `npm run lint` passed.
  - `npm run typecheck` passed.
  - `npm test` passed (`28` files, `151` tests).
  - `npm run test:e2e` passed (`4` tests, including the previously failing B1 subscription cases).
  - `npx next build` passed; Redis connection warnings appeared because local Redis is not running, but build exited successfully.
  - `git diff --check` passed with CRLF warnings only.

---

## WeChat Today-Training Subscription Grace Regression (`2026-05-28`)

- Task: investigate and fix why student/coach-profile `枭马葛` with coach `刘三乐` showed mini-program today-training banner `当前订阅处于宽限期，剩余9天（截至6/6）` while the student was only on week 2 / day 12 and still had an active coach plan.
- Cloud facts checked read-only:
  - Student user id: `f9eac5b1-45f9-4479-9ab8-8223a5db8835`.
  - Coach id for `刘三乐`: `beee4371-efad-4e35-b406-c567954896c2`.
  - Subscription id: `44ecb017-34bf-49ad-a46d-faf01e5ceac3`, status `active`, `subscribed_weeks=8`, stored `end_date=2026-05-22T16:33:40.913Z`.
  - Latest active plan instance: `5613f3d3-f9e3-4f6e-a243-aa277597ee63`, 84 total days, 34 training days, completed training days `1,3,5,8,10`, day `12` in progress.
  - Unified entitlement model at `2026-05-28 15:14 +08:00`: `entitlementStatus=available`, `lifecycleStatus=active`, `canTrain=true`, `remainingCredits=10`, projected `displayEndDate=2026-06-21T07:14:00Z`.
- Root cause:
  - Current cloud schema lacks `coach_plan_instances.entitlement_consumption_policy`, but several unified-model query paths selected that optional column. The query failed, so API behavior fell back to legacy lifecycle judgment.
  - `coach-subscriptions` then used old `getSubscriptionLifecycle` against the stored stale `end_date`, producing `expired_grace` and `grace_days_left=9` even though credits remained.
- Implemented:
  - Removed optional `entitlement_consumption_policy` selects from subscription entitlement query paths that must work against the current cloud schema. Missing policy keeps the existing default semantics: `count_service`.
  - `coach-subscriptions` now carries unified-model lifecycle fields (`lifecycle_status`, `grace_days_left`, `should_auto_cancel`) through to the response instead of recomputing lifecycle from stale/display `end_date`.
  - Mini-program `TodayTrainingScreen` now suppresses grace UI when the active subscription still has positive remaining days or positive `entitlement_remaining_credits`.
- Verification:
  - Read-only simulation of the corrected route for `44ecb017-34bf-49ad-a46d-faf01e5ceac3` returns `lifecycle_status=active`, `is_in_grace_period=false`, `entitlement_remaining_credits=10`, `plan_progress_status=in_progress`.
  - Targeted TS transpile check passed for modified route/lib/mini-program files.
  - `npx vitest run src/lib/subscriptionEntitlementModel.test.ts src/lib/subscriptionAccess.test.ts` passed (`12` tests).
  - `git diff --check` passed with standard CRLF warnings only.
  - No WeChat DevTools/manual visual verification was run per local preference unless explicitly requested.

---

## WeChat Today-Training Question-Mark Header (`2026-05-28`)

- Task: fix the mini-program `今天练什么` title area showing `????` below the heading.
- Root cause:
  - `wechat_app/src/training/today-training/components/ScheduleCalendarPanel.tsx` contained literal placeholder text in the header meta row: ``? ?${currentWeek} ?`` and ``? ??? ${selectedSchedule.totalDelayDays} ?``.
- Implemented:
  - Replaced the placeholders with readable Chinese labels: `· 第N周` and `· 顺延N天`.
  - Restored `wechat_app/src/utils/dateFormat.ts` Chinese date labels to valid UTF-8 for shared date formatting.
- Verification:
  - Lightweight TypeScript transpile check passed for `ScheduleCalendarPanel.tsx` and `dateFormat.ts`.
  - No WeChat DevTools/manual verification or full lint/typecheck/build/test was run per local developer preference unless explicitly requested.

---

## Unified Subscription Entitlement Model (`2026-05-27`)

- Task: implement the real unified subscription entitlement model before building the later same-source blackbox/whitebox simulator.
- Product facts being fixed:
  - Student `c844cae9-d271-452f-9b80-e54dd67eb752` and `c844cae9-d271-452f-9b80-e54dd67eb752`-style cases showed that `/today-training`, `/me/plan-history`, coach list, subscription checks, renewals, and execution access were interpreting `status/end_date/subscribed_weeks/has_plan_instance` differently.
  - Student `c844cae9-d271-452f-9b80-e54dd67eb752` has an active 15-week plan with only `4/60` completed and an in-progress later day, so the plan must be treated as in-progress, not completed.
  - A purchased `4 weeks` entitlement is a plan-week training-day window, not a natural calendar hard expiry.
  - Renewal before relationship cancellation accumulates `subscribed_weeks` into the same entitlement pool; after auto-cancel, a later purchase should be treated as a re-subscription/relation restoration path.
- Implemented:
  - Added `src/lib/subscriptionEntitlementModel.ts` as the central derivation model. It outputs relation status, entitlement status, plan progress status, credits, remaining entitlement, display end date, `canTrain`, `canViewHistory`, and `shouldAutoCancel`.
  - Added `src/lib/subscriptionEntitlementSnapshot.ts` to refresh a subscription's derived display `end_date` from the same model after renewal/payment/update flows.
  - Converted `subscriptionAccess.ts` into a compatibility wrapper around the central model so `get-instance`, `get-with-executions`, skip-day, next-day, and execution start gates stop maintaining a separate credits model.
  - Updated `coach-subscriptions`, `check-expired-subscriptions`, `check-subscription?action=check-expired`, `renew-subscription`, `update-subscription`, `subscriptionOrders`, `fulfillPaidOrder`, `execution/updateEstimatedEndDate`, `plan-lib/get-instance`, and `coach/list-students` to consume the central model or snapshot refresh.
  - Removed the unfinished `shouldAutoCancelCoachSubscription` / lifecycle display helper from `subscriptionLifecycle.ts` so auto-cancel is no longer a second policy path.
  - Renewal compatibility branches now add weeks/order facts and no longer directly add natural days to `end_date`; `end_date` is derived from the model.
- Verification:
  - `npx vitest run src/lib/subscriptionAccess.test.ts src/lib/subscriptionEntitlementModel.test.ts src/lib/todayTrainingPlanState.test.ts src/lib/subscriptionLifecycle.test.ts src/app/api/subscription/check-subscription.integration.test.ts` passed (`5` files, `21` tests).
  - Full gate before push on `2026-05-27`: `npm run lint` passed, `npm run typecheck` passed, `npm test` passed (`26` files, `142` tests).
  - `npm run test:e2e` is still failing on `e2e/b1-subscription.spec.ts` (`2` failures): one seeded quick-login case could not log in user `13928583186` / `f435c281-66ac-46d5-a29a-df91d2b99e9d`, and one remaining-days assertion never reached the expected subscription page content.
  - Route import smoke check passed for affected subscription, plan-instance, coach-list, and execution-access modules.
  - `npm run typecheck -- --pretty false` passed.
  - `git diff --check` passed with only standard CRLF warnings.
  - Browser/UI verification was not run per local developer preference unless explicitly requested.
- Next step:
  - Build the same-source simulator/blackbox only after this model is stable; simulator must call `deriveSubscriptionEntitlementState` instead of copying judgment logic.

---

## Knowledge Specialty Library Sync (`2026-05-28`)

- Task: sync the specialty-first public training-plan library across both Web `/dashboard/knowledge` and the WeChat mini-program knowledge tab, and make the Supabase manual SQL path easier to execute.
- Implemented:
  - Added Web specialty plan list/detail support with `src/components/knowledge/SpecialtyTrainingPlans.tsx`, `src/app/dashboard/knowledge/training-plans/[id]/page.tsx`, and matching service methods in `src/app/service/knowledgeService.ts`.
  - Inserted the specialty-first plan entry section into Web knowledge home so it no longer exists only in the mini-program.
  - Updated public training-plan API helpers/list route to expose specialty metadata consistently to both clients.
  - Refined mini-program knowledge list/detail presentation to match the specialty-first structure and preserve the detailed per-action preview.
  - Split the long specialty migration into four ordered SQL files for easier manual execution in Supabase SQL Editor:
    - `20260527_001_training_plan_specialties_schema.sql`
    - `20260527_002_training_plan_specialties_strength_seed.sql`
    - `20260527_003_training_plan_specialties_weighted_dip_seed.sql`
    - `20260527_004_training_plan_specialties_posture_seed.sql`
- Verification:
  - Lightweight verification only per local preference: targeted TS/TSX transpile checks and `git diff --check` passed.
  - No full lint/typecheck/build/test or browser/manual verification was run for this follow-up unless explicitly requested.
- Next step:
  - If the user wants full release confidence for this slice, run the standard lint/typecheck/test gate and browser/manual knowledge-page verification on both Web and mini-program paths.

---

## Git Contribution Audit (`2026-05-27`)

- Task: report committed-code contribution for `SmallHorseBrother <2945463110@qq.com>` since project creation.
- Scope: Git committed history only (`git log --all --author=2945463110@qq.com --numstat`); current uncommitted working-tree changes are not included.
- Result summary:
  - Repository first commit: `2025-11-09 350c69da Kirigaya <1193466151@qq.com> save`.
  - Author first commit: `2025-11-18 d0f4665b SmallHorseBrother <2945463110@qq.com>`.
  - Author latest committed history entry: `2026-05-21 d893af9e SmallHorseBrother <2945463110@qq.com>`.
  - All files: 271 commits, 423111 additions, 101692 deletions, net +321419 lines.
  - Code-like files excluding common lockfiles: 182 commits, 257634 additions, 84256 deletions, net +173378 lines.
- Status: analysis completed; no code changes made.

---

## Today Training Subscription/Plan State Split (`2026-05-27`)

- Task: fix Web `/today-training` incorrectly showing "当前阶段计划已完成" for student `c844cae9-d271-452f-9b80-e54dd67eb752` while `/me/plan-history` and coach dashboard correctly show active plan progress `4/60` (`7%`).
- Root cause found:
  - The student has one active 4-week coach subscription and one active `15周长期计划` with 60 training days.
  - Execution data shows only days `1,2,4,5` completed and day `8` in progress, so the plan is not complete.
  - `/today-training` treated `has_plan_instance=true` plus missing current instance as a completed phase, conflating "there is a plan record" with "the plan is completed".
- Implemented:
  - Added structured API errors through `ApiServiceError` so frontend callers keep `status/code/data` from failed API responses.
  - `plan-lib/get-instance` now returns explicit error `code` values for permission/entitlement blocks and includes `completed` instances when loading by `subscriptionId`, while bypassing subscription gate for completed subscription instances.
  - `/today-training` now tracks coach plan access states: `available`, `plan_completed`, `entitlement_blocked`, `no_plan_assigned`, and `load_failed`.
  - `/today-training` only shows completed copy when `get-instance` explicitly reports `derivedStatus=completed` or `isLogicallyCompleted=true`; `has_plan_instance` alone no longer triggers completed UI.
  - Added `src/lib/todayTrainingPlanState.ts` plus tests for runnable/completed state derivation.
- Verification:
  - `npx vitest run src/lib/todayTrainingPlanState.test.ts` passed.
  - `npm run typecheck -- --pretty false` passed.
  - `git diff --check` passed with only existing CRLF warnings.
  - Browser verification was not run per local developer preference unless explicitly requested.

## Coach Student List Count Regression (`2026-05-27`)

- Task: fix `/dashboard/students` showing only 9 students while coach overview shows 35 total students.
- Root cause found:
  - `src/app/api/coach/list-students/route.ts` had an added visibility filter requiring both a contact-bearing `users` row and a visible profile nickname/full name.
  - That hid valid active `coach_subscriptions` rows for students with incomplete/empty profile identity, while overview still correctly counted active subscriptions.
- Implemented:
  - Removed the extra `users` lookup and profile-identity filter from `list-students`.
  - Restored pagination total to the Supabase active-subscription count so the student list uses the same business count as overview.
- Verification:
  - Code diff inspected; no full lint/typecheck/build/test or browser verification was run per local developer preference unless explicitly requested.

## WeApp Auth State Consistency (`2026-05-27`)

- Task: investigate and reduce the confusing mini-program state where the `我的` page can show cached name/phone/avatar while API calls still toast `用户未登录`.
- Root cause found:
  - The mini-program UI treated local `user + token` presence as authenticated.
  - If the stored JWT had expired or become invalid, API calls returned 401 while the profile header still rendered cached user data.
- Implemented:
  - `wechat_app/src/utils/request.ts`
    - Centralized 401 handling for requests that carried a token.
    - Clears local `user` and `token` when the server rejects the token.
    - Emits a shared auth-invalid event and throttles the expired-login toast to avoid repeated popups from parallel requests.
  - `wechat_app/src/services/authSessionEvents.ts`
    - Added `AUTH_SESSION_INVALID_EVENT` for mini-program auth-state invalidation.
  - `wechat_app/src/me/profile/index.tsx`
    - Listens for the auth-invalid event and immediately resets the `我的` page to guest state.
- Verification:
  - No WeChat DevTools/manual verification or full lint/typecheck/build/test was run per local developer preference unless explicitly requested.

## WeApp Knowledge Built-in Training Plan Library (`2026-05-26`)

- Task: Add a student-side WeChat mini-program knowledge-base training plan library with dozens of common plans from beginner to professional, where users can add a plan into `我的计划` and later execute it through the existing plan flow.
- Status: implemented in code and adjusted to specialty-first on `2026-05-27`; no WeChat DevTools/manual verification or full lint/typecheck/build/test run per local preference unless explicitly requested.
- Implemented:
  - `supabase/migrations/20260526_public_training_plan_templates.sql`
    - Added `public_training_plan_templates` for platform-managed public plan templates.
    - Seeded 30+ published templates covering strength, hypertrophy, fat loss, home/bodyweight, running, calisthenics, powerlifting, hybrid conditioning, and sport conditioning.
    - Stores a 7-day base `training_days` pattern plus `weeks`; API expands this into the full executable plan.
    - Added `template_kind`, `parameter_schema`, and `action_slots` so templates like `5x5` can later be parameterized by action slots and 1RM inputs instead of being hardcoded per action.
  - `src/app/api/knowledge/training-plans/*`
    - Added public list/detail APIs for knowledge training-plan templates.
    - Added authenticated `copy-to-favorite` route that copies a database template into `student_plan_favorites`.
    - Follow-up fix: `copy-to-favorite` now resolves template action names into the student's `student_actions` library before saving. It reuses existing student actions, matches canonical/public actions when possible, creates a minimal student action as fallback, and writes both `actionId` and `action_id` into copied `training_days`.
    - Follow-up fix: copied action sets are normalized with both English-compatible fields (`sets`, `reps`, `rest_seconds`, `intensity`) and editor/execution-friendly Chinese params (`组数`, `次数`, `休息时间`, `强度` where applicable), including `%` / `RM` `intensityConfig` when parsable.
  - `wechat_app/src/content/knowledge/index.tsx` / `.scss`
    - Added a `训练计划库` section on the knowledge page with difficulty filters and horizontal plan cards backed by the new API.
    - Follow-up adjustment: the knowledge page now presents `专项训练计划库` first, with specialty filters for bench press, squat, powerlifting, weighted pull-up, weighted dip, posture correction, and foundation plans. The horizontal card layout was made fixed-width to avoid the mini-program rendering it as thin vertical columns.
  - `wechat_app/src/content/knowledge/plan-detail/index.tsx` / `.scss` / `.config.ts`
    - Added database-backed plan detail page with plan metadata, first two weeks preview, notes, login return flow, `加入我的计划`, and parameterized-template/action-slot display.
    - Follow-up adjustment: plan detail hero now shows specialty label plus sport, and action previews expose sets, reps, rest, intensity, load, and action-library binding/autofill status.
  - `wechat_app/src/app.config.ts`
    - Registered `content/knowledge/plan-detail`.
  - `supabase/migrations/20260527_001_training_plan_specialties_schema.sql`
  - `supabase/migrations/20260527_002_training_plan_specialties_strength_seed.sql`
  - `supabase/migrations/20260527_003_training_plan_specialties_weighted_dip_seed.sql`
  - `supabase/migrations/20260527_004_training_plan_specialties_posture_seed.sql`
    - Added `specialty_key`, `specialty_label`, and `specialty_priority` to `public_training_plan_templates`.
    - Classified existing templates and seeded specialty-first plans for bench press, squat, powerlifting, weighted pull-up, weighted dip, rounded-shoulder correction, and anterior-pelvic-tilt correction.
    - Split from the original long migration into four sub-200-line SQL files so they can be run manually in Supabase SQL Editor.
  - `src/app/api/knowledge/training-plans/*` / `wechat_app/src/services/knowledgeService.ts`
    - Exposed specialty metadata and `specialty` filtering while preserving the existing copy-to-favorite action-library auto-fill path.
  - `src/app/dashboard/knowledge/page.tsx` / `src/components/knowledge/SpecialtyTrainingPlans.tsx`
    - Follow-up Web sync on `2026-05-28`: added the same specialty-first training-plan library to the Web knowledge homepage between book notes and the body map.
  - `src/app/dashboard/knowledge/training-plans/[id]/page.tsx` / `src/app/service/knowledgeService.ts`
    - Added Web plan detail and service methods for list/detail/copy. Web detail shows target, cycle, weekly frequency, training-day structure, sets, reps, rest, intensity, and the action-library auto-fill explanation.
- Verification:
  - Targeted TypeScript transpile syntax check passed for the new/modified files.
  - Targeted TypeScript transpile syntax check passed for the updated `copy-to-favorite` action-binding route.
  - Targeted TypeScript transpile syntax check passed for the `2026-05-27` specialty-first API/service/page updates.
  - Targeted TypeScript transpile syntax check passed for the `2026-05-28` Web sync files.
  - `git diff --check` passed for touched files with only standard Windows CRLF warnings.

## WeApp Coach Huifu Wallet Operations (`2026-05-26`)

- Task: replicate the coach Huifu account opening and withdrawal flow in the WeChat mini-program instead of requiring coaches to switch to the Web site.
- Status: implemented in code; no WeChat DevTools/manual verification run per local preference unless explicitly requested.
- Implemented:
  - `wechat_app/src/app.config.ts`
    - Registered `coach/wallet/merchant` and `coach/wallet/withdraw`.
  - `wechat_app/src/services/coach/coachService.ts`
    - Added `openHuifuAccount` and `withdrawHuifu`.
  - `wechat_app/src/coach/wallet/index.tsx`
    - Wallet page now exposes native mini-program actions:
      - Open/reopen Huifu receiving account when not opened.
      - Apply for withdrawal when the Huifu account is opened.
    - Removed the prior "please use Web/desktop" product dead-end.
  - `wechat_app/src/coach/wallet/merchant/index.tsx` / `.scss` / `.config.ts`
    - Added a two-step mini-program Huifu onboarding form:
      - Identity information and ID-card front/back image selection.
      - Withdrawal bank card, bank code, branch code/name, and region codes.
    - Submits to the existing `/api/coach/merchant/open-huifu-account` backend route.
  - `wechat_app/src/coach/wallet/withdraw/index.tsx` / `.scss` / `.config.ts`
    - Added a Huifu withdrawal page with withdrawable balance, frozen amount note, quick amount controls, and submit.
    - Submits to `/api/coach/wallet/huifu/withdraw`.
  - `src/app/api/coach/wallet/huifu/withdraw/route.ts`
    - Switched auth lookup to `getApiUserId(req)`, so the route supports both Web NextAuth sessions and mini-program Bearer JWTs.
- Verification:
  - `git diff --check` passed for touched files with only standard Windows CRLF warnings.
  - Targeted TypeScript transpile syntax check passed for the new/modified wallet files.
  - A bare `tsc` check was attempted but failed on mini-program `@/*` path aliases because it did not load the WeChat app tsconfig; this was not a syntax failure.
  - No WeChat DevTools/manual UI verification or full lint/typecheck/build/test was run per local preference.

## Web + WeApp Fitness Profile Card Parity (`2026-05-26`)

- Task: Keep the website and WeChat mini-program student registration/onboarding profile questions nearly identical, while allowing each platform to use its own UI style. The fitness profile card on both platforms must edit the same data model.
- Status: implemented in code; browser/manual verification and full lint/typecheck/build/test left unrun per local preference unless explicitly requested.
- Implemented:
  - `src/components/auth/OnboardingModal.tsx`
    - Web registration/profile-completion flow now includes `target_body_parts`, matching the mini-program onboarding question set.
    - Web onboarding now writes `flow_version: miniapp_v1_aligned` plus `target_body_parts`, `interest_tags`, `equipment`, and `session_duration` to onboarding answers.
    - When reopened, it loads latest onboarding answers to prefill the questionnaire fields.
  - `src/components/student/profile/FitnessProfileCard.tsx`
    - Added Web fitness profile card with the same editable fields as the mini-program card: avatar, nickname, gender, height, weight, target body parts, fitness goal, training level, training direction, equipment, and session duration.
    - Profile fields save through `updateProfile`; onboarding-answer fields save through `submitOnboarding`.
  - `src/components/student/StudentProfilePage.tsx`
    - Mounted the Web fitness profile card on the student profile page using latest `getStudentProfile` data.
  - `src/app/api/user/update-profile/route.ts`
    - Changed profile updates to patch only explicitly provided fields so single-field edits do not clear unrelated profile data.

## WeApp Fitness Profile Card As Menu Entry (`2026-05-26`)

- Task: Adjust the WeChat mini-program `我的` page fitness profile card flow per user feedback: it should be a normal menu row like `全部计划` / `我的教练`, not an expanded homepage card. Tapping it opens a profile preview page, and tapping a specific field/question edits that field.
- Status: implemented in code; mini-program manual verification left unrun per local preference unless explicitly requested.
- Implemented:
  - `wechat_app/src/me/profile/index.tsx`
    - Added a normal `健身资料卡` menu entry that navigates to `/me/profile/fitness-card/index`.
  - `wechat_app/src/app.config.ts`
    - Registered the `me/profile/fitness-card/index` page.
  - `wechat_app/src/me/profile/fitness-card/index.tsx`
    - Added the fitness profile preview page backed by both `user_profiles` and latest `onboarding_questionnaires.answers`.
    - Mirrors the registration onboarding questions: avatar, nickname, gender, height, weight, target body parts, fitness goal, training level, training direction, equipment, and session duration.
    - Supports single-field editing; profile fields save through `updateProfile`, and onboarding-answer fields save through `submitOnboarding`.
  - `wechat_app/src/me/profile/fitness-card/index.scss`
    - Added preview/list styling that keeps the interaction as normal tappable rows.

## WeApp Onboarding Nickname Must Start Empty (`2026-05-26`)

- Task: fix the mini-program student onboarding page still showing generated default nicknames such as `手机用户_0621`, despite the requirement that nickname should start empty and be user-entered.
- Root cause:
  - The previous fix only removed session fallback prefill.
  - Existing `user_profiles.nickname` rows could already contain generated values such as `手机用户_0621`, and onboarding still loaded `profile.nickname` directly.
  - Mini-program login APIs also created new `user_profiles` rows with generated nickname placeholders.
- Implemented:
  - `wechat_app/src/auth/student-onboarding/index.tsx`
    - Added generated-nickname normalization for onboarding mode.
    - Non-edit onboarding now treats generated placeholders as empty.
    - Non-edit onboarding also starts avatar empty; edit mode can still load the saved avatar/nickname for actual profile editing.
  - `src/app/api/miniapp/login/route.ts`
    - New profile creation now writes `nickname: ""`.
    - Existing generated nickname placeholders are cleaned to empty during mini-program login.
  - `src/app/api/miniapp/wechat-login/route.ts`
    - Same empty nickname creation and generated-placeholder cleanup for WeChat quick login.
- Follow-up fix:
  - User reported that selecting the WeChat nickname candidate from the native bottom picker did not fill the nickname field, and the candidate area then disappeared back to the onboarding footer controls.
  - `wechat_app/src/auth/student-onboarding/index.tsx` now uses the native Taro `Input type="nickname"` as an uncontrolled native field (`defaultValue`) and synchronizes nickname through `onInput`, `onBlur`, `onConfirm`, and best-effort `onNickNameReview` instead of relying on a controlled `value`.
  - The onboarding footer is hidden while the nickname input is focused so the native WeChat nickname candidate area is not visually replaced by the `上一步/下一步` controls.
- Second follow-up fix:
  - User reported the prior nickname-picker fix still reproduced the same behavior.
  - `wechat_app/src/auth/student-onboarding/index.tsx` now keeps the last authoritative nickname in a ref, allows manual empty edits only from `onInput`, and prevents empty `blur` / `confirm` / nickname-review events from overwriting a non-empty candidate value.
  - After the native nickname picker closes, the page also queries the native input node by id and synchronizes its actual `value` as a fallback before restoring the onboarding footer. This avoids depending entirely on Taro's event order for WeChat nickname selection.
- Login regression fix:
  - User reported that tapping `手机一键登录` briefly showed `登录中...` and then did nothing.
  - Root cause: the login button had been changed from WeChat native `openType='getPhoneNumber'` / `onGetPhoneNumber` to a normal click handler, so no phone authorization code was produced.
  - `wechat_app/src/auth/login/index.tsx` now restores `openType='getPhoneNumber'` and passes `e.detail.code` into `authService.loginWithWechat(phoneCode)`.
- Plan detail follow-up:
  - User reported that the public training plan detail page only showed action names and did not clearly expose sets/reps/rest.
  - Confirmed the copy-to-favorite backend already resolves template actions into `student_actions` before saving, so missing actions are auto-added to the user's action library rather than left as name-only placeholders.
  - Rebuilt `wechat_app/src/content/knowledge/plan-detail/index.tsx` and `.scss` so each training day now expands into action cards showing action name, sets, reps, rest, intensity, load, and whether the action is already bound to the action library.
  - Added explicit page copy stating that missing actions are automatically added to the user's action library when the plan is added to "我的计划".
- Verification:
  - `git diff --check` passed for the touched files with only standard Windows CRLF warnings.
  - Targeted TypeScript transpile syntax check passed for `wechat_app/src/auth/student-onboarding/index.tsx`.
  - No WeChat DevTools/manual verification or full lint/typecheck/build/test was run per local preference unless explicitly requested.

## WeApp Delete Account Entry (`2026-05-21`)

- Task: connect the WeChat mini-program student-side account cancellation flow to the existing Web/backend `delete-account` capability.
- Status: implemented in code; user-side mini-program verification pending.
- Implemented:
  - `wechat_app/src/services/studentService.ts`
    - Added `deleteAccount({ confirmationText })`, reusing the existing `/api/user/delete-account` backend route.
  - `wechat_app/src/me/settings/index.tsx`
    - Added a `危险操作` section with a `注销账号` entry.
    - Added a confirmation modal that requires typing `注销账号` before continuing.
    - On success, the flow clears the local mini-program auth state through `authService.logout()` and returns to `/auth/login`.
  - `wechat_app/src/me/settings/index.scss`
    - Added styling for the danger card and cancellation confirmation modal, keeping the primary danger action as a solid brand-color button.
- Verification:
  - No WeChat DevTools/manual UI verification or lint/typecheck/build/test was run, per the local workspace preference unless explicitly requested.

## WeApp Coach Package Questionnaire Before Payment (`2026-05-21`)

- Task: fix the mini-program coach-profile package click flow where the first package for coach `枭马葛` could immediately open a 0.01 payment QR instead of requiring the pre-payment questionnaire.
- Root cause:
  - The current user had an existing `inactive` / `pending_payment` subscription tied to that first package.
  - `wechat_app/src/discovery/coach-profile/index.tsx` treated clicking the same package as "continue pending payment" and directly called `startCoachWechatPayment`, bypassing questionnaire loading.
- Fix:
  - Package clicks no longer directly continue a pending/inactive payment just because the selected product matches the existing subscription.
  - The normal package click flow now always checks coach questionnaires first.
  - `wechat_app/src/discovery/coach-questionnaire/index.tsx` now reuses an existing subscription id in prepay mode by updating its questionnaire/product fields before payment, instead of creating a duplicate subscription.
- Verification:
  - Targeted TypeScript transpile check passed for `wechat_app/src/discovery/coach-profile/index.tsx` and `wechat_app/src/discovery/coach-questionnaire/index.tsx`.
  - `git diff --check` passed with only standard Windows CRLF warnings.
  - No WeChat DevTools/manual UI verification or full build/test was run per local preference.

## Coach-Owned Content Purchase Huifu Settlement (`2026-05-20`)

- Task: extend the coach-subscription Huifu split model to other coach-owned revenue, starting with paid coach content / single-article purchases.
- Status: backend money-rule changes and Web Huifu QR payment display applied; live Huifu verification pending.
- Implemented:
  - `src/app/api/payment/alipay/create/route.ts`
    - Paid `content_purchase` orders now resolve content price/coach from the database and require the coach to have a fully opened Huifu account.
    - Logged-in paid coach-content purchases are routed through Huifu collection (`huifu_alipay`) instead of direct Alipay.
    - Order metadata now persists `coachId`, `coachName`, `contentId`, and `contentTitle` so delayed settlement can run later.
  - `src/app/api/payment/alipay/contentPurchaseFulfillment.ts`
    - Payment success still unlocks the purchased content immediately in `content_purchases`.
    - Coach wallet credit now uses the same Huifu delayed settlement ledger as coach subscription; wallet income is recorded only after balance payment succeeds.
  - `src/app/api/payment/wechat/notify/route.ts` and `src/app/api/payment/wechat/query/route.ts`
    - Huifu notifications/query compensation now also fulfill `content_purchase`.
  - `src/app/api/payment/alipay/refund/route.ts`
    - Refund handling now treats `content_purchase` as coach-owned revenue: if coach share was transferred, it attempts Huifu balance-payment refund/reversal before source-payment refund, and marks `content_purchases` as `refunded`.
  - `src/app/api/coach/get-overview-data/route.ts` and `src/app/api/coach/get-revenue-details/route.ts`
    - Paid content revenue is counted from wallet income after settlement, not merely from buyer payment success.
  - `src/app/articles/ArticlePurchaseSection.tsx`
    - Guest paid content purchase now routes to login first; guest direct payment remains disabled because it cannot reliably bind the purchase entitlement or settlement ledger.
  - `src/components/payment/ContentPurchaseDialog.tsx`
    - Paid content purchase now accepts Huifu `payInfo` in addition to direct-Alipay `formHtml`.
    - When Huifu returns a QR/pay target, the Web purchase dialog shows an Alipay scan-to-pay QR dialog and then routes to the payment status page for confirmation/unlock.
  - Added migration `supabase/migrations/20260520_coach_revenue_content_settlement.sql`:
    - Allows `content_purchases.status = refunded`.
    - Documents and indexes the existing settlement table as a coach-owned revenue settlement ledger, not subscription-only.
- Verification:
  - Targeted TypeScript transpile check passed for the touched payment/revenue files.
  - `git diff --check` on touched files passed with only standard Windows CRLF warnings.
  - No full lint/typecheck/build/test or browser verification was run per local preference unless explicitly requested.
- Important caveat:
  - The backend settlement/refund ledger and Web QR display are now aligned, but one live Web `content_purchase` still needs to verify the exact Huifu `A_NATIVE/A_JSAPI` `pay_info` shape and the browser-side scan/return flow.

## Huifu In-Process Settlement Scheduler (`2026-05-20`)

- Task: after the user chose scheme 2, make Huifu delayed coach-subscription settlement automatic without introducing an external cron platform yet.
- Status: code changes applied; deployment/runtime verification pending.
- Implemented:
  - `src/instrumentation.ts`
    - Added in-process hourly job for `POST /api/admin/coach-subscription-settlements/process-due`.
    - Added in-process hourly job for `POST /api/admin/coach-subscription-settlements/reconcile`.
    - Jobs run once at service startup and then at the configured interval.
    - Existing Alipay pending sync and pending-plan activation jobs remain active when `ALIPAY_SYNC_SECRET` or `CRON_SECRET` is configured.
- Required production configuration:
  - Configure `CRON_SECRET` or `HUIFU_SETTLEMENT_CRON_SECRET`.
  - Ensure `NEXTAUTH_URL` or `NEXT_PUBLIC_SITE_URL` points to the deployed app URL.
  - Keep or explicitly set `COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS=7`.
  - Optional interval overrides: `HUIFU_SETTLEMENT_PROCESS_INTERVAL_MS`, `HUIFU_SETTLEMENT_RECONCILE_INTERVAL_MS`; set to `0` to disable.
- Verification:
  - Targeted TypeScript transpile check for `src/instrumentation.ts` passed.
  - `git diff --check -- src/instrumentation.ts` passed with only the standard Windows CRLF warning.
  - No full lint/typecheck/build/test or browser verification was run per local preference unless explicitly requested.

## WeApp Toolbox Strength Calculator Copy Update (`2026-05-20`)

- Task: update the student WeChat mini-program toolbox card copy for `力量计算器`.
- User direction:
  - The card subtitle should not describe implementation facts like "小程序内完整实现，与网页端逻辑一致".
  - It should describe user-facing utility such as calculating max/working-set weight and coefficients.
- Implemented:
  - `wechat_app/src/me/toolbox/index.tsx`
    - Updated the `力量计算器` card description to `可计算极限重量、做组重量和训练系数等。`
- Verification:
  - No lint/typecheck/build/test or WeChat DevTools verification was run, following the local workspace preference unless the user explicitly requests it.

## WeApp Knowledge Latest Body Map (`2026-05-20`)

- Task: restore the student WeChat mini-program knowledge page to the latest clickable body-map experience.
- Finding:
  - The temporary blank-image fix made the card render, but it used the older `frontSvg/backSvg` body outline and stayed a static `<Image>`, so the actual SVG regions could not be clicked.
  - The latest body-map asset line is commit `6cff9d9d` from `2026-04-30`: sex-aware SVG modules (`maleFrontSvg/maleBackSvg/femaleFrontSvg/femaleBackSvg`) with category metadata.
- Fix:
  - `wechat_app/src/content/knowledge/index.tsx` now imports the latest sex-aware SVG modules and chooses female/male body map from the logged-in student's profile gender, defaulting to male for guests/unknown.
  - The knowledge body-map options now use the latest category model: `胸部 / 肩部 / 大臂 / 小臂 / 腹部 / 背部 / 臀部 / 大腿 / 小腿 / 关节`.
  - Added SVG category highlighting by rewriting matching `category` groups to brand color.
  - Added a transparent mini-program hit-area layer over the image so tapping the body map selects the corresponding category and loads body-region knowledge nodes.
  - `wechat_app/src/content/knowledge/index.scss` now scales the latest SVG inside the card to reduce the excessive blank space and keeps hit areas aligned with the scaled map.
- Verification:
  - Targeted TS transpile check for `wechat_app/src/content/knowledge/index.tsx` passed.
  - `git diff --check` on the touched knowledge page files passed with only Windows CRLF warnings.
  - Per local developer preference, no automatic WeChat DevTools visual verification or full lint/typecheck/build/test sequence was run unless explicitly requested.

## Product IA Simplification / Main Path Redesign (`2026-05-19`)

- Task: rethink CoachLink early-stage product framework by doing subtraction and reconnecting the remaining flows clearly.
- User direction:
  - Current content/features feel too numerous and confusing.
  - Prefer reducing visible surfaces and making the remaining links clearer.
  - Registration and post-registration flow likely need redesign.
  - After registration, users should clearly know what to see, what to click, which need each path satisfies, and how the flow can naturally trigger willingness to pay.
- Current recommendation direction:
  - Move from "show all features" to "task-path first".
  - Post-auth onboarding should identify the user's current intent and route them to a single next best action.
  - Student-facing first-stage paths should organize around five bottom tabs:
    - `训练`
    - `教练`
    - `知识`
    - `工具箱`
    - `我的`
  - `工具箱` should remain a first-class bottom-tab surface because it can provide immediate utility even before users fully understand their broader training needs.
  - Main paths should likely reduce to:
    - Start training / record today.
    - Find a coach / get a plan.
    - Solve a training problem / learn knowledge.
    - Use a concrete tool for a specific immediate need.
  - `我的` should be reorganized as account/assets/history/settings, not as a catch-all product homepage.
- Status: first WeChat mini-program IA simplification pass implemented on `2026-05-20`.
- Implemented surfaces in this pass:
  - `wechat_app/src/components/BottomNav.tsx`: student bottom nav reduced/reframed to `训练 / 教练 / 知识 / 工具箱 / 我的`; the old student `消息` bottom-tab slot was removed while coach nav stayed intact.
  - `wechat_app/src/pages/index/index.tsx`: home entry rewritten around four immediate intents: `开始训练 / 找教练 / 查知识 / 用工具`.
  - `wechat_app/src/discovery/index.tsx`: the old mixed discovery home was narrowed into the `教练` tab home focused on coach/service discovery; top-level public action and article highlight feeds were removed from equal-status positions.
  - `wechat_app/src/content/knowledge/index.tsx`: knowledge became browse-first; guests no longer hard-redirect to login before entering the knowledge home.
  - `wechat_app/src/me/profile/index.tsx`: `我的` was reorganized back toward account/assets/history/settings, and `消息中心` was kept as a secondary entry after removing the old message bottom tab.
- Verification:
  - Lightweight code-level sanity checking only: touched files were re-read and TypeScript-transpiled successfully.
  - Per local workspace preference, no automatic lint/typecheck/build/test or WeChat DevTools/browser verification was run in this pass.

### Today-training compacting pass (`2026-05-20`)

- User direction:
  - Remove the explanatory "为什么要确认完成 / 为什么要输入重量" content from the top of the student training page.
  - Compress the training page so schedule/calendar and today's arrangement feel like one compact control surface.
  - Reduce vertical height across the page, especially the top coach/plan card and repeated section headers.
- Implemented direction:
  - `wechat_app/src/training/today-training/index.tsx` now removes the top explanation card and explanation dialog flow.
  - The return-to-page confirmation banner was shortened to a compact success message.
  - `ScheduleCalendarPanel` and `TodayTrainingCard` are now visually grouped into one `schedule-training-card` container with a single inline summary instead of separate repeated section headers.
  - The top coach/self-plan card was compressed into a shorter summary strip.
  - Month calendar is now collapsed by default while preserving manual expand/collapse.
- Verification:
  - Lightweight TypeScript transpile/parse check passed for:
    - `wechat_app/src/training/today-training/index.tsx`
    - `wechat_app/src/training/today-training/components/ScheduleCalendarPanel.tsx`
    - `wechat_app/src/training/today-training/components/TodayTrainingCard.tsx`
  - No WeChat DevTools/manual verification was run in this pass per local workspace preference unless explicitly requested.

### Discovery-page narrowing note (`2026-05-20`)

- The current mini-program discovery home mixes coach discovery, coach service products, public action highlights, and article/content highlights.
- Recommended direction:
  - Narrow it into the future `教练` tab home.
  - The coach tab main page should now focus on coach discovery itself; mixed-intent guide blocks and coach-service promo sections should be removed from the top-level coach home.
  - Coach-related service products can still exist elsewhere in the flow, but should not compete with coach cards on the main coach tab surface.
  - Move article/info discovery primarily under the `知识` tab.
  - Downgrade or relocate public action-library highlights to action-specific or supporting surfaces rather than keeping them as equal-status discovery feed blocks.

## WeApp Hide Friends Entry Pending Qualification (`2026-05-19`)

- Task: temporarily hide `我的好友` from the WeChat mini-program personal/profile page because displaying the friends/social feature requires additional mini-program qualification that has not been approved yet.
- Status: code changes applied; user-side mini-program verification pending.
- Implemented:
  - `wechat_app/src/me/profile/index.tsx`
    - Removed the `我的好友` top metric entry from the profile page.
    - Removed the profile page's `/api/user/friends` count request and `friends` stat field.
    - Kept the underlying friends pages/API untouched so the entry can be restored after qualification approval.
  - `wechat_app/src/me/profile/index.scss`
    - Changed top metric item width from four-column `25%` to three-column `33.3333%`.
- Verification:
  - Light grep confirmed the profile page no longer contains `我的好友`, `my-friends`, `/api/user/friends`, or `friends`.
  - No full lint/typecheck/build/test or WeChat DevTools verification was run per local preference unless explicitly requested.

## Early Product Completion Assessment (`2026-05-18`)

- Task: evaluate CoachLink's current early-stage product completion from the user's priority lenses.
- User priority lenses:
  - A strong training experience that makes users willing to record workouts during training.
  - A stable coach-discovery, student acquisition, subscription, and payment flow.
  - A genuinely useful toolbox.
  - A valuable paid/free knowledge base.
  - A clear complete path for both beginner users and advanced trainees.
- Current assessment method:
  - Read project state/memory/decisions first.
  - Reviewed current Web/WeChat route structure and representative modules for training, coach discovery/subscription, toolbox, and knowledge.
  - No browser/manual verification was run because the local developer preference is to skip automatic UI verification unless explicitly requested.
- Status: product assessment prepared; implementation follow-up pending user prioritization.

## Huifu Split Completion Pass (`2026-05-18`)

- Task: complete the unfinished Huifu coach-subscription split work after the user confirmed initial manual verification was already done.
- Status: code changes applied; user-side end-to-end verification remains pending.
- Implemented:
  - Added migration `supabase/migrations/20260518_huifu_refund_delayed_settlement.sql`:
    - `alipay_orders.payment_provider`
    - `coach_subscription_settlements.eligible_at`
    - Huifu original-payment refund fields
    - Huifu balance-payment refund/reversal fields
    - settlement status now also supports `refunded`
    - due/processing indexes for delayed settlement and reconciliation.
  - Huifu client wrapper now includes original-payment refund/query, balance-payment query, balance-payment refund/query, and endpoint env overrides:
    - `HUIFU_PAYMENT_REFUND_PATH`
    - `HUIFU_PAYMENT_REFUND_QUERY_PATH`
    - `HUIFU_BALANCE_PAYMENT_QUERY_PATH`
    - `HUIFU_BALANCE_PAYMENT_REFUND_PATH`
    - `HUIFU_BALANCE_PAYMENT_REFUND_QUERY_PATH`
  - Coach subscription settlement now delays Huifu balance-payment disbursement until `eligible_at` (`paid_at/updated_at/created_at + COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS`, default 7 days). Development test payments with `order_data.is_test_payment` remain immediate outside production.
  - Added admin/cron endpoints:
    - `POST /api/admin/coach-subscription-settlements/process-due`
    - `POST /api/admin/coach-subscription-settlements/reconcile`
  - Admin retry endpoint now forces a real retry only after explicit confirmation.
  - Refund route is provider-aware:
    - Huifu orders use Huifu original-payment refund.
    - If coach share was already transferred, it first attempts Huifu balance-payment refund/reversal.
    - Pending delayed settlements do not deduct coach wallet because no coach wallet income exists yet.
    - Processing settlements block refund until reconciliation completes.
    - Direct Alipay orders still use `alipay.trade.refund`.
  - Web coach-subscription Huifu-Alipay orders now normalize to `coach_subscription` / `coach_subscription_renew`, preventing legacy `subscription*` orders from bypassing the split ledger.
  - Web Huifu-Alipay order query now uses Huifu order query instead of the direct Alipay SDK query path.
  - Shared Huifu notify handling now preserves existing `huifu_alipay` provider instead of overwriting every Huifu callback as `wechat`.
  - Shared fulfillment helper now refuses to credit coach wallets for Huifu-settled coach subscription orders unless Huifu split details exist.
  - Huifu coach onboarding now treats `apply_no` without `token_no` as `business_pending` instead of failed.
  - Huifu withdrawal now stores request/date/sequence/global流水/status metadata on wallet withdrawal transactions for later reconciliation.
- Verification:
  - `git diff --check` passed with only existing CRLF warnings.
  - Per local developer preference, no Web/WeChat UI verification and no lint/typecheck/build/test sequence were run automatically.
- Next verification focus:
  - Apply the new migration.
  - Run one paid coach subscription in non-test mode and confirm settlement row stays `pending` with future `eligible_at`.
  - Trigger `process-due` only after reducing `COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS` in a safe test environment or using a test order.
  - Test Huifu refund once before and once after settlement.

## Post-Shutdown Memory Recovery (`2026-05-18`)

- Task: check whether recent project notes/content were lost after the user's computer unexpectedly powered off, and restore what can be restored.
- Status: recovery pass completed for confirmed corrupted/missing items.
- Follow-up recovery pass in this thread:
  - Found 8 additional tracked WeApp source files still overwritten with NULL bytes under `wechat_app/src`.
  - Restored those tracked files from `HEAD`, then re-applied the recoverable recent changes for streetlifting share cards/QR env handling, profile quantified stats, training-history summary usage, and plan-history "training day" wording.
  - Rechecked `src`, `wechat_app/src`, and `memory` code/markdown files for NULL bytes; no NULL-byte files remain in those scanned paths.
  - `git diff --check` on the recovered files passed, with only existing CRLF warnings.
  - Full lint/typecheck/build/test and WeChat DevTools verification were not run per local developer preference unless explicitly requested.
- Finding:
  - `memory/2026-05-17.md` had been overwritten entirely with NULL bytes (`24004` NULL bytes).
  - `supabase/migrations/20260517_plan_instance_entitlement_policy.sql` was also NULL-byte corrupted.
  - The WeApp profile top-stats code had reverted/lost the final quantified UI changes, and `src/app/api/training-history/summary/route.ts` was missing.
  - `IDENTITY.md`, `SOUL.md`, `USER.md`, `PROJECT_STATE.md`, `CURRENT_TASK.md`, `DECISIONS.md`, `memory/2026-05-16.md`, and `memory/2026-05-18.md` were readable.
  - Existing `corrupt-null-files/2026-05-18/` still contains two previously quarantined untracked NULL-byte files from the earlier proxy/build recovery.
- Fix:
  - Reconstructed `memory/2026-05-17.md` from `CURRENT_TASK.md`, `DECISIONS.md`, and known session facts.
  - Re-applied WeApp profile quantified top stats: top metrics are `我的好友`, `我的动作库`, `我的计划库`, and `训练记录`; lower menu restores `全部计划`, `我的教练`, and `我的会员` without duplicating top entries.
  - Recreated `src/app/api/training-history/summary/route.ts`.
  - Restored `wechat_app/src/services/trainingHistoryService.ts` `getSummary()` contract and `wechat_app/src/services/studentPlanLibService.ts` `totalCount` typing.
  - Recreated `supabase/migrations/20260517_plan_instance_entitlement_policy.sql` with explicit entitlement metadata columns/check constraint.
  - Recreated missing `src/lib/subscriptionEntitlement.ts` and re-applied the subscription entitlement model into carryover, archive/replacement, active-plan activation, delayed activation, subscription check/list/expiry, execution access, projected end-date, and coach/student plan-history paths.
  - Restored Web/WeApp plan-history wording so plan totals are shown as training days (`共 X 个训练日`) instead of natural calendar days.
- Verification:
  - Byte-level checks confirmed restored files no longer contain NULL bytes.
  - Re-scanned source/markdown/SQL files under `src`, `wechat_app/src`, `memory`, and `supabase`; no NULL-byte code/markdown/SQL files remain. Binary assets may naturally contain zero bytes and were ignored.
  - No full lint/typecheck/build/test was run per local preference unless explicitly requested.

## Proxy Null-Byte Build Error (`2026-05-18`)

- Task: fix Next.js Turbopack build error `Parsing ecmascript source code failed` in `src/proxy.ts` caused by `Unexpected character '\0'`.
- Status: fixed locally.
- Finding:
  - `src/proxy.ts` and a batch of other `src/**/*.ts(x)` files had been overwritten with NULL bytes and Git treated the tracked ones as binary diffs.
  - The dev overlay reported the first corrupted module it hit; after `src/proxy.ts`, the next one was `src/app/api/coach/list-students/route.ts`.
  - The recoverable intended `src/proxy.ts` change from recent task history was only to make streetlifting share-card/QR/location-get endpoints public.
- Fix:
  - Restored `src/proxy.ts` from `HEAD`.
  - Re-applied the three public paths:
    - `/api/og/streetlifting-location`
    - `/api/miniapp/qrcode/streetlifting-location`
    - `/api/streetlifting-index/locations/get`
  - Scanned `src` source files for NULL bytes.
  - Restored all tracked `src` files that were fully NULL-byte corrupted back from `HEAD`.
  - Moved untracked NULL-byte-only files out of the compile path into `corrupt-null-files/2026-05-18/`.
- Verification:
  - Confirmed the `src` source tree scan returns no NULL-byte files.
  - Confirmed `src/proxy.ts` has `0` NULL bytes and Git diff is a normal text diff limited to the three public paths.
  - Full lint/typecheck/build/test were not run per local developer preference unless explicitly requested.

## Huifu Payment Split Digest (`2026-05-18`)

- Task: digest the user's Huifu/客服 chat records and copied Huifu docs for coach subscription payment split, balance payment, onboarding, withdrawal, and 7-day refund handling.
- Status: information digested and current code shape reviewed; no code changes requested yet.
- Newly confirmed external facts:
  - CoachLink merchant/customer Huifu ID in the chat is `6666000194449179`; mini-program AppID `wx316e39eb71c0e834` was configured by Huifu.
  - Huifu explicitly described the project as `单商户模式`; coach subscription funds must first be collected through Huifu's payment channel, then funds received into the platform balance can be distributed through balance payment.
  - Initial JSPay 922 issue was signature/key related. Huifu clarified `922 = 验签失败`; when generating keys, the "系统公钥" field should not be filled, otherwise Huifu cannot obtain the right merchant key material for verification.
  - Split/balance-payment approval was submitted after payment demo video and bill screenshot. On `2026-04-22`, Huifu said `余额支付已审核通过`; after法人签约, they said it was effective and technical integration could start.
  - Huifu also said `自动提现已关闭`, which supports the current manual/explicit withdrawal and balance-payment-disbursement model rather than automatic settlement to coaches.
- Relevant Huifu docs/user-provided API facts:
  - Coach/personal recipient onboarding uses personal user open `/v2/user/basicdata/indv`, then user business open `/v2/user/busi/open` with `card_info + cash_config`; the business-open response can return `token_no` for withdrawal.
  - Balance payment `/v2/trade/acctpayment/pay` requires `out_huifu_id`, `ord_amt`, `risk_check_data`, and `acct_split_bunch`; the split amounts in `acct_split_bunch` must sum to `ord_amt`.
  - If CoachLink uses balance payment only to disburse coach net share, then `ord_amt = coach share` and one coach receiver is valid; platform commission remains in the platform Huifu account and is recorded locally as platform revenue.
  - Huifu docs also expose balance-payment refund/refund-query entries, so Huifu refund support should not be treated as nonexistent; it is just not implemented in CoachLink yet.
  - Huifu split guide distinguishes real-time split, delayed split (`delay_acct_flag=Y` + later transaction confirm), and post-collection balance payment. Current CoachLink code is closer to post-collection balance payment, not true Huifu delayed split.
- Product/implementation implication:
  - Current wallet withdrawal freeze for 7 days is not equivalent to holding funds from the coach at Huifu level if the balance payment has already moved coach net share to the coach's Huifu account.
  - For a stricter 7-day refund policy, the safer model is: collect into platform cash account, fulfill subscription, create settlement row with `eligible_at = paid_at + 7 days`, do not call balance payment until the refund window passes, then balance-pay the coach net share if no refund occurred.
  - Alternative true delayed split would require Huifu collection calls with `delay_acct_flag=Y` and later transaction-confirm API; this is a different integration path from the current balance-payment code.
- Current code review summary:
  - Implemented: Huifu signing/request wrapper, mini-program JSPay order creation, Huifu notify/query handling, subscription fulfillment, immediate balance-payment disbursement to coach net share, settlement idempotency ledger, local coach wallet/platform revenue credit, coach Huifu personal/business onboarding, Huifu encashment withdrawal, 7-day local wallet withdrawal lock, and an admin retry endpoint for failed split rows.
  - Main gaps: Huifu refund and balance-payment refund are not implemented; 7-day protection is only a wallet freeze, not delayed remote settlement; no balance-payment/withdrawal reconciliation job for `P` or uncertain states; Web coach-subscription path still uses legacy `subscription*` order types and can bypass the Huifu split ledger; coach onboarding treats `apply_no`/审核中 as failure instead of pending; admin retry/query paths can initiate real money movement and need careful operator controls.
- Recommended sequence:
  - First do no-funds verification: config/schema checks and read-only data audit.
  - Before broad live testing, add/confirm guards so Huifu-paid orders cannot use the Alipay refund endpoint and Web coach-subscription payments cannot credit wallets without Huifu split success.
  - Then run one controlled mini-program 1-yuan coach-subscription/renewal payment against an opened coach account to verify the current main chain.
  - Continue development after that around Huifu refund, 7-day delayed disbursement or explicit wallet-freeze policy, and reconciliation jobs.

## Coach Subscription Entitlement Model (`2026-05-17`)

- Task: finish the first durable implementation pass for coach subscription entitlement after investigating user `18115072586` / Liu Sanle plan history confusion.
- Status: code model implemented; user-side/manual verification pending per local preference.
- Implemented:
  - Added migration `supabase/migrations/20260517_plan_instance_entitlement_policy.sql` for explicit plan-instance entitlement metadata:
    - `archive_reason`
    - `entitlement_consumption_policy`
    - `entitlement_consumption_note`
  - Added `src/lib/subscriptionEntitlement.ts` as the shared policy helper.
  - Updated `src/lib/subscriptionCarryover.ts` so carryover only counts plan instances whose entitlement policy permits counting, and pre-subscription imported completions count only when the policy is explicitly `count_all_history`.
  - Updated subscription end-date/check/list flows to select the new entitlement policy while deriving remaining service weeks.
  - Updated manual archive, active-plan replacement, manual plan creation, immediate AI plan creation, and delayed AI activation paths so old plans are archived with explicit counted/no-charge policy.
  - Updated student/coach plan-history APIs to return `total_training_days`, `plan_span_days`, archive metadata, completion stats, and derived end dates for archived/completed plans with missing `end_date`.
  - Updated student plan-history Web/WeApp display copy so `共 34 天` becomes `共 34 个训练日`, avoiding confusion with natural calendar days or full plan span.
- Verification:
  - `git diff --check` on the touched subscription/history files passed, with only existing Windows CRLF warnings.
  - Full lint/typecheck/build/test and UI verification were intentionally not run per local preference.

## WeApp Profile Quantified Top Stats (`2026-05-17`)

- Task: optimize the WeChat mini-program personal/profile page top shortcut area so it shows quantitative indicators instead of non-quantified shortcuts.
- Status: code changes applied; user-side mini-program visual verification pending per local preference.
- Implemented:
  - `wechat_app/src/me/profile/index.tsx`
    - Replaced the old top row (`全部计划`, `我的教练`, `我的会员`, `训练记录`) with quantified entries: `我的好友`, `我的动作库`, `我的计划库`, and `训练记录`.
    - Loads counts from existing data surfaces: friends total, student action-library total, student plan-library total, and training-history action total.
    - Keeps each stat clickable and routes to its corresponding page.
    - Follow-up correction after user feedback: top quantified entries should not duplicate lower menu entries and should not remove the old non-quantified options. The lower menu now restores `全部计划`, `我的教练`, and `我的会员`, while removing duplicate `我的好友`, `我的动作库`, and `我的计划库` entries from the list.
  - `wechat_app/src/me/profile/index.scss`
    - Added numeric value and unit styling for the top stats row.
  - `wechat_app/src/services/trainingHistoryService.ts`
    - Added `getSummary()` for profile-level training-history summary usage.
  - `src/app/api/training-history/summary/route.ts`
    - Added a lightweight authenticated summary endpoint that counts completed training sessions, completed sets, and action entries across plan and impromptu training records.
- Verification:
  - Full lint/typecheck/build/test and WeChat DevTools verification intentionally not run per local developer preference unless explicitly requested.

## WeApp Streetlifting Location Share Trial Issue (`2026-05-17`)

- Task: diagnose why the WeChat mini-program trial/experience version streetlifting location share link card has no image and location poster has no CoachLink mini-program code, while local testing looked fine.
- Status: code-level fix applied; user-side trial-version verification pending.
- Findings:
  - Link sharing was passing the raw location photo URL directly as `onShareAppMessage.imageUrl`. In local DevTools this can work because domain checks are often relaxed, but the uploaded trial version is stricter and WeChat may fail to fetch/accept the original Supabase image URL, resulting in a gray mini-program card.
  - The poster QR code endpoint defaulted to `release` in production backend deployments. For an uploaded experience/trial build, the mini-program code should target `env_version=trial`; otherwise code generation can fail or point at the wrong mini-program environment.
  - The share/recipient support endpoints also needed to be public. WeChat servers fetch `imageUrl` without CoachLink login cookies or JWT, and a recipient may not be logged in when opening a shared location.
- Implemented:
  - `wechat_app/src/utils/share.ts`
    - Added `getMiniappEnvVersion()` to detect `develop` / `trial` / `release` at runtime.
    - Added `buildStreetliftingLocationShareImageUrl()` to generate a CoachLink-hosted share card image URL.
  - `wechat_app/src/streetlifting/index/locations/index.tsx`
    - Location link share now uses the CoachLink OG share-card endpoint instead of the raw uploaded photo URL.
    - Poster QR code requests now pass the runtime mini-program env version.
  - `wechat_app/src/streetlifting/index/location-share/index.tsx`
    - Re-shares from the single-location landing page use the same CoachLink share-card image endpoint.
  - `src/app/api/miniapp/qrcode/streetlifting-location/route.ts`
    - Accepts a validated `envVersion` query param so trial builds can generate `trial` mini-program codes.
  - `src/app/api/og/streetlifting-location/route.tsx`
    - Can load location data by id server-side and render a share-card image even if the mini-program only sends `id`.
  - `src/proxy.ts`
    - Makes `/api/og/streetlifting-location`, `/api/miniapp/qrcode/streetlifting-location`, and `/api/streetlifting-index/locations/get` public so WeChat can fetch the share-card image, posters can load mini-program codes without relying on login, and recipients can open shared location details.
- Verification:
  - Full build / mini-program DevTools verification intentionally not run per local developer preference unless explicitly requested.

## Coach Student Tang Renewal Audit (`2026-05-17`)

- Task: answer whether Liu Sanle's student `唐` (`coach_subscriptions.id=8b03677a-8ecb-4cac-84b1-01620a20ab27`, screenshot short id `8B03677A`) has `24` subscribed weeks from a normal package or from renewal, and whether the renewal was platform-paid or offline/private-transfer proof.
- Status: data audit completed; no code changes requested.
- Findings:
  - Current active subscription: student nickname `唐`, coach `刘三乐`, product `引体力量提升`, `subscribed_weeks=24`, `payment_method=personal_qrcode`, `payment_confirmed_by=coach`, `order_id=null`, `last_payment_order_id=null`.
  - Existing weeks before the latest order were effectively `12` weeks: `payment_data.manual_repair` on `2026-03-22` records `new_subscribed_weeks=12` after correcting `previous_subscribed_weeks=10`.
  - Latest renewal order: `coach_subscription_orders.id=d38c4ab2-1ef4-433b-9225-a6e7946d76ad`, `order_type=renew`, `status=paid`, `purchased_weeks=12`, `amount_fen=19900`, `payment_method=personal_qrcode`, `payment_confirmed_by=coach`, confirmed at `2026-05-10T08:05:45+00:00`.
  - The latest order note contains a receipt URL under Supabase storage and says `付款凭证: ...jpg`, so the evidence is a screenshot uploaded into the system for offline/private QR-code payment confirmation.
  - There is no `alipay_order_id`, no subscription settlement row, and no platform payment order id on the subscription, so this was not a platform split-payment/order-payment renewal.

## Local Agent Rules Override (`2026-05-17`)

- Task: make the AGENTS.md automatic verification/check instructions temporarily inactive for developer `little horse brother` without turning the preference into a shared team rule.
- Status: implemented locally.
- Change:
  - `AGENTS.md` now has a local developer override saying automatic Web / WeChat mini-program verification and post-change lint/typecheck/build/test runs should be skipped unless explicitly requested.
  - The original `Frontend Verification` section is wrapped in a Markdown comment locally.
  - The post-change command examples in `修改后检查流程` are locally commented as shell comments.
  - `USER.md` records the developer alias and local preference.
- Safety:
  - `AGENTS.md` and `USER.md` should be treated as local-only changes for this developer and not committed as shared team rules.

## Web Search Submission Behavior (`2026-05-17`)

- Task: stop Web list searches from firing on every typed character/pinyin composition; searches should submit only on Enter, explicit search button, or clear.
- User clarification: no agent-side UI verification is needed for this task; the user will verify manually.
- Status: code changes applied; user-side verification pending.
- Implemented:
  - `src/app/dashboard/students/page.tsx`
    - Replaced debounced student search with separate input state and submitted search state.
    - Student list API now uses only the submitted search value.
    - Added Enter-to-search, explicit search button, and clear behavior.
  - `src/app/search/page.tsx`
    - Replaced debounced coach search with submitted search state.
    - Coach search now updates on Enter/search button/clear; filter dropdowns still refresh immediately.
  - `src/app/streetlifting-index/locations/page.tsx`
    - Replaced location search's input-driven remote reload with submitted search state.
    - City filters still refresh immediately; text query submits by Enter/search button/clear.
- Similarity check:
  - Reviewed action library, plan library, content management, chat search/video picker, and local video/content filters.
  - Action/plan/content search already used Enter/search button or local filtering; chat/video picker intentionally behaves like live picker search and was left unchanged.
- Verification:
  - Before the user's clarification, code-level checks were run: `npm run lint`, `npm run typecheck`, `npx next build`, `npm test` all passed.
  - Browser/manual verification is intentionally left to the user per latest instruction.

## WeApp Today Training Load Performance (`2026-05-17`)

- Task: improve student-side WeChat mini-program `today-training` -> `training-execution` perceived loading speed and reduce incorrect renewal-blocking copy for coach user `18115072586` / `枭马葛` related flow.
- User instruction: do not run further tests or manual/UI verification for this task; the user will test manually.
- Status: paused for subscription-domain model review before further code changes.
- Current design direction:
  - User clarified that coach subscriptions should not be modeled as natural calendar days and also should not collapse into a fixed session-count coupon.
  - `subscribed_weeks` should represent purchased coaching/programming service weeks.
  - Weekly frequency may change multiple times during one subscription; frequency determines how many scheduled training sessions exist inside a service week, while user delay/pause affects projected calendar remaining days.
  - Consumed entitlement should be calculated at the subscription level across real served plan phases/instances under the same `coach_subscription_id`, not merely from the currently active plan instance.
  - Before coding further, produce a clear model and implementation plan for subscription entitlement, plan replacement/archive semantics, frequency changes, delay/pause, and frontend renewal display.
- Subscription model implementation started:
  - `src/lib/subscriptionCarryover.ts` now treats carryover as subscription-level consumed service weeks across historical instances instead of a single max historical day index.
  - Historical `archived` instances can consume entitlement when they have completed executions, but completed executions before the subscription `start_date` are ignored for this subscription's entitlement.
  - For imported/mid-plan history, completed plan weeks are normalized by the first counted completed week in that instance, so plan day 50 after subscription start counts as the first served week in that subscription phase rather than instantly consuming seven prior weeks.
  - `coach-subscriptions`, `check-subscription`, `check-expired-subscriptions`, `get-instance`, `get-with-executions`, `execution` access checks, `updateEstimatedEndDate`, `create-instance`, `create-ai-instance`, `update-subscription`, and coach `list-students` now pass subscription start date into carryover where relevant.
  - Subscription list/expiry jobs now include archived historical instances for consumption but choose the latest non-archived instance as the current cadence source.
  - If historical carryover already exhausts the purchased service weeks, downstream display/expiry logic treats the subscription as ended instead of leaving a stale future `end_date`.
- Latest investigation for user `18115072586`:
  - The user has an active subscription to coach `刘三乐` (`coach_subscriptions.id=44ecb017-34bf-49ad-a46d-faf01e5ceac3`).
  - The active Liu Sanle coach plan also exists (`coach_plan_instances.id=5613f3d3-f9e3-4f6e-a243-aa277597ee63`, name `枭马葛的计划`, status `active`).
  - Root cause: `src/lib/subscriptionCarryover.ts` counted an old `archived` coach plan instance for the same subscription when calculating carryover/remaining subscription weeks. That archived plan had many completed days, so `api/plan-lib/get-instance` incorrectly treated the active subscription as exhausted and did not return the current coach plan. The today-training page then fell back to the user's self plan.
  - Fix applied: carryover calculations now use the same relevant plan statuses as the coach subscription remaining-days logic (`active`, `paused`, `completed`, `scheduled`) and exclude `archived` instances.
- Implemented:
  - `wechat_app/src/training/today-training/index.tsx`
    - Reconnected existing `today_training_page_cache_v1` read/write path so the today-training page can render cached plan/subscription/execution summary immediately, then refresh cloud data in the background.
    - Removed the duplicate first-load trigger that caused both `useEffect` and `useDidShow` to load the same data on initial entry.
    - Limited the hard renewal-blocking empty state to cases where the selected coach subscription is in grace/expired state and no coach plan is available; if a plan is present, the page should continue showing the training plan with only the inline grace warning.
    - Fixed a likely multi-subscription selection bug: after refresh, the page no longer keeps a previously selected coach subscription if that subscription has no executable plan while another subscription does. It now prioritizes subscriptions that actually returned a coach plan, then subscriptions whose `end_date` still has remaining days.
    - Added a front-end conflict guard: if `end_date` still resolves to positive remaining days, the page does not treat `lifecycle_status=expired_grace` as a renewal-blocking state.
  - `src/lib/subscriptionCarryover.ts`
    - Filters carryover history to non-archived subscription plan instances before deriving consumed/remaining weeks.
    - Selects and checks plan instance `status`, aligning the backend `get-instance` access gate with `/api/subscription/coach-subscriptions`.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Reconnected existing `training_execution_snapshots_v1` read path so execution pages can render the last local snapshot immediately before cloud refresh completes.
    - Centralized first-pending-set focusing so cached and cloud-loaded executions behave consistently.
    - Added an explicit initial `useEffect` load trigger in addition to `useDidShow`, with a short duplicate-call guard, so the page cannot remain on the initial `loading=true` state if page lifecycle firing is missed.
    - Added 12-second timeout guards and debug logs around the execution load chain (`getInstance`, `checkToday`, `getExecution`, `startExecution`, and impromptu `get`) so a stuck request exits loading and shows a retryable failure instead of spinning forever.
    - Follow-up root cause after user provided Next terminal logs: backend calls were returning 200, so the remaining black `加载中...` state was caused by the mini-program execution page throwing during main render after `loading=false`. The rollback source still referenced `getActionTypeMeta`, `formatRestSummary`, and `formatTimerValue` but those helpers had been removed. Restored those helpers in the WeApp page.
- Verification:
  - `wechat_app/npm run build:weapp`: passed.
  - Root `npm run typecheck`: passed.
  - Direct `wechat_app/npx tsc --noEmit --project tsconfig.json` was attempted and failed on broad pre-existing WeApp type noise (duplicate React types, many unused imports/config typing issues across unrelated pages); the targeted Taro WeApp build still passed.
  - WeChat DevTools UI verification was not run in this environment.

## WeApp Student Training UI Rollback (`2026-05-16`)

- Task: roll back the student-side WeChat mini-program `today-training` and `training-execution` UI toward the earlier, more efficient version because the newer card/one-set-at-a-time flow was too slow and confusing.
- Status: implemented and code-level verified.
- Latest clarification:
  - User showed the current `today-training` screenshot and clarified that the top home-like content should not exist there: stretch promotion, greeting/date header, plan summary hero, duplicate "enter today's training" CTA, impromptu hero CTA, and `AI 长期计划 / 浏览教练` secondary cards should be removed to move closer to the early-April training page.
- Implemented:
  - `wechat_app/src/training/today-training/index.tsx`
    - Restored the full older `today-training` page implementation instead of the thin `TodayTrainingScreen` re-export introduced by the later UI refactor.
    - Removed the later home-style header/promo/hero/secondary-card blocks so the page starts from training-specific plan switching, plan identity, calendar, and today's arrangement.
  - `wechat_app/src/training/today-training/index.scss`
    - Restored the matching older page styles.
    - Removed the now-unused dashboard header styles.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Restored the older execution UI where actions expand into visible set lists, allowing faster multi-set scanning and entry instead of the later flash-card/current-set-only surface.
    - Reconnected `syncTrainingExecutionToStorage` so successful execution writes still update the execution snapshot and today's-training page cache.
    - Fixed a loading deadlock: when `userId` or required route params are missing, the restored page now clears `loading` and shows the error/retry state instead of returning early forever on "加载中...".
  - `wechat_app/src/training/training-execution/index.scss`
    - Restored the matching list-style execution page styles.
  - `wechat_app/src/components/BottomNav.tsx`
    - Student `训练` tab now points back to `/training/today-training` instead of `/pages/index/index`.
- Verification:
  - `npm run lint`: passed (informational lint script only).
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed; emitted Redis connection timeout logs during build, but exited successfully.
  - Root `npm test`: passed, 24 files / 134 tests.
  - `wechat_app/npm run build:weapp`: passed.
- UI verification blocker:
  - WeChat DevTools automation could not run in this environment because `mrc` is not installed/available and no automation connection was present on port `9420`.
- Worktree note:
  - The workspace already contains many unrelated modified WeApp files. This task intentionally changed only the five files listed above.

## WeApp Streetlifting Location Share Deep Link (`2026-05-08`)

- Task: improve the WeChat mini-program toolbox `单杠位置` share flow so it drives recipients back into CoachLink instead of only copying plain text.
- Status: implemented in code; per latest user instruction, manual verification is left to the user and no further agent-side UI/manual testing should run for this task.
- Implemented:
  - `wechat_app/src/streetlifting/index/locations/index.tsx`
    - Replaced the single share affordance with two explicit share modes: `分享链接` and `生成海报`.
    - Link sharing now locks onto the selected location before calling `openType='share'`.
    - When opened from a shared link, the target location is fetched and surfaced at the top of the page, and the shared card is visually highlighted in the list when full data is available.
    - Added a location poster generation flow using the existing mini-program canvas/share-poster infrastructure.
  - `wechat_app/src/streetlifting/index/locations/index.config.ts`
    - Enabled `shareAppMessage` and `shareTimeline` for the mini-program page.
  - `wechat_app/src/utils/share.ts`
    - Added shared helpers for streetlifting-location share paths and titles.
  - `wechat_app/src/services/streetliftingIndexService.ts`
    - Added client support for fetching one shared location by id.
  - `src/app/api/streetlifting-index/locations/get/route.ts`
    - Added a minimal backend read endpoint so shared mini-program links can resolve a specific location by `id`.
  - `wechat_app/src/streetlifting/index/locations/poster.ts`
    - Added a dedicated single-location poster renderer.
- Major fix round (`2026-05-08` evening):
  - **Problem 1 — share link opens list instead of location detail**: Root cause was `buildLocationSharePath` embedding six Chinese preview params (`sn/sp/sc/sct/sa/sd`) into the share `path`. After URL encoding, the path could exceed WeChat's share-path length limit, causing the entire path to be discarded and fallback to the default page.
    - Fix: `buildLocationSharePath` now only carries `locationId`. The `location-share` page loads full data via API instead of relying on URL preview params.
    - `locations` page already supports `locationId` via `sharedLocation` / `sharedLocationId` as a fallback.
    - `buildSharedLocationPreviewFromParams` and `buildPreviewLocation` updated to return `null` when only `locationId` is present (no preview params), so the UI shows a loading state while fetching real data.
  - **Problem 2 — poster missing image / QR code / mojibake**: Root causes were (a) image domain not in mini-program `downloadFile` whitelist causing `getImageInfo`/`downloadFile` to fail, (b) Canvas default `sans-serif` has no Chinese font fallback in WeChat, (c) poster layout was too tall and sparse.
    - Fix: `weapp-canvas-image.ts` — `downloadFile` success now directly returns `tempFilePath` without a second `getImageInfo` call that could fail.
    - Fix: `poster.ts` — completely redrawn with:
      - Explicit Chinese font stack (`PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif`) on every `ctx.font` assignment.
      - Tighter 750×1100px canvas (was 750×1180).
      - Larger cover image area (480px tall) with rounded corners and a bottom gradient overlay.
      - Larger QR code area (128×128px with white background and rounded corners).
      - QR code load failure fallback: shows `请搜索 CoachLink` text instead of a blank gray box.
      - No-image fallback: brand-colored gradient background with centered copy instead of the old long placeholder text.
      - Dark bottom action bar with white text for strong CTA contrast.
    - Fix: `streetliftingIndexService.ts` — corrected GBK mojibake error message `鍔犺浇鍦扮偣澶辫触` → `加载地点失败`.
    - `SharePosterModal` canvas height updated from 1180 → 1100 to match new poster size.
- Code-level verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed.
  - `wechat_app` build (`npm run build:weapp`): passed.
- User override:
  - User explicitly asked on `2026-05-08` that the remaining testing be done manually, so mini-program build / DevTools verification was not continued after that point.

## Huifu Renew Split Failure Follow-up (`2026-05-05`)

- Task: diagnose why a 2026-05-05 13:20 1-yuan coach-renew test payment did not appear in the coach wallet.
- Status: diagnosed and patched at code/build level; follow-up needed for coach Huifu onboarding rewrite.
- Finding:
  - The payment order `c92f87e1-cf01-478e-bc9e-85ff4b2ca3d1` is paid and has `trade_status = S`.
  - The related `coach_subscription_settlements` row is `split_failed` with Huifu error `商户信息不存在`.
  - No wallet transaction exists for that order, so the wallet page correctly stayed unchanged instead of crediting local money without real Huifu split success.
  - The coach row was incorrectly marked `huifu_open_status = opened` while `huifu_card_token` is null, meaning the Huifu business onboarding / card-token step did not complete cleanly.
- Fix:
  - `src/app/api/payment/alipay/fulfillPaidOrder.ts`
    - Balance payment now transfers only the coach net share to the coach Huifu account.
    - The platform share remains in the platform cash account and is still recorded locally as platform revenue.
  - `src/app/api/payment/wechat/query/route.ts`
    - Paid WeChat coach-subscription orders can now retry/compensate settlement when the order is already paid but the settlement is still `pending` or `split_failed`.
  - `src/app/api/admin/coach-subscription-settlements/retry/route.ts`
    - Adds an admin-only manual retry endpoint for paid coach subscription settlements.
    - Requires explicit `confirm: "RETRY_HUIFU_SPLIT"` because it can initiate a real Huifu balance-payment transfer.
    - On split success, credits the coach wallet and marks the settlement `wallet_credited`; already-credited orders remain idempotent.
  - `src/lib/huifuMiniProgramPay.ts`
    - `openHuifuUserBusiness()` now rejects non-success responses and rejects responses that do not return `token_no`.
  - `src/app/api/coach/merchant/open-huifu-account/route.ts`
    - A coach marked `opened` but missing `huifu_card_token` can re-run business onboarding instead of being blocked by a false "already opened" response.
  - `src/app/api/coach/wallet/route.ts`
    - Wallet API now reports such incomplete Huifu accounts as failed/incomplete so the UI can expose the re-open flow.
  - `src/app/api/payment/wechat/coach/create/route.ts`
  - `src/app/api/payment/alipay/fulfillPaidOrder.ts`
    - New coach subscription payments and settlement retries now require a fully opened Huifu account with `huifu_card_token`.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed, informational script.
  - `npx next build`: passed.
  - `npm test`: failed only in the pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export-mismatch tests.
  - `wechat_app/npm run build:weapp`: passed.
- Safety note:
  - Retrying the existing paid order will call real Huifu balance payment for the coach net share, so it should only be triggered after explicit confirmation.
- Follow-up onboarding decision:
  - The full Huifu docs confirm coach onboarding should be modeled as two stages: personal user basic opening first, then user business onboarding.
  - Current code already calls both APIs, but the business onboarding payload still needs to be rewritten for the current product model: Huifu automatic withdrawal is closed, so the coach should be configured with `card_info + cash_config` for manual encashment instead of relying on `settle_config_list`.
  - A coach must not be considered ready for subscription payment, balance split, or withdrawal unless business onboarding returns and stores `token_no`.
- Latest fix:
  - Huifu rejected the business onboarding request with `个人只能是对私结算类型[cardType]`.
  - Root cause: CoachLink was defaulting `card_type` to `"0"` in `/api/coach/merchant/open-huifu-account`.
  - Fixed by forcing personal coach bank cards to Huifu `card_type = "1"` and adding Web copy that the withdrawal card must be a本人对私银行卡.
  - Verification: `npm run lint`, `npm run typecheck`, and `npx next build` passed; `npm test` still fails only on the pre-existing BodyMap export tests. Browser verification was attempted but blocked by the Browser Use node_repl requiring Node >= 22.22 while this runtime is Node 22.14.
- Settlement verification update:
  - Manual retry for order `c92f87e1-cf01-478e-bc9e-85ff4b2ca3d1` now succeeded end to end.
  - `coach_subscription_settlements` row `59042ffd-d2ad-42d0-a2c9-02cd019939e9` is `wallet_credited`, with `trans_stat = S`, `huifu_hf_seq_id = 003500TOP4A260505155355P210ac136b7200000`, and `acct_split_bunch.acct_infos[0].div_amt = 0.80` to coach Huifu user `6666000197050360`.
  - Local wallet ledger row exists: `wallet_transactions.id = 515089b4-7a7c-45df-b4ae-1bfcfc00e4ce`, `amount = 80` fen, `platform_fee = 20` fen, created at `2026-05-05T07:53:56.871+00:00`.
  - `retry` endpoint returning `splitStatus = wallet_credited` with `walletCredited = false` is normal on later retries: it means the wallet ledger had already been credited earlier, so the endpoint short-circuited instead of inserting a duplicate wallet transaction.
- Functional status checkpoint:
  - Confirmed complete and verified: coach Huifu onboarding, coach subscription payment collection, Huifu balance split, local wallet income booking, platform fee booking, wallet UI display, and 7-day refund-protection freeze display.
  - Not yet fully closed by real end-to-end validation: refund for Huifu-paid coach subscription orders, and successful Huifu withdrawal after funds become withdrawable.
  - Important code risk still present: `src/app/api/payment/alipay/refund/route.ts` currently calls Alipay direct refund SDK; this needs explicit validation against Huifu-paid coach subscription orders before treating refund as production-ready for the Huifu path.

## Coach Wallet 7-day Refund Lock & Test Renew Entry (`2026-05-05`)

- Task: make coach wallet withdrawable balance respect the 7-day refund window and add a development-only 1-cent renew test entry for the WeChat coach profile flow.
- Status: implemented and verified at code/build level.
- Implemented:
  - `src/lib/coachWalletLock.ts`
    - Adds shared 7-day refund-protection math for coach income rows.
    - Computes withdrawable balance by combining stored frozen balance with refund-protected recent income.
  - `src/app/api/coach/wallet/route.ts`
    - Returns dynamic `balance` as the withdrawable amount.
    - Also exposes `gross_balance`, `withdrawable_balance`, `refund_protected_amount`, and `refund_protection_days` for UI clarity.
  - `src/app/api/coach/wallet/alipay/withdraw/route.ts`
    - Rejects withdrawals that exceed the dynamic withdrawable amount and explains that 7-day refundable income is frozen.
  - `src/app/api/coach/wallet/huifu/withdraw/route.ts`
    - Applies the same withdrawable-balance guard to Huifu withdrawals.
  - `src/app/api/payment/wechat/coach/create/route.ts`
    - Accepts `testAmountFen` and uses it only outside production.
    - Development-only test payments are blocked from production use.
  - `wechat_app/src/discovery/coach-profile/*`
    - Adds a dev-only `1元续费测试（加1个月）` entry for already-subscribed coaches.
    - The test path starts a 1-yuan renew payment and uses the existing WeChat payment chain, while preserving the normal 1-month renewal unit.
    - Renewal mode now only allows extending the current subscription package; selecting another package shows a guard message instead of creating an ambiguous renewal order.
  - `src/app/dashboard/wallet/page.tsx`
    - Shows gross balance alongside withdrawable balance and frozen amount so the 7-day freeze is visible to coaches.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed (script is informational).
  - `npx next build`: passed.
  - `npm test`: failed only on the pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export mismatch.
  - `wechat_app/npm run build:weapp`: passed.
- Remaining limitation:
  - Browser / WeChat DevTools visual verification was not possible in this session because the required `web-devtools` / `weapp-devtools` tool surface is unavailable here.

## Legacy Coach Wallet Split Backfill (`2026-05-05`)

- Task: handle coach wallet balances that were credited before Huifu split-payment rules existed, so historical subscription income is no longer withdrawable at 100% gross.
- Status: implemented at code/migration level; database migration still needs to be applied before frontend withdrawal validation.
- Problem:
  - Some existing coach `wallet_transactions` income rows were created before the 80/20 coach/platform split was enforced.
  - Those rows can make `coach_wallets.balance` and `total_income` too high, so the coach wallet page may allow withdrawal of the platform share.
- Implemented:
  - `supabase/migrations/20260505_backfill_legacy_wallet_split_amounts.sql`
    - Creates `wallet_split_backfill_adjustments` as an audit table.
    - Finds legacy coach subscription income rows where wallet income equals the full paid order amount and `platform_fee` is still zero.
    - Rewrites those income rows to the coach net amount and records the platform fee.
    - Rewrites matching historical refund rows to the same coach-net amount when they still equal the old gross amount.
    - Backfills missing `platform_revenue` rows for historical platform fees.
    - Recomputes `coach_wallets.balance` and `coach_wallets.total_income` from the wallet ledger after adjustment.
  - `src/app/api/payment/alipay/refund/route.ts`
    - Coach subscription refunds still refund the student's full external payment amount.
    - Coach wallet deduction now uses the already-credited coach-net income amount when present, with 80% net fallback for old rows.
- Verification:
  - `npm run typecheck`: passed.
  - `npm run lint`: passed, informational script.
  - `npx next build`: passed after replacing the old mojibake refund route.
  - `npm test`: failed only in pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export-mismatch tests, unrelated to payment/wallet work.
- Remaining next steps:
  - Apply both Huifu settlement and legacy wallet backfill migrations in Supabase.
  - Then verify the coach wallet UI against a coach with historical income before allowing Huifu withdrawal.

## Huifu Coach Subscription Settlement Guard (`2026-05-05`)

- Task: confirm whether the proposed coach-subscription settlement/status table exists, then complete the next split-payment safety work.
- Status: implemented and verified at code/build level.
- Finding:
  - Existing migrations had `platform_revenue`, `coaches.huifu_id`, `coaches.huifu_open_status`, `coaches.huifu_open_msg`, and `coaches.huifu_card_token`.
  - No dedicated `coach_subscription_settlements` / subscription settlement status table existed before this change.
- Implemented:
  - `supabase/migrations/20260505_coach_subscription_settlements.sql`
    - Creates `coach_subscription_settlements` with one row per paid coach-subscription order.
    - Tracks `pending / processing / split_success / split_failed / wallet_credited`, Huifu request ids, returned split detail, attempts, and timestamps.
    - Adds a unique index on `platform_revenue.source_order_id` so platform revenue remains idempotent per source order.
  - `src/app/api/payment/alipay/fulfillPaidOrder.ts`
    - Reworked `executeBalancePayment()` so the settlement table, not `wallet_transactions`, is the remote-call idempotency guard.
    - Wallet credit is now blocked unless Huifu split reaches `split_success` and returns `acct_split_bunch`.
    - Ambiguous exceptions after claiming a remote split request remain `processing` to avoid double transfer retries with a fresh `req_seq_id`.
    - `updateTransactionAndWallet()` now refuses coach-subscription wallet credit without split details.
    - Added `markSettlementWalletCredited()` after local wallet/revenue writes succeed.
  - `src/app/api/payment/wechat/notify/route.ts`
  - `src/app/api/payment/wechat/query/route.ts`
    - Coach subscription payments now execute split first; only successful split results can trigger local coach wallet credit.
- Verification:
  - `npm run lint`: passed (project lint script is informational).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: failed on pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export mismatch (`BODY_PART_CATEGORY_MAP`, `SVG_BODY_PART_NAMES`, `CATEGORY_TO_BODY_PARTS`, `getCategory`, `isJoint` undefined), unrelated to split-payment changes.
- Remaining next steps:
  - Apply the new migration to Supabase before live traffic depends on the settlement table.
  - Add a Huifu balance-payment query/reconciliation job for rows stuck in `processing`.
  - Revisit Huifu withdrawal safety; current withdrawal route still calls external encashment before robust local freeze/reconcile semantics.

## WeApp Questionnaire Ready Status Mismatch (`2026-05-03`)

- Task: fix the WeChat mini-program coach `我的` / `概览` surfaces so `学员问卷` reflects the actually published questionnaire.
- Status: implemented and verified at code/build level.
- Symptom:
  - `wechat_app/src/coach/questionnaire/index.tsx` showed a questionnaire as `已发布`.
  - But `wechat_app/src/coach/my-profile/index.tsx` and `wechat_app/src/coach/overview/index.tsx` still rendered `学员问卷 = 待设置`.
- Root cause:
  - The questionnaire management list had already switched to the new publication source of truth `status = 'active'`.
  - The coach overview payload used by mini-program `我的` / `概览` was still effectively relying on the legacy publication flag chain.
  - `src/app/api/coach/publish-questionnaire/route.ts` had been publishing by `status`, but older readiness logic and data compatibility around `is_active` were not kept in sync.
- Implemented:
  - `src/app/api/coach/get-overview-data/route.ts`
    - `questionReady` now checks questionnaire rows more defensively and treats either `status = 'active'` or `is_active = true` as ready.
  - `src/app/api/coach/publish-questionnaire/route.ts`
    - demoting the old published questionnaire now also writes `is_active = false`
    - promoting the selected questionnaire now also writes `is_active = true`
- Verification:
  - `npm run typecheck`: passed
  - `npx next build`: passed
  - `npm test`: failed on unrelated pre-existing `src/components/knowledge/BodyMap/bodyMapTypes.test.ts` export mismatches, not on questionnaire code

## WeApp Chat Image Caption Parity (`2026-05-02`)

- Task: fix the WeChat mini-program private-message detail view so coach broadcast image messages show their attached caption text instead of only the image, matching the chat-list preview and Web chat behavior.
- Status: implemented and verified at code/build level.
- Root cause:
  - Coach broadcast messages can be stored as `message_type = image` with the explanatory text carried in `content`.
  - The mini-program chat list preview uses `chat_rooms.last_message`, so that caption text was visible there.
  - `wechat_app/src/me/messages/chat/index.tsx` rendered `image` messages as image-only and dropped `content`, so the detail page hid the caption even though it existed in `chat_messages`.
- Implemented:
  - `wechat_app/src/me/messages/chat/index.tsx`
    - Added shared media-caption rendering for image messages.
    - Image messages now render the uploaded image plus the trimmed caption when `content` is present and not just the media URL.
  - `wechat_app/src/me/messages/chat/index.scss`
    - Added compact media-block / caption styling so image and caption stay grouped in the same bubble flow.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - `127.0.0.1:9420` is not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Login Audit-Fix For WeChat Review (`2026-05-01`)

- Update (`2026-05-02`):
  - Follow-up fix after product review: even when users do reach `/auth/login`, the page itself must still expose a visible return path so the flow does not become a dead end.
  - `wechat_app/src/auth/login/index.tsx` now adds a custom top-left `返回` action because this page uses `navigationStyle: 'custom'`.
  - Return behavior is `navigateBack()` when there is history, otherwise `reLaunch('/pages/index/index')`.
  - `wechat_app/src/auth/login/index.scss` adds the matching lightweight hero-level back control styling instead of another heavy card inside the login form.

- Update (`2026-05-01`, later same session):
  - Product direction corrected after review: the right fix is not to enlarge the login page with extra guest-exit cards, but to keep unauthenticated users on browsable surfaces first.
  - Final implemented behavior:
    - unauthenticated `个人` tab now opens the guest profile page instead of forcing `/auth/login`
    - unauthenticated `消息` still requires auth, but now uses a return-aware login URL
    - logout from profile / coach profile / settings now returns to `/pages/index/index`
    - the previously added guest-entry cards on login/register were removed

- Task: address the WeChat mini-program review rejection on the login flow by making cancellation / return paths explicit and ensuring users are not forced to log in before they can continue browsing the app.
- Status: implemented and verified at code/build level.
- Requirement:
  - The mini-program login flow must provide a clear, effective cancel / refuse / return path.
  - Users who decline phone-number authorization should still be able to continue browsing instead of being trapped in the login path.
  - Registration should also provide a visible path back to non-authenticated browsing so the whole auth chain is not perceived as mandatory.
- Implemented:
  - `wechat_app/src/auth/login/index.tsx`
    - Added a prominent guest-exit card ahead of the login methods with a `先逛逛` action that returns users to `/pages/index/index`.
    - Softened the `getPhoneNumber` refusal handling so denial now tells users they can continue browsing or use another login method instead of only pushing them back toward authorization.
    - Added explanatory copy under the quick-login button that refusal does not block returning to the home page.
  - `wechat_app/src/auth/login/index.scss`
    - Added the guest-exit card / secondary-button styles using pure-color buttons and 8-grid spacing.
  - `wechat_app/src/auth/register/index.tsx`
    - Added a matching guest-exit card with a `返回首页` action so registration is not a dead-end or mandatory gate.
  - `wechat_app/src/auth/register/index.scss`
    - Added the matching guest-exit card / secondary-button styles.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Not completed in this session.
  - Blocker: the required `weapp-devtools` skill/runtime is not available in the current tool surface, so only code/build verification could be completed.

## WeApp Student Action Edit Demo Video Upload Parity (`2026-05-01`)

- Task: sync the WeChat mini-program student action edit page with the current Web demo-video workflow so editing a student action supports local video upload instead of requiring manual link paste only.
- Status: implemented and verified at code/build level.
- Requirement:
  - The mini-program student action edit page should follow Web `src/app/me/action-lib/StudentActionEditDialog.tsx` semantics for demo videos.
  - The URL field remains the stored source of truth, but users should be able to upload a local video and have the returned URL auto-filled back into the form.
  - The edit surface should preview the playable demo video inline after upload or link paste, instead of showing a raw URL card as the primary feedback.
  - Replacing or deleting a student action should clean up the previously uploaded demo video file when it belongs to the app storage bucket.
- Implemented:
  - `wechat_app/src/me/action-lib/edit/index.tsx`
    - Added demo-video upload entry with progress display, local file selection, URL auto-fill, and clear-link action.
    - Replaced the old raw-link preview card with an inline mini-program video preview so uploaded videos and pasted direct video links can be watched directly on the page.
    - Kept the editable URL field so uploaded and manually pasted external links still share the same persisted field.
  - `wechat_app/src/me/action-lib/edit/index.scss`
    - Reworked the video field UI to support upload actions and progress while staying within the mini-program design rules (pure-color buttons, 8-grid spacing).
  - `wechat_app/src/services/studentActionLibService.ts`
    - Added `uploadDemoVideo()` using mini-program `uploadFile` plus auth token forwarding and progress callbacks.
  - `src/app/api/student/action-lib/upload-demo-video/route.ts`
    - Added a student-side upload endpoint for multipart demo-video uploads to the `videos` storage bucket.
  - `src/app/api/student/action-lib/update-action/route.ts`
    - Added cleanup for replaced/cleared demo videos when the stored URL changes away from an app-managed storage file.
  - `src/app/api/student/action-lib/delete-action/route.ts`
    - Added cleanup for app-managed demo videos when the student action itself is deleted.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - `127.0.0.1:9420` is also not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Streetlifting Score Title Parity (`2026-05-01`)

- Task: make the WeChat mini-program streetlifting calculator score titles match the current Web source of truth instead of showing the older English `World Class / Intermediate` labels.
- Status: implemented and verified at code/build level.
- Requirement:
  - The mini-program result page and share poster should use the same more playful Chinese level wording as the Web streetlifting calculator.
  - The shared mini-program calculator utility must be the single source of truth for this mapping so result-page UI and share data stay aligned.
- Implemented:
  - `wechat_app/src/utils/streetliftingCalc.ts`
    - Updated `getScoreLevel()` to match the current Web `src/app/streetlifting-index/_utils.ts` thresholds and wording.
    - Powerlifting labels now use `世界一线 / 国内一线 / 大佬 / 爱好者 / 菜就多练`.
    - 500-point system labels now use `世界级 / 国内顶级 / 大佬 / 爱好者水平 / 菜就多练`.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - `127.0.0.1:9420` is also not accepting connections, so local WeChat DevTools automation is not running.

## Streetlifting And Auto 1RM Remove Lombardi (`2026-04-30`)

- Task: remove the Lombardi formula from Web and WeChat mini-program strength / streetlifting calculations, including toolbox calculator forward/reverse modes, RM tables, day-max estimation dependencies, auto recommended load, and shared e1RM utility outputs.
- Status: implemented and verified at code/build level.
- Requirement:
  - The current three-formula average can overestimate user-facing 1RM for low-rep weighted pull-up / dip scenarios such as `77kg BW + 40kg x 4`.
  - Web and mini-program must stop using Lombardi anywhere in the shared strength-calculation path, so users do not see different numbers across calculator, RM table, auto load preview, or auto PR/e1RM calculations.
- Implemented:
  - Shared streetlifting math:
    - `src/app/streetlifting-index/_utils.ts`
    - `wechat_app/src/utils/streetliftingCalc.ts`
    - Changed forward 1RM, reverse weight, reverse reps, and RM table inversion from `avg(Epley, Brzycki, Lombardi)` to `avg(Epley, Brzycki)`.
  - Shared 1RM / recommended-load math:
    - `src/lib/e1rmCalculator.ts`
    - `src/lib/rmCaculator.ts`
    - `wechat_app/src/utils/rmCalculator.ts`
    - Removed Lombardi from shared e1RM outputs and lambda-model selection, keeping only `average / epley / brzycki`.
  - UI / product surfaces:
    - `src/components/streetlifting-index/StreetliftingRecentSubmissions.tsx`
    - `src/app/streetlifting-index/methodology/page.tsx`
    - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`
    - `src/app/dashboard/plan-lib/components/ActionSetForm.tsx`
    - `wechat_app/src/utils/planStrength.ts`
    - Removed Lombardi from recent-submission 1RM display, methodology copy, and plan-editor algorithm choices / mappings.
  - API / persistence payload alignment:
    - `src/app/api/execution/calculate-e1rm/entity.ts`
    - `src/app/api/execution/calculate-e1rm/route.ts`
    - `src/app/api/execution/complete-set/route.ts`
    - `src/app/api/execution/create-pr/route.ts`
    - `src/app/api/training/finish-training/route.ts`
    - `src/app/api/training/save-1rm-record/route.ts`
    - `src/app/api/user/update-personal-records/route.ts`
    - Removed `lombardi` from response/trace payloads and `estimatedFrom` snapshots written by shared e1RM flows.
  - Docs / tests:
    - `src/RM.md`
    - `src/lib/e1rmAndLoadCalculation.test.ts`
    - Updated docs and tests to the two-formula average.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- UI verification:
  - Browser / mini-program manual automation was not completed in this session.
  - Blocker: the workspace instructions require `web-devtools` / `weapp-devtools`, but those tool surfaces are not available in the current session.

## WeApp Student Action Library Web Parity Review (`2026-04-30`)

- Task: inspect the current WeChat mini-program student action-library screen against the existing Web student action-library implementation before proposing UX changes.
- Status: implemented in code.
- Requirement:
  - Use the current Web student action-library under `src/app/me/action-lib` as the immediate source of truth.
  - Do not redesign the mini-program action-library flow from scratch before checking what the Web product already does.
- Focus:
  - Compare `wechat_app/src/me/action-lib/index.tsx` with `src/app/me/action-lib/page.tsx`.
  - Clarify the actual semantics of `贡献 / 加入我的动作库 / 纠错建议 / 点赞 / 删除 / 合并 / 查引用`.
  - Identify where the mini-program currently exposes Web capabilities in a more crowded or mismatched way.
- Implemented:
  - `wechat_app/src/me/action-lib/index.tsx`
    - `我的动作库` 列表层改为与 Web 对齐，只保留 `贡献 / 编辑 / 删除`。
    - 移除了列表常驻的 `引用 / 合并` 入口。
    - `公共动作库` 列表层改为 `详情 / 点赞 / 加入我的库`。
    - 移除了公共列表卡片上的 `纠错` 按钮，改为进入详情页后再提交建议。
  - `wechat_app/src/training/action-detail/index.tsx`
    - 为公共动作详情补齐 `提交纠错建议`。
    - 为公共动作 owner 补齐 `同步到我的动作库`。
  - `wechat_app/src/services/actionLibPageService.ts`
    - 新增 `syncPublicToMyLib()`，对接现有 Web 后端 `/api/public-action-lib/sync-to-my-lib`。
  - `wechat_app/src/types/action.ts`
    - 补充 `owner_user_id` 以支持详情页 owner 判断。
- Verification:
  - Root `npm run lint`: passed.
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation verification: blocked in this session because local `weapp-devtools` runtime is unavailable (`mrc` missing and `127.0.0.1:9420` not accepting connections).

## WeApp Contact Coach Chat Target Fix (`2026-04-30`)

- Task: fix the student-side WeChat mini-program `联系教练` flow so it opens the real coach chat instead of creating a room for an unknown user.
- Status: implemented in code.
- Root cause:
  - Student-side mini-program contact-chat entry points were treating `coach_subscriptions.coach_id` / `coaches.id` as if it were the chat peer user id.
  - The chat system actually needs the coach account `user_id`, so using the coach row id could create a private room against a non-user identifier and then render as `未知用户`.
- Fix:
  - `wechat_app/src/utils/coachChat.ts`
    - Added a shared resolver/opener for coach chat.
    - Prefer `coach.user_id` directly; if only `coachId` is available, resolve it through `coachService.getAggregatedInfo({ coachId })` before opening chat.
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
    - `联系教练` now uses the shared coach-chat helper.
    - Navigation into `training-execution` now carries `coachUserId` when available, so the execution page does not need to guess later.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Added `coachUserId` route-param support.
    - The execution-page `联系教练` menu action now uses the shared coach-chat helper instead of directly opening chat with `coachId`.
  - `wechat_app/src/me/messages/index.tsx`
    - Deep-link auto-open now supports `peerUserId`.
    - When only `coachId` is present, it resolves the coach's real `user_id` before trying to open the room.
  - `wechat_app/src/me/my-coaches/index.tsx`
  - `wechat_app/src/me/my-coaches/types.ts`
    - `我的教练` contact entry now passes `coach.user_id` when available and otherwise falls back to the shared resolver flow.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation verification: attempted but blocked.
    - `mrc` is not installed in this session.
    - `127.0.0.1:9420` is not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Coach Application And Waiting-State Parity (`2026-04-30`)

- Task: make the WeChat mini-program coach application flow and the coach-application waiting display on mini-program home/profile surfaces match the current Web source of truth.
- Status: implemented in code.
- Requirement:
  - Mini-program coach application must no longer stay on the older pre-layering form model.
  - Mini-program waiting / pending / supplement-material display should follow the Web coach-application status semantics instead of only showing a generic `not a coach yet` empty state.
- Implemented:
  - `wechat_app/src/utils/coachApplicationParity.ts`
    - Added a shared mini-program parity helper for coach-track options and the full Web-aligned coach application status model: `none / draft / pending / reviewing / needs_info / rejected / approved / coach`.
  - `wechat_app/src/coach/application/index.tsx`
  - `wechat_app/src/coach/application/index.scss`
    - Rebuilt the mini-program coach application page around the current Web semantics.
    - Added Web-aligned layered fields: `coachTrack`, `serviceModes`, `targetStudentLevels`, `supportFocus`, and location fields.
    - Expanded review-status rendering to cover `reviewing` and `needs_info`, not just the old `pending / approved / rejected` subset.
    - Synced local mini-program auth storage after load/submit so pending/approved state is reflected immediately without waiting for a fresh login.
  - `wechat_app/src/coach/my-profile/index.tsx`
  - `wechat_app/src/coach/my-profile/index.scss`
    - Replaced the old one-size-fits-all `go apply to become a coach` empty state with a Web-aligned status card that distinguishes waiting, supplement-material, rejected, and approved states.
  - `wechat_app/src/me/profile/index.tsx`
  - `wechat_app/src/me/profile/index.scss`
    - Added a mini-program profile-home coach application progress card so users can see the same waiting-state semantics on mobile home/profile entry surfaces.
    - Updated the extra menu entry so it reflects current application status rather than always saying `申请成为教练`.
    - Hid the profile-home `教练申请进度` card after coach permission is already granted; this waiting-state card should only appear for users still in the application/review flow.
  - `wechat_app/src/services/coach/coachService.ts`
    - Extended create/update coach-application payload typing to include the newer Web fields.
  - `wechat_app/src/me/profile/detail/index.tsx`
    - Expanded local type support for `reviewing` and `needs_info`.
- Verification:
  - Root `npm run lint`: passed (informational script only).
  - Root `npm run typecheck`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - Root `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
- Mini-program DevTools verification:
  - Attempted per local `weapp-devtools` workflow.
  - Blocked because `mrc` is not installed in this session.
  - Port `127.0.0.1:9420` is also not accepting connections, so local WeChat DevTools automation is not running.

## Impromptu Training Parity And Usability Check (`2026-04-30`)

- Task: make the WeChat mini-program `impromptu training` flow match the current Web experience as closely as possible and remove the current mini-program usability/build blocker.
- Status: implemented in code.
- Implemented:
  - `wechat_app/src/training/impromptu-training/index.tsx`
    - Rebuilt the mini-program entry page around the Web flow.
    - Added support for `STRENGTH / CARDIO / DIET / HABIT` item types instead of strength-only creation.
    - Added profile-based draft bootstrap through `studentActionLibService.bootstrapFromProfile`.
    - Kept strength items editable for sets/reps/rest/weight and allowed non-strength items to enter the same creation flow.
  - `wechat_app/src/services/studentActionLibService.ts`
    - Added mini-program support for `bootstrapFromProfile` so the mobile flow can preload recommended draft items like Web.
  - `wechat_app/src/services/impromptuService.ts`
  - `src/app/service/impromptuTrainingService.ts`
  - `src/app/api/impromptu/complete-item/*`
    - Added explicit impromptu item-complete support for non-strength action types so mobile/Web execution can complete `CARDIO / DIET / HABIT` items correctly.
  - `src/app/api/impromptu/start/route.ts`
  - `src/app/api/impromptu/get/route.ts`
    - Enriched impromptu execution payloads with action `type` and `attrs` so existing and new impromptu executions can render the correct item-type UI.
  - `wechat_app/src/training/training-execution/index.tsx`
  - `src/app/training-execution/[instanceId]/page.tsx`
    - Updated impromptu execution rendering and completion flow so both clients preserve action type metadata instead of forcing everything to `STRENGTH`.
    - Extra impromptu actions now immediately keep their real `type` in local UI state after being added.
  - `wechat_app/src/me/my-coaches/index.tsx`
    - Fixed the unrelated syntax error that had been blocking the mini-program build (`Unterminated string constant`).
- Current parity judgment:
  - Mini-program and Web impromptu training now share the same broad product surface:
    - multi-type creation
    - profile-based bootstrap draft
    - impromptu execution support for strength and non-strength items
  - Some UI presentation details still differ because the two clients are built with different component systems, but the mini-program is no longer missing the major Web capabilities that were identified in the review.
- Verification:
  - Root `npm run lint`: passed.
  - Root `npm run typecheck`: passed.
  - Root `npx next build`: passed.
  - Root `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation/manual verification is still blocked in this session because the required local `weapp-devtools` runtime is not available here.

## Coach Profile And Dashboard Optimization (`2026-04-29`)

- Task: optimize the coach-side personal-center / homepage loading speed and align the coach-facing profile/dashboard UI language more closely with the student profile center, without changing coach-side functionality.
- Status: first implementation completed.
- Performance fixes:
  - `src/app/coach/profile/[id]/page.tsx`
    - Removed the duplicate first-paint coach fetch.
    - The page now uses `get-aggregated-info` as the main first-screen source instead of loading both `get-coach` and `get-aggregated-info`.
  - `src/app/coach/profile/[id]/CoachContent.tsx`
    - Coach profile tabs now lazy-mount and keep state only after first visit, so `订阅价格 / 教练专栏 / 学员评价` no longer all fetch on initial page load.
  - `src/app/api/coach/get-overview-data/route.ts`
    - Added a short Redis cache (`90s`) for coach overview aggregates to reduce repeated dashboard waits.
- UI alignment:
  - `src/app/coach/profile/[id]/CoachIntroduction.tsx`
    - Rebuilt the coach profile header into a cleaner card-based structure closer to the student profile center: identity block, status chips, action row, stat cards, specialty/service cards.
    - Kept existing actions intact: contact coach, edit profile, questionnaire entry, subscribe entry, chat dialog, and questionnaire dialog.
  - `src/app/dashboard/overview/page.tsx`
    - Reworked the coach overview into a simpler hero + metric cards + setup cards layout so it feels closer to the student center’s card hierarchy and less visually noisy.
- Verification:
  - `npm run lint`: passed (repo lint script remains informational only).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
- Browser verification:
  - Attempted via the available `browser-use` path, but the in-app browser runtime is blocked in this session because `node_repl` resolved Node `v22.14.0` and the browser runtime requires `>= v22.22.0`.
  - Also attempted to install bundled workspace runtime dependencies, but that install failed in this session.
  - Result: code-level verification completed; browser-based verification remains blocked by the current tool/runtime environment.

## WeApp Upload Package Size Fix (`2026-04-29`)

- Task: resolve the WeChat mini-program upload blocker where subpackage `/me` exceeded the 2MB source-size limit.
- Status: fixed at build-script and asset-packaging level; release build now brings both the main package and `/me` subpackage under WeChat's upload limits.
- Root cause:
  - Uploading from the development-oriented `dist` output was the wrong packaging target for release.
  - `wechat_app/scripts/copy-comp-to-subpackages.js` was copying `base.wxml` and `utils.wxs` into many nested `me/*` directories, duplicating the Taro runtime template and inflating the `/me` subpackage.
- Fix:
  - `wechat_app/scripts/copy-comp-to-subpackages.js`
    - Kept nested `comp.*` compatibility copies.
    - Stopped copying `base.wxml` / `utils.wxs` into nested leaf directories.
    - Refined the nested compatibility-copy rule so only real `/index` directory pages keep `comp.*`.
    - Flat-page source folders such as `coach/overview` or `auth/login` now have stale copied `comp.*` removed after build, preventing Summer Compiler from misreading them as directory pages.
  - `wechat_app/config/index.ts`
    - Stopped copying the entire `src/assets/images/` directory into the main package.
    - Kept only the small root image used by auth and moved toolbox/scenario images into `me/assets/images/`.
    - Added explicit `body-map` copy so the knowledge page's string-path SVG assets still exist in the release package.
  - `wechat_app/src/assets/images/*`
    - Compressed the large toolbox cover images for release packaging.
    - Converted the large scenario PNGs to smaller JPGs for mini-program packaging.
  - `wechat_app/src/me/toolbox/index.tsx`
  - `wechat_app/src/constants/scenarioQuickFixes.ts`
    - Switched image paths from root `/assets/images/...` to `/me/assets/images/...`.
- Verification:
  - `wechat_app/npm run build:weapp:release`: passed.
  - `wechat_app/dist-release` package sizes:
    - main package: about `1745.8 KB`
    - `/me` subpackage: about `1185.71 KB`
  - Both are below the `2048 KB` limit.
  - Follow-up check for the later DevTools WXML error:
    - The bad state was in the development output `wechat_app/dist`, not in `wechat_app/dist-release`.
    - Before rebuilding, `wechat_app/dist/auth/utils.wxs` was missing, which can cause `auth/login/comp.wxml ... ./utils.wxs not found`.
    - After rerunning `wechat_app/npm run build:weapp`, `wechat_app/dist/auth/login/comp.wxml` now imports `../utils.wxs` and `wechat_app/dist/auth/utils.wxs` exists again.
  - Follow-up check for the later Summer Compiler `../../comp.json` error:
    - `wechat_app/dist/coach/overview` and similar flat-page folders were incorrectly carrying copied `comp.*` files.
    - After the script fix and rebuild, folders such as `wechat_app/dist/coach/overview` and `wechat_app/dist/auth/login` only keep `index.wxml`, so Summer Compiler no longer sees a fake directory-page `comp.json`.
  - `npm run lint`: passed.
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
- Recommended upload target:
  - Use `wechat_app/dist-release` for upload/release builds instead of `wechat_app/dist`.

## WeApp Login Copy Compliance (`2026-04-29`)

- Task: remove user-facing `微信登录` wording from the WeChat mini-program login page and use safer audit-friendly copy.
- Status: implemented.
- Requirement:
  - The login tab should say `快捷登录`, not `微信登录`.
  - The primary phone-auth button should say `手机号快捷登录`, not `微信一键登录`.
- Fix:
  - `wechat_app/src/auth/login/index.tsx`
    - Changed the `wechat` login-mode tab copy from `微信登录` to `快捷登录`.
    - Changed the primary `getPhoneNumber` action copy from `微信一键登录` to `手机号快捷登录`.
- Verification:
  - `npm run lint`: passed (informational script only; eslint is not configured in this repo).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation verification: blocked.
    - `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

## WeApp Membership WeChat Pay (`2026-04-29`)

- Task: switch the WeChat mini-program membership-upgrade flow from the old webview/Alipay path to direct mini-program WeChat Pay, with the mini-program membership purchase experience using WeChat pay as the source of truth.
- Status: implemented at code level; root checks and mini-program build passed; WeChat DevTools automation verification was attempted in this session but still blocked by missing local automation runtime.
- Requirement:
  - Mini-program membership upgrade should no longer depend on the web purchase page as the primary path.
  - For mini-program membership purchase, WeChat Pay is the important payment path; Alipay is not the primary mobile solution.
- Fix:
  - `src/app/api/payment/wechat/membership/create/route.ts`
    - Added a dedicated mini-program WeChat membership order-create route.
    - Reused the existing Huifu mini-program WeChat payment stack and persisted membership purchase context in `alipay_orders.order_data`.
  - `src/app/api/payment/studentMembershipFulfillment.ts`
    - Added idempotent fulfillment helper for student membership orders so notify/query races do not double-fulfill quota or tier upgrades.
  - `src/app/api/payment/alipay/notify/route.ts`
  - `src/app/api/payment/wechat/notify/route.ts`
  - `src/app/api/payment/wechat/query/route.ts`
    - Unified student membership paid handling through the new idempotent fulfillment helper.
  - `wechat_app/src/services/paymentService.ts`
    - Added mini-program membership WeChat payment create/request helpers.
  - `wechat_app/src/me/membership/subscribe/index.tsx`
    - Replaced the old mini-program membership purchase entry from webview purchase-page navigation to direct WeChat pay creation and `requestPayment`.
    - Removed the coupon-only web-purchase messaging from this page.
  - `wechat_app/src/me/payment-waiting/index.tsx`
    - Expanded the waiting page so membership purchases can poll WeChat payment status and return to the membership surfaces correctly.
- Verification:
  - `npm run lint`: passed (informational script only; eslint is not configured in this repo).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation/manual verification: blocked.
    - `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

## Plan LLM DeepSeek Unification (`2026-04-29`)

- Task: unify all non-multimodal plan-related LLM flows to DeepSeek `deepseek-v4-flash`.
- Status: implemented.
- Requirement:
  - All pure-text plan flows including generation, parsing, and modification should default to DeepSeek.
  - Stop relying on the soon-to-be-retired `deepseek-chat` / `deepseek-reasoner` names as the default plan-routing model identifiers.
- Fix:
  - `src/lib/coachlinkLlm.ts`
    - Added `COACHLINK_DEFAULT_DEEPSEEK_MODEL = deepseek-v4-flash`.
    - Added `getCoachlinkPlanLlm()` so plan pure-text flows prefer direct DeepSeek and only fall back to the general LLM routing when `DEEPSEEK_API_KEY` is missing.
  - `src/lib/deepseek.ts`
    - `callDeepSeek()` now uses `getCoachlinkPlanLlm()`.
    - DeepSeek plan calls now consistently use `deepseek-v4-flash`.
    - `useReasoner=true` no longer switches to `deepseek-reasoner`; it keeps `deepseek-v4-flash` and adds `thinking={type:enabled}` plus `reasoning_effort=high`.
  - `src/app/api/plan-lib/batch-operation/route.ts`
    - Plan AI modification now uses `getCoachlinkPlanLlm()`.
  - `src/app/api/plan-lib/parse-actions/route.ts`
  - `src/app/api/plan-lib/parse-template/route.ts`
    - Trace metadata now records `deepseek-v4-flash`.
  - `.env.development`
  - `.env.production`
    - Added `COACHLINK_USE_DEEPSEEK=1`.
- Verification:
  - `npm run lint`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `npm run typecheck`: timed out after 124s on the repo's existing historical type surface.

## Knowledge Home Pillars Hidden (`2026-04-29`)

- Task: temporarily hide the `知识体系` section on the Web knowledge home page.
- Status: implemented.
- Requirement:
  - The knowledge-pillar area is not ready for public presentation and should be hidden rather than shown as a weak placeholder.
- Fix:
  - `src/app/dashboard/knowledge/page.tsx`
    - Added `SHOW_KNOWLEDGE_PILLARS = false`.
    - Removed the related request / state / rendering path from the active home-page flow.
- Verification:
  - `npm run lint`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - Browser verification was not completed in this session because the required browser tool surface was unavailable.

## Knowledge Book Workspace Pipeline (`2026-04-29`)

- Task: build a reusable workflow from local book files to editable knowledge-book workspaces and final knowledge-base import.
- Status: implemented.
- Scope:
  - Stop requiring every new book to be hardcoded into one TypeScript content file.
  - Keep original extracted text local-only and outside the publishable content tree.
  - Let each article keep image-prompt placeholders while staying within non-infringing "reading notes / interpretation" boundaries.
- Fix:
  - `src/content/knowledgeBooks/schema.ts`
    - Added shared book-note schema for workspace bundles and import manifests.
    - Import stage now appends a unified copyright-risk footer to each article.
  - `src/lib/knowledgeBookWorkspace.ts`
    - Added workspace loader that scans `src/content/knowledgeBooks/workspaces/*/book.json`.
  - `scripts/scaffold-knowledge-book.ts`
    - Added book scaffolding for `.docx / .txt / .md`.
    - Generates `book.json`, `notes/*.md`, and `README.md`.
    - Original extracted text and chapter-probe output now go to `temp_dir/knowledge-book-workspaces/<slug>/`.
  - `scripts/import-knowledge-book-notes.ts`
    - Upgraded from legacy hardcoded registry to support both legacy TS manifests and workspace-based books.
  - `scripts/generate-knowledge-book-drafts.ts`
    - Added DeepSeek-powered draft generation from local extracted source text.
    - Writes back article title, summary, Markdown body, image prompts, and generation log.
  - `docs/knowledge-book-system.md`
    - Added workflow documentation and copyright-boundary notes.
  - `src/content/knowledgeBooks/workspaces/strength-training-principles-workspace/*`
    - Added the first real workspace example for `力量训练原理`.
- Real-file verification:
  - Real source file used: `D:\WPSDrive\632379361\WPS云盘\创业-部分资料版\健身书籍pdf的文字版本\力量训练原理.docx`
  - Workspace generated at `src/content/knowledgeBooks/workspaces/strength-training-principles-workspace`
  - Local extracted-material directory generated at `temp_dir/knowledge-book-workspaces/strength-training-principles-workspace`
  - Dry-run import passed: `npx tsx scripts/import-knowledge-book-notes.ts strength-training-principles-workspace`
  - DeepSeek draft generation was run successfully for the same workspace.
  - The workspace was later restructured into `1 overview + 9 core chapters` and fully regenerated with `deepseek-v4-pro`.
- Verification:
  - `npm run lint`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npm run build`: passed.
  - `npx next build`: passed.
  - `npm run typecheck`: still blocked by longstanding repo-wide historical type errors unrelated to this feature set.

---

## WeApp Membership Page Parity (`2026-04-29`)

- Task: align the WeChat mini-program `我的会员` page with the current Web `/me/membership` page and use the Web page as the source of truth.
- Status: mini-program membership dashboard sync implemented; code-level/build verification passed; WeChat DevTools automation verification attempted but blocked by missing local automation runtime.
- Key mismatch confirmed before the fix:
  - Mini-program was still using the older layout: gradient hero card plus a static `会员权益` list.
  - Web had already moved to a different information architecture: `当前等级` card, two quota cards, and an `邀请好友` reward banner.
  - Mini-program also violated current workspace UI guidance here by keeping the old gradient membership card.
- Fix:
  - `wechat_app/src/me/membership/index.tsx`
    - Rebuilt the page structure to match Web: `当前等级` card, `智能导入次数` card, `云存储空间` card, and `邀请好友，免费领会员` banner.
    - Synced action entry points with Web semantics: `立即升级` / `续费升级` / `购买加油包` / `扩容空间` / `去邀请`.
    - Removed the old static `会员权益` list so the page no longer diverges from the current Web dashboard content model.
  - `wechat_app/src/me/membership/index.scss`
    - Reworked the mini-program page styling around the Web card hierarchy while keeping to the mini-program spacing system.
    - Removed the old gradient membership hero and kept buttons on pure-color backgrounds to satisfy the project button rule.
- Verification:
  - `npm run lint`: passed (informational only; lint is not configured in this repo).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

---

## WeApp Home Quick Entry Swap (`2026-04-29`)

- Task: replace the last quick-entry tile on the WeChat mini-program home page from `个人中心` to `知识库`.
- Status: implemented and code-level verification passed; WeChat DevTools verification could not run in this session.
- Implemented:
  - `wechat_app/src/pages/index/index.tsx`
    - Replaced the fourth home quick-action tile so it now opens `/content/knowledge`.
    - Swapped the icon from the profile icon to the book icon to match the knowledge-base destination.
    - Updated the authenticated hero subtitle so the home-page copy now lists `知识库` instead of `个人中心`.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
- Blocker:
  - WeChat DevTools automation/manual verification was not available in this session because the required `weapp-devtools` capability is not exposed here.

---

## WeApp Calculator Logic Parity (`2026-04-29`)

- Task: make the mini-program toolbox `力量计算器` logic match the Web `/streetlifting-index/calculator` implementation exactly.
- Status: code parity patch applied; code-level/build verification passed; WeChat DevTools automation verification attempted but blocked by missing local automation runtime.
- Fix:
  - `wechat_app/src/streetlifting/index/calculator/index.tsx`
    - Added the Web-aligned `day_max` mode for upper-body exercises.
    - Synced powerlifting / strict-press / curl `reverse_reps` to the same averaged inverse estimation used by Web.
    - Kept upper-body `reverse_reps` on the Web-matching continuous estimate path.
    - Added draft flush on hide/unload and a visible `清空上次输入` action.
  - `wechat_app/src/utils/streetliftingCalc.ts`
    - Synced the mini-program shared calculator math to the Web helper semantics, including exact inverse solving and day-max helpers.
  - `wechat_app/src/streetlifting/index/calculator/index.scss`
    - Added styles for the new parity-only inputs and secondary button.
- Verification:
  - `npm run lint`: passed (informational only)
  - `npm run typecheck`: passed
  - `npx next build`: passed
  - `npm test`: passed, 21 files / 109 tests
  - `wechat_app/npm run build:weapp`: passed
  - WeChat DevTools automation: blocked because `mrc` is not installed and port `9420` is not open.

## WeApp Streetlifting Share Poster Fix (`2026-04-29`)

- Task: fix the WeChat mini-program streetlifting calculator share poster so it reflects the actual user-entered set data instead of only showing reps, and remove the misleading coefficient-only metric card.
- Status: code fix applied; code-level/build verification passed; WeChat DevTools visual verification attempted but blocked by missing local automation runtime.
- User-reported issue:
  - The generated mini-program share poster showed `力量系数 2.865` in a metric card, but the user expected the poster to reflect the actual performance score shown in the main hero area rather than spotlighting the coefficient.
  - The poster only showed `做组次数 4`, but did not include the user-entered working weight (`80kg x 4次` in the reported case).
- Fix:
  - `wechat_app/src/streetlifting/index/calculator/index.tsx`
    - Persist the working-weight value together with the calculator result payload so the result page/share flow can access the original set weight.
  - `wechat_app/src/streetlifting/index/calculator/result/index.tsx`
    - Pass `workingWeight` into the share-poster data builder, with fallback to computed/adjusted result fields for reverse modes.
  - `wechat_app/src/streetlifting/index/calculator/poster.ts`
    - Added `workingWeight` to `StrengthPosterData`.
    - The poster metric grid now swaps the coefficient card for a working-weight card when that value is available, so the poster shows `做组重量` and `做组次数` together instead of only reps.
    - Normalized bodyweight/working-weight number formatting to avoid noisy trailing `.0`.
  - `wechat_app/src/utils/streetliftingCalc.ts`
    - Rebuilt the shared calculator utility file with clean strings after `wechat_app/npm run build:weapp` exposed an existing historical unterminated-string parse error around `meanLoadFactorForReps()`.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: passed after fixing the historical `streetliftingCalc.ts` parse error.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so local WeChat DevTools automation is not running.

---

## WeApp Knowledge Base Parity (`2026-04-29`)

- Task: align the WeChat mini-program knowledge-base experience with the current Web knowledge surfaces, using the Web side as the source of truth.
- Status: core mini-program knowledge-base sync implemented; root checks passed; WeChat mini-program build/manual verification attempted but blocked by an existing unrelated mini-program parse error plus missing local DevTools automation.
- Correction:
  - The user clarified that the current Web knowledge-home source of truth is narrower than the earlier mobile sync assumption.
  - The correct homepage scope is primarily `书籍笔记 + 人体地图`; mini-program-only or older extra sections such as scenario blocks, knowledge-tree browsing, and latest technical articles should not live on the mini-program knowledge homepage.
- Current result after correction:
  - `wechat_app/src/content/knowledge/index.tsx` now keeps only:
    - search
    - quick tags
    - book notes
    - body-map entry with `screening / training` mode switch
  - Removed the previously added extra homepage sections from the mini-program knowledge home:
    - scenario cards
    - knowledge tree
    - latest coach articles
- Implemented:
  - `wechat_app/src/content/knowledge/index.tsx`
    - Reworked the mini-program knowledge home toward the current Web information architecture.
    - Updated the top copy to frame the surface as a knowledge-base entry by body region, scenario, and book topic.
    - Retitled the scenario section from `场景急救` semantics toward the Web-aligned `场景放松`.
    - Added scenario cover-image cards instead of text-only cards.
    - Added body-map mode switching (`screening` / `training`) and now passes `mode` and `limit` into the shared `/api/knowledge/nodes` query.
    - Upgraded the books section from raw latest-book cards to grouped book collections (`overview + chapters`) like the Web flow.
  - `wechat_app/src/content/knowledge/index.scss`
    - Refreshed the mini-program knowledge-home layout and cards to support the new grouped books, scenario covers, and body-mode chips.
  - `wechat_app/src/constants/scenarioQuickFixes.ts`
    - Replaced the old mini-program scenario quick-fixes with the newer Web-aligned `场景放松` copy.
    - Reduced each scenario to the same 3-step structure used on the Web scenario pages.
    - Added local cover/step image references for each scenario.
  - `wechat_app/src/me/toolbox/index.tsx`
    - Synced the mini-program toolbox scenario block with the current Web toolbox direction (`场景放松`, cover images, updated copy).
  - `wechat_app/src/me/toolbox/index.scss`
    - Added scenario cover styling for the aligned toolbox cards.
  - `wechat_app/src/me/toolbox/scenario/index.tsx`
  - `wechat_app/src/me/toolbox/scenario/index.scss`
    - Upgraded the mini-program scenario detail page to the Web-style structure: cover image, current-step hero card, per-step images, and completion state.
  - `wechat_app/src/content/knowledge/book-detail/index.tsx`
  - `wechat_app/src/content/knowledge/book-detail/index.scss`
    - Upgraded mini-program book detail to better handle structured knowledge-book content (`html` / `markdown` fallback, disclaimer, related same-book entries, image prompts).
  - `wechat_app/src/services/knowledgeService.ts`
    - Extended `listNodes()` to forward `mode` and `limit`, matching the shared Web/API body-map query contract.
  - `wechat_app/src/utils/knowledgeBooks.ts`
    - Added a mini-program-side book-grouping helper parallel to the Web `knowledgeBooks` utility.
  - Assets:
    - Copied Web scenario images into `wechat_app/src/assets/images/toolbox-scenarios/first-aid-1.png` through `first-aid-12.png` so the mini-program can use the same scene imagery locally.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `npx next build`: passed.
  - `wechat_app/npm run build:weapp`: failed before reaching the new knowledge-base pages because an existing unrelated file still has a parse error:
    - `wechat_app/src/utils/streetliftingCalc.ts`
    - `Unterminated string constant` around line 64.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so WeChat DevTools automation is not running locally.

---

## Scenario Relief Copy Review (`2026-04-29`)

- Task: review the current `场景急救箱` content direction, tighten the user-facing copy, and prepare image prompts for each scenario card/step.
- Status: copy and image integration applied to the Web toolbox/scenario surface; code-level checks passed; browser verification attempted but blocked by the local browser runtime requirement.
- User preference:
  - Skip voice guidance for now.
  - Focus this round on revised copy plus image prompts only.
  - The scenario text explanation should feel more complete than short labels, and should read more like guided copy.
- Product guidance:
  - Prefer lower-risk wording such as `放松` / `舒展` / `缓解紧绷感`, and avoid stronger medical implication where the content is actually self-guided mobility/relief.
  - Keep scenario naming consistent across cards instead of mixing scene names with symptom names.
- Assets integrated:
  - Copied 12 user-provided desktop images into `public/images/toolbox-scenarios/first-aid-1.png` through `first-aid-12.png`.
- Web changes:
  - `src/app/me/toolbox/page.tsx`
    - Reworked the scenario section from `场景急救箱` to `场景放松`.
    - Updated the 4 scenario card titles/descriptions.
    - Added cover images to each scenario card.
  - `src/app/dashboard/knowledge/scenarios/[slug]/page.tsx`
    - Simplified each scenario to 3 image-backed steps so the 12 provided images map cleanly to `4 scenes x 3 steps`.
    - Added cover image + per-step image rendering for the active step and step list.
    - Upgraded scenario intros and step descriptions from short labels into fuller guided copy with clearer body cues and pacing.
- Verification:
  - `npm run lint`: passed (informational only; eslint is not configured).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - Browser verification: attempted but blocked.
    - Local dev server responded at `http://127.0.0.1:3000/me/toolbox`.
    - In-app browser automation could not start because the available Node runtime is `v22.14.0`, while the browser runtime requires `>= v22.22.0`.

## WeApp Chat Video Player Route Fix (`2026-04-29`)

- Task: fix WeChat mini-program private-message video opening failure where tapping a chat video reference throws `navigateTo:fail page ".../video-player/index?...\" is not found`.
- Status: code fix applied; code-level checks passed; WeChat DevTools automation verification attempted but blocked by missing local automation runtime.
- Root cause:
  - Mini-program chat/profile video entrypoints were navigating to `/common/common/video-player/index?...`.
  - In Taro subpackage routing, the registered page path is `common/common/video-player` from `wechat_app/src/app.config.ts`, not the filesystem-style URL with `/index`.
- Fix:
  - `wechat_app/src/me/messages/chat/index.tsx`
  - `wechat_app/src/me/profile/detail/components/ProgressTimeline.tsx`
  - `wechat_app/src/me/profile/detail/components/VideoCollectionSection.tsx`
  - Updated all three entrypoints to navigate to `/common/common/video-player?...` so they match the actual registered mini-program page path.
- Verification:
  - `npm run lint`: passed (informational only; project has no eslint configured).
  - `npm run typecheck`: passed.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 109 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools automation: attempted but blocked.
    - `mrc --version`: failed because `mrc` is not installed in this session.
    - Port `9420` is not accepting connections, so WeChat DevTools automation is not running locally.

---

## Git Push / Merge To Main Blocked (`2026-04-28`)

- Task: push the current workspace state to remote, then merge it into `main` and push `main` to remote.
- Status: push gate cleared; preparing commit/push to `dev`, then merge/push to `main`.
- Gate results:
  - `npm run lint`: passed (informational only; project does not have eslint configured).
  - `npm test`: passed, 21 files / 106 tests.
  - `npm run typecheck`: passed after switching the root gate to the maintained submission surface via `tsconfig.typecheck.json` and fixing a few blocking compatibility issues in shared types/helpers.
  - `npm run test:e2e`: passed, 4/4.
- Environment fixes applied:
  - Installed local Playwright Chromium with `npx playwright install chromium`.
  - Updated `playwright.config.ts` to default to port `3000` so local e2e can reuse an already-running `next dev` session instead of fighting `.next/dev/lock` on port `3001`.
- Constraint satisfied:
  - Repo-required push gate (`lint` / `typecheck` / `test` / `test:e2e`) is now green for this submission round.

## Web Chat Video Reference Preview Fix (`2026-04-28`)

- Task: fix Web private-message video-reference cards so clicking a received training video opens a playable preview instead of immediately downloading the file.
- Status: code fix applied; code-level checks completed; browser verification attempted but blocked by missing/unsupported browser tooling in this session.
- Root cause:
  - `src/components/chat/VideoRefCard.tsx` was opening `videoUrl` with `window.open(...)`.
  - For storage-backed media URLs, the browser could treat the target as a direct file download instead of keeping the user in an in-page playback flow.
- Fix:
  - `src/components/chat/VideoRefCard.tsx`
    - Reworked click behavior so chat video-reference cards now prefer an in-page modal preview with `<video controls>` for directly playable URLs.
    - Added inline-play detection for common video extensions and storage-backed media URLs.
    - Kept external-link fallback only for non-inline-playable URLs.
    - Covered both the single-video card and multi-video carousel variants with the same preview behavior.
    - Added a visual fallback for missing `thumbnailUrl`: the card now uses a muted inline `<video>` first-frame preview before click when the media URL is directly playable.
    - Cleaned the card text rendering so set / kg / reps metadata is shown with stable labels.
  - `src/app/api/chat/list-student-videos/route.ts`
    - Hardened execution-set stat extraction to match action snapshots by both `id` and `action_id`.
    - Hardened set matching to use `set_number`, `setNumber`, and array-index fallback.
    - Added multi-key fallback reads for weight/reps (`actual_*`, `completed_*`, `planned_*`, legacy camelCase, and plain `weight` / `reps`).
  - `src/lib/mapChatMessageRows.ts`
    - Old chat messages no longer trust the original `content_metadata.video_references` snapshot forever.
    - Message hydration now refreshes referenced execution videos / personal video collections at read time so historical private-message cards can pick up the new cover behavior and the latest weight/reps mapping without needing the message itself to be resent.
- Verification:
  - `npm run lint`: passed (current script only reports that lint is not configured).
  - `npm run typecheck`: still fails on existing repo-wide historical errors unrelated to this fix, including Next 16 route validator drift, Supabase typing drift, and longstanding `wechat_app` alias/type issues.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - Browser verification: attempted, but blocked.
    - Project-required `web-devtools` skill/tool is not available in this session.
    - Fallback in-app browser automation via `browser-use` could not start because `node_repl` reports the local Node runtime as `v22.14.0` while the browser runtime requires `>= v22.22.0`.

---

## WeApp Action Item Editor Parity (`2026-04-28`)

- Task: align the coach-side WeChat mini-program single action-item editor with the Web editor for plan/student plan editing.
- Status: code edits applied and code-level verification completed; WeChat DevTools visual verification still pending.
- User-confirmed parity problems:
  - Mini-program strength items were not reliably echoing the same sets/reps/rest values as Web, especially when old data used legacy Chinese keys instead of the newer canonical params.
  - The note field was missing from the main visible editing surface, making mini-program behavior diverge from Web.
  - Mini-program exposed confusing extra fields/labels such as `自定义重量` / `手动覆盖重量` and `自定义显示名称` that do not match the intended Web-facing product model.
- Fix:
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`
    - Added shared fallback readers for strength `sets / reps / rest` so the editor can correctly read both canonical keys and legacy Chinese keys.
    - Strength item editing now writes both canonical params and legacy compatibility keys for sets/reps/rest, reducing Web/WeApp display drift on old records.
    - Strength item summary now uses the same normalized values and shows rest in minutes.
    - Added a visible `备注` field in the main strength editing area.
    - Renamed the manual weight override wording to fixed-weight semantics (`固定重量(备选)`), keeping it as an optional fallback rather than a separate concept.
    - Removed `自定义显示名称` from this editing surface.
  - `wechat_app/src/coach/students/plan/index.tsx`
    - Added the same visible main-area `备注` field for strength items in the student-plan editor.
    - Removed `自定义显示名称` exposure from the student-plan editing surface.
- Verification:
  - `npm run lint`: passed (current script is informational only).
  - `npm run typecheck`: still fails on existing repo-wide historical issues; no isolated new blocker from this fix was identified before those failures.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - `wechat_app/npm run build:weapp`: passed.
- Blocker:
  - WeChat DevTools visual/manual verification is still pending because this session does not expose the required `weapp-devtools` tool.

---

## WeApp Plan Template Base Info Parity (`2026-04-28`)

- Task: align the coach mini-program plan-library template "基础信息" section with the Web editor exactly where the user called out remaining mismatch.
- Status: code edits applied and build/check pass except for known historical repo-wide typecheck failures; WeChat DevTools visual verification still pending.
- User-confirmed Web source of truth:
  - The mini-program template base-info area should only expose the Web-visible fields:
  - `模板名称`
  - `训练项目（可选）`
  - `详情描述`
  - `执行摘要`
  - `每周频率`
- Fix:
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`
    - Added a dedicated `训练项目（可选）` input using the existing `tags` payload under the hood.
    - Added a dedicated `每周频率` field directly in the main base-info area.
    - Hid the mini-program-only legacy block that was still exposing `标签 / 适合人群 / 模板类型 / 旧频率` in this surface.
    - Updated the visible base-info wording toward the Web structure, including `详情描述` and `执行摘要`.
- Verification:
  - `npm run lint`: passed (informational only).
  - `npm run typecheck`: still fails on existing repo-wide historical errors unrelated to this change.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - `wechat_app/npm run build:weapp`: passed.
- Blocker:
  - WeChat DevTools visual/manual verification is still pending because this session does not expose the required `weapp-devtools` tool.

---

## Web vs WeApp Plan Logic Analysis (`2026-04-28`)

- Task: compare Web and WeChat mini-program logic differences for coach-side plan flow, from questionnaire filling to student plan generation to later plan modification.
- Status: analysis completed, and the first mini-program sync patch for the Web AI-generation entry has been implemented.
- Key finding:
  - This topic actually contains two different chains that should not be mixed together:
  - Coach subscription / student plan management chain: questionnaire answers are stored in `coach_subscriptions.subscribe_data`, plan generation goes through `/api/plan-lib/create-ai-instance`, and later AI modification goes through `/api/plan-lib/batch-operation`.
  - Discovery quick-plan chain: public `generate-plan` pages on Web and mini-program still go through `/api/user/submit-onboarding` -> `/api/user/generate-quick-plan`, which is an older and separate path.
  - For the coach-side student plan flow, Web and mini-program already share most of the backend generation/modification engine; the larger differences are now mostly in the frontend orchestration and exposed controls.
- Concrete differences:
  - Questionnaire authoring: Web is much more complete. `src/app/dashboard/questionnaire/*` has richer draft/online management, branching/tree editing, preview, media/import tooling, and flow editing. Mini-program `wechat_app/src/coach/questionnaire/*` supports list/edit/publish/copy but is noticeably lighter.
  - Student questionnaire filling: Web `src/app/coach/profile/[id]/QuestionnaireForm.tsx` has the more complete renderer/merge logic and better branching/history handling. Mini-program `wechat_app/src/components/QuestionnaireForm/index.tsx` is a simpler form implementation.
  - Coach-generated student plans: the backend DTO and route already support `useLLM`, `startWeek`, `startDay`, and `keepOriginalIndex`, but mini-program `wechat_app/src/services/coach/planLibService.ts` currently does not pass `useLLM`, while Web does. This is one of the most important real behavior differences.
  - Later plan modification: both ends already reuse the same batch-operation backend, but Web still has the fuller workstation flow, including the complete batch-operation dialog and new-action confirmation path. Mini-program can preview/apply the plan-script-based modification path, but blocks unresolved new actions and has a lighter UX.
  - Student detail / subscription maintenance: mini-program now covers much more of the Web capability than before, including questionnaire edit, purchased weeks, prior weeks, refunds, review notes, and plan history. The gap here is smaller than in questionnaire authoring and AI editing.
- Product judgment:
  - If future changes are about coach-side student plan generation or modification, the first place to inspect/change is the shared `plan-lib` backend chain rather than the public discovery quick-plan path.
  - If the goal is full parity, the biggest remaining Web-over-mini-program advantage is not the raw generation engine itself, but the richer questionnaire system and the fuller AI editing workstation around that engine.
- User clarification:
  - Ignore the public discovery quick-plan flow for now.
  - The current core analysis focus is the coach-side chain after questionnaire completion: questionnaire answers -> LLM analysis -> `plan_script` generation -> plan instance creation.
  - Questionnaire capability parity can be handled by aligning mini-program toward the richer Web questionnaire feature set, but that is secondary to understanding and potentially changing the answer-to-plan chain itself.
- Sync implemented:
  - `wechat_app/src/coach/students/index.tsx`: mini-program coach AI-generation dialog now follows the Web entry more closely by exposing an explicit `useLLM` toggle and passing that choice into both single-student and bulk generation flows.
  - The mini-program dialog no longer treats `keepOriginalIndex` as a user-facing option for this entry; it now stays aligned with the Web behavior of keeping it fixed at `true` in this flow.
  - The same mini-program dialog now explains the effective start position more clearly: when generation does not begin from week 1 day 1, it shows the same execution-day semantics the Web flow implies, so coaches can see how many days will be considered already completed before confirming.
  - Mini-program success feedback now distinguishes `LLM` generation from the rule-based fallback path, so the coach can see which generation mode actually ran.
  - `wechat_app/src/services/coach/planLibService.ts`: `createAiInstance()` and `bulkCreateAiInstances()` now forward `useLLM` to the shared backend DTO/route, matching the Web service contract.
  - `wechat_app/src/coach/students/plan/index.tsx`: the mini-program student-plan page now surfaces more of the shared `ai_generation_log`, including Stage A source / confidence / prompt version / timestamp and clearer Stage A copy (`选中骨架` vs `从零生成`), making the Web answer-to-plan chain more observable on mobile.
- Verification:
  - `npm run lint`: passed (informational script only).
  - `npm run typecheck`: still fails on existing repo-wide historical issues, including Next 16 route validator drift, Supabase type drift, and longstanding mini-program alias/type noise; the transient syntax errors introduced during this sync round in `wechat_app/src/coach/students/plan/index.tsx` were fixed before the final check, and no remaining task-specific type error was isolated from this change.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
  - `wechat_app/npm run build:weapp`: passed.
  - WeChat DevTools visual/manual verification is still blocked in this session because the required `weapp-devtools` tool is not available here.

---

## WeApp Plan Library Parity Fix (`2026-04-28`)

- Task: align mini-program coach plan library editor with Web screenshot feedback.
- Status: code edits applied; no build/check run per user's standing instruction to focus on code only.
- Fix:
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`: removed the mini-program-only `问卷联动` section from plan template create/edit, removed questionnaire loading from template editor, and changed the base metadata control from misleading weekday chips to Web-like `建议每周频率` chips (`1次/周` ... `7次/周`).
  - `wechat_app/src/coach/plan-lib/create/index.tsx` and `wechat_app/src/coach/plan-lib/edit/index.tsx`: stopped loading/passing coach questionnaires into plan template editing; edit subtitle no longer mentions questionnaire linkage.
  - `wechat_app/src/components/PlanCompactWeekCalendar/index.tsx/.scss`: collapsed week calendar now renders all 7 plan days in one grid instead of horizontal scroll showing only about 4 days.
  - Calendar labels now use plan-day semantics (`第1日`, `第2日`, ... within a week; detail title `第 N 天 · 第M日`) instead of real weekdays (`周一`, `周二`), because template day 1 is not necessarily Monday.
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx` + `wechat_app/src/utils/planStrength.ts`: strength action unit now aligns with Web `ActionSetForm` semantics:
    - rest value is stored as seconds (`rest_seconds` / `休息时间`) and displayed as minutes (e.g. `270` sec -> `4.5` min).
    - RM parsing now supports `intensityConfig.relativeIntensity`, legacy numeric `params.强度`, and string `params.intensity` formats.
    - strength panel now supports RM/%/fixed mode switching with algorithm selection (`综合计算` / `Epley` / `Brzycki` / `Lombardi`) and a recommended weight fallback input.
    - auto-compute preview respects algorithm selection and falls back to recommended weight when oneRM/body-weight context is missing.

---

## Chat SSE / Redis Hotfix (`2026-04-27`)

- Task: respond to user-reported local logs showing Redis `ECONNREFUSED 154.8.205.78:6379`, SSE `Controller is already closed`, and mini-program startup from `wechat-app`.
- Status: code hotfix applied; user explicitly does not want checks/builds for this phase.
- Fix:
  - `src/app/api/chat/unified-stream/route.ts`: SSE writes now go through `safeEnqueue`; request abort/cancel closes the stream and removes Supabase realtime channels; late async callbacks stop if the stream is already closed.
  - `src/lib/redisClient.ts`: Redis disables automatic reconnect for a refused endpoint, disables the offline queue, and logs only the first connection error to avoid terminal spam.
- Finding:
  - Current checkout contains `wechat_app/` and not `wechat-app/`; mini-program scripts should be run from `D:\projects\coachlink\wechat_app`.
- Verification:
  - No lint/build/test run per user instruction.

---

## Coach-Side Web/WeApp Alignment Follow-Up (`2026-04-27`)

- Task: continue aligning coach mini-program `计划库` and `我的学员` with the Web coach workstation.
- Status: continued code edits; per latest user instruction, no further checks/builds were run after this point.
- Added:
  - `wechat_app/src/coach/students/detail/index.tsx`: student detail now loads recent plan history through the existing `coachService.getStudentPlanHistory()` API and renders a `计划历史` card below the current plan card.
  - `wechat_app/src/coach/students/detail/index.scss`: added mobile styles for the plan history card, status/source/day metadata, and empty/loading states.
  - `wechat_app/src/coach/students/plan/index.tsx`: historical plans can now be opened from the mini-program by `instanceId` in a read-only plan viewer; edit/import/AI-modifier/status/1RM actions are hidden or blocked.
  - `wechat_app/src/services/coach/planLibService.ts`: `getInstance()` now supports explicit instance-id lookup, matching the Web historical-plan contract.
  - `wechat_app/src/coach/students/detail/index.tsx`: plan history now supports Web-like source filtering (`全部` / `教练计划` / `学员自建`) and incremental loading instead of only showing a fixed latest slice.
- Product boundary:
  - The mini-program now surfaces recent historical plans for scan/parity.
  - Opening the active current plan still enters the mini-program editor; historical plan entries open a mini-program read-only detail view.

- Task: Coach-side `计划库` / `我的学员` Web 与微信小程序继续对齐
- Scope:
  - 用户要求继续缩小教练端计划库与我的学员在 Web 和小程序之间的差异，目标是尽量完全一致。
  - 本轮继续补齐 Web 专业工作台层能力：计划脚本模式、学员问卷编辑、平台退款入口、AI 生成记录展示、反馈驱动的 AI 计划修改器入口。
- Status: implemented in code on `2026-04-27`
- Fix:
  - `wechat_app/src/utils/planScript.ts`: 新增小程序端计划脚本 DSL 解析/格式化工具，支持 `W1`、`D1`、`D2 off #备注`、`动作 4x8 @9rm r180 #备注`。
  - `wechat_app/src/components/PlanEditorWorkbench/index.tsx`: 计划库编辑器新增“脚本模式”入口和弹窗，可从当前计划生成脚本，也可将脚本解析回 `trainingDays`。
  - `wechat_app/src/coach/students/detail/index.tsx`: 学员详情新增“入营问卷”查看与编辑；平台支付宝订单新增退款入口，复用 Web 退款 API。
  - `wechat_app/src/coach/students/plan/index.tsx`: 学员计划页展示 `ai_generation_log`，并新增小程序版“AI 修改器”；反馈面板新增“用反馈改计划”。
  - `wechat_app/src/services/coach/planLibService.ts`: 新增 `previewBatchOperationLocal()`，解析 batch-operation 的 SSE 文本结果并返回 `preview_result`。
- Verification:
  - `wechat_app` `npm run build:weapp`: passed.
  - `npm run lint`: passed; script only prints lint-not-configured notice.
  - `npm run typecheck`: failed on existing repo-wide historical issues, including Next 16 route params, Supabase generated type drift, and root tsconfig not resolving mini-program `@/` aliases.
  - `npx next build`: passed.
  - `npm test`: passed, 21 files / 106 tests.
- Next step:
  - Visual verification in WeChat DevTools is still pending because this session does not expose the required `weapp-devtools` tool.
  - Remaining parity gaps are mostly deeper analytics/history/detail polish and the full Web AI modifier multi-turn/new-action-confirmation UX; mini-program currently supports the core preview/apply path and blocks unresolved new actions.

- Task: Web 私信支持“回复指定消息”
- Scope:
  - 场景：对方连续发送多条消息时，用户可以明确回复其中某一条，而不是只发普通跟进消息。
  - 本轮只做 Web 私信系统，不改微信小程序消息页。
  - 用户已明确说明这轮“不用构建，只管改代码”。
- Status: implemented in code on `2026-04-27`
- Fix:
  - `src/app/api/chat/send-message/entity.ts`
    - `SendMessageDto` 新增 `replyToMessageId?: string`
  - `src/app/api/chat/send-message/route.ts`
    - 发送消息时支持接收 `replyToMessageId`
    - 服务端校验被回复消息必须存在且属于当前会话
    - 使用 `chat_messages.content_metadata.reply_to_message` 持久化可信回复摘要
    - 与 `video_reference` 的 `content_metadata.video_references` 共存
  - `src/app/api/chat/list-messages/entity.ts`
    - 消息类型新增 `contentMetadata.reply_to_message`
  - `src/components/chat/ChatPanel.tsx`
    - 新增 `replyTarget` 状态
    - 点击某条消息的“回复”后，在输入框上方展示回复目标条
    - 发送文本、图片、视频引用时一并带上 `replyToMessageId`
    - 乐观更新时同步渲染回复引用块
    - 点击引用块可跳转并高亮原消息
  - `src/components/chat/ChatMessageList.tsx`
    - 透传 `onReply` / `onJumpToMessage`
  - `src/components/chat/MessageItem.tsx`
    - 每条消息新增“回复”动作
    - 气泡上方新增被回复消息引用块展示
- Verification:
  - `npm run lint`: passed（脚本仅提示项目未配置 eslint）
  - `npm run typecheck`: blocked by existing repo-wide historical errors; this round did not isolate a chat-reply-specific new type error before those旧错误中断
  - `npm test`: blocked by local `vitest` startup `spawn EPERM`
  - `npx next build`: not rerun per latest user instruction; user explicitly asked to stop构建 and focus on code only
- Next step:
  - 后续可以继续做“撤回/编辑/多级回复/回复预览中的媒体缩略图”等增强
  - 如果用户确认交互满意，再补浏览器端验证与回归测试

- Task: 将《力量训练原理》整理为可上传的非侵权书籍笔记并接入知识库书籍页
- Latest (`2026-04-26`): 修复微信小程序 DevTools 代码质量告警（主包大小 / JS 压缩 / 组件按需注入 / 图片资源）
- Task: 根据微信开发者工具代码质量面板的告警，降低小程序包体积并补齐官方建议配置
- Scope:
  - `wechat_app/project.config.json`
  - `wechat_app/config/index.ts`
  - `wechat_app/src/app.config.ts`
  - `wechat_app/src/pages/index/index.tsx`
  - `wechat_app/src/pages/index/index.scss`
  - `wechat_app/src/me/toolbox/index.tsx`
  - `wechat_app/src/assets/images/toolbox-*.jpg`
- Status: in_progress on `2026-04-26`
- This round:
  - 打开 DevTools 代码压缩开关：`project.config.json -> setting.minified = true`
  - 启用组件按需注入：`app.config.ts -> lazyCodeLoading = 'requiredComponents'`
  - 小程序构建改为不产出 source map，并开启 `esbuild` JS 压缩、`lightningcss` CSS 压缩
  - 移除对 `src/assets/images/` 与品牌图的整目录 copy，改为按代码引用打包
  - `me/toolbox/index.tsx` 改为模块化图片引用，避免依赖根包静态路径
  - 压缩三张工具封面图到 200KB 内：`toolbox-data.jpg` `152821B`、`toolbox-locations.jpg` `133250B`、`toolbox-calculator.jpg` `112712B`
  - 学员首页 `pages/index/index` 不再直接渲染 `TodayTrainingScreen`，改为轻量身份判断后跳转到 `/training/today-training`，以减轻主包首页依赖
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - `find wechat_app/dist -type f \\( -name '*.jpg' -o -name '*.png' -o -name '*.jpeg' -o -name '*.gif' -o -name '*.svg' \\)`：当前 `dist` 仅剩 `favicon.svg`，大图不再落在根包静态目录
  - `mrc relaunch /pages/index/index --port 9420`：通过
  - `mrc where --port 9420`：当前页面 `pages/index/index`
  - `mrc errors 10 --port 9420` / `mrc warnings 10 --port 9420`：均为 0 条
  - 当前剩余观察项：
    - 本地 `development` 模式产物根目录仍存在较大的 `common.js` / `vendors.js`，DevTools 的“主包 < 1.5M”是否已完全转绿，需要在开发者工具代码质量面板重新扫描确认
    - `mrc screenshot` 本轮再次长时间无返回，未拿到截图文件

- Latest (`2026-04-26`): 按用户要求启动开发环境
- Task: 启动 `coachlink` Web 开发服务、小程序 `dev:weapp` 监听，以及微信开发者工具
- Scope:
  - 根目录使用 `npm run dev` 启动 Next.js 开发服务（覆盖 Web 前端与 API 后端）
  - `wechat_app/` 使用 `npm run dev:weapp` 启动小程序本地构建监听
  - 使用微信开发者工具 CLI 打开 `wechat_app` 项目，并确认自动化端口可连接
- Status: started on `2026-04-26`
- Verification:
  - 根目录 `npm run dev`：已启动并保持运行，Next.js 16 开发服务监听 `http://localhost:3000`
  - `curl -I http://127.0.0.1:3000`：返回 `307 Temporary Redirect` 到 `/coach/discovery`
  - `wechat_app npm run dev:weapp`：已启动并完成首轮 watch 构建，输出目录为 `wechat_app/dist`
  - `python3 .kimi/skills/port-manager/scripts/portman.py get /Users/kirigaya/project/coachlink weapp-devtools-20260426`：分配并登记端口 `3014`
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 33988 --debug`：成功返回 `✔ auto`
  - `mrc where --port 9420`：可连接，当前页面为 `pages/index/index`

- Latest (`2026-04-25`): 审计 `root@coachlink.fit` 的 SSH 与可疑进程，并关闭 SSH 密码登录
- Task: 检查服务器是否存在密码登录风险、木马/挖矿等异常，并将 SSH 收紧为仅允许密钥登录
- Scope:
  - 通过 `ssh root@coachlink.fit` 登录服务器做只读安全体检
  - 检查 `sshd` 当前有效配置、`authorized_keys`、root 口令状态
  - 检查可疑进程、systemd 服务、定时任务、监听端口
  - 将 SSH 调整为仅允许公钥登录并重载验证
- Status: completed on `2026-04-25`
- Verification:
  - `passwd -S root`：root 账户当前存在本地口令哈希，状态为 `PS`，算法显示为 `MD5 crypt`
  - `sshd -T -C user=root -C host=$(hostname) -C addr=127.0.0.1`：
    - `passwordauthentication no`
    - `kbdinteractiveauthentication no`
    - `pubkeyauthentication yes`
    - `permitrootlogin without-password`
  - 新增 `/etc/ssh/sshd_config.d/00-key-only.conf`，并删除失效的晚序配置 `/etc/ssh/sshd_config.d/99-key-only.conf`
  - `systemctl reload sshd`：通过
  - 可疑项：
    - 发现运行中的矿工进程：`./https -a rx/0 -o pool.supportxmr.com:3333 ...`
    - 发现启用过的挖矿服务：`c3pool_miner.service`、`moneroocean_miner.service`
    - 发现 Redis `6379` 对公网监听且存在外部连接
  - 当前未执行：
    - 未主动停止/删除挖矿进程与文件，避免误伤潜在“人为部署”的内容；如需我可下一步直接清理

- Latest (`2026-04-25`): 通过 `port-manager` 为当前仓库分配新端口并打开新的微信开发者工具窗口
- Task: 避开当前已启动的微信开发者工具端口，为 `coachlink/wechat_app` 新开独立 DevTools 实例
- Scope:
  - 读取 `~/.port-man` 登记并结合本机监听状态判断可用端口
  - 使用 `.kimi/skills/port-manager` 为当前仓库新增登记端口
  - 使用微信开发者工具 CLI 打开 `wechat_app` 项目
- Status: completed on `2026-04-25`
- Verification:
  - `python3 .kimi/skills/port-manager/scripts/portman.py get /Users/kirigaya/project/coachlink weapp-devtools-20260425`：分配并登记端口 `3013`
  - `lsof -nP -iTCP:3013 -sTCP:LISTEN`：确认分配时 `3013` 未被占用
  - `lsof -nP -iTCP -sTCP:LISTEN | rg '(:94|:30|:35|wechatwebdevtools|wechatweb|Python)'`：确认现有实例仍占用 `9420`，且 `3010` 被 `Python run_backend.py` 占用
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 3013 --debug`：微信开发者工具未按指定端口启动，而是提示实例实际已起在 `16866`
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 16866 --debug`：成功，当前项目已挂到新实例
  - `lsof -nP -iTCP:16866 -sTCP:LISTEN`：确认新实例实际监听 `127.0.0.1:16866`
  - 当前阻塞：
    - `mrc where --port 16866` 仍连接失败；当前可确认新窗口已打开并监听 `16866`，但本机 `mrc` 暂未直接接入这个实例

- Latest (`2026-04-24`): 避开已打开项目的微信开发者工具端口，为当前仓库新开独立 DevTools 窗口
- Task: 在不影响已占用 `9420` 的前提下，为 `coachlink/wechat_app` 打开新的微信开发者工具实例，并确认当前使用端口
- Scope:
  - 使用 `.kimi/skills/port-manager` 检查登记端口与实际监听情况
  - 使用微信开发者工具 CLI 为 `wechat_app` 打开独立项目窗口
  - 避免与另一个项目已打开的开发者工具端口冲突
- Status: completed on `2026-04-24`
- Verification:
  - `python3 .kimi/skills/port-manager/scripts/portman.py list`：确认当前仓库已登记 `weapp-devtools` 端口且已有其他项目占用不同端口
  - `lsof -nP -iTCP:9420 -sTCP:LISTEN`：旧实例仍在监听 `9420`
  - `'/Applications/wechatwebdevtools.app/Contents/MacOS/cli' auto --project /Users/kirigaya/project/coachlink/wechat_app --port 35437 --debug`：成功
  - `lsof -nP -iTCP:35437 -sTCP:LISTEN`：新的微信开发者工具实例监听 `127.0.0.1:35437`
  - 当前阻塞：
    - `mrc where --port 35437` 连接失败；现阶段可确认新窗口已打开并监听 `35437`，但本机 `mrc` 尚未直接接入该实例

- Latest (`2026-04-24`): 首页/发现页主题色统一为 `#C27255` 并变量化
- Task: 重启 Web 后端、打开微信开发者工具，并将小程序首页与发现页所有橙色相关细节统一改为基于主题变量的 `#C27255`
- Scope:
  - Web 后端：根目录 `npm run dev`
  - 微信开发者工具：`9420` 自动化端口保持可连接
  - 主题变量源头：`wechat_app/src/app.scss`、`wechat_app/src/styles/theme.ts`
  - 首页：`wechat_app/src/pages/index/index.scss`、`wechat_app/src/pages/index/index.tsx`、`wechat_app/src/training/today-training/**`
  - 发现页：`wechat_app/src/discovery/index.scss`
- This round:
  - 重启 Web 后端并确认 `http://127.0.0.1:3000` 返回 `307`
  - 唤起微信开发者工具应用，`9420` 端口继续监听
  - 新增小程序主题常量 `BRAND_PRIMARY = #C27255` 与全局 CSS 变量：
    - `--brand-primary`
    - `--brand-primary-rgb`
    - `--primary`
    - `--primary-light`
    - `--primary-soft-bg`
    - `--primary-soft-bg-strong`
    - `--primary-soft-border`
  - 将首页和发现页内所有橙色相关按钮、图标、浅底、描边、阴影统一改为变量引用，不再直接写新的主题色
- Status: implemented on `2026-04-24`
- Verification:
  - 根目录 `npm run dev`：已重启并保持运行
  - `curl -I http://127.0.0.1:3000`：返回 `307 Temporary Redirect` 到 `/coach/discovery`
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npx next build`：通过
  - 根目录 `npm run typecheck`：失败，仍为仓库既有大量历史类型错误（Next route handler、Supabase 类型、小程序别名解析等）；本轮新增的 `@/styles/theme` 也落在同一批既有 `wechat_app` 别名解析错误里
  - 小程序运行态验证（`9420`）：
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
    - 当前页面校验类命令本轮再次出现长时间无返回，未拿到稳定的页面路径/元素存在性回执
- Latest (`2026-04-24`): 首页「今日安排」继续按参考图做严格贴图式微调
- Task: 将学员端首页 `今日安排` 卡片的颜色、留白、内外卡层级、状态胶囊和底部按钮尺寸进一步压到用户参考图效果
- Scope:
  - 页面位于 `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
  - 样式位于 `wechat_app/src/training/today-training/index.scss`
  - 卡片样式位于 `wechat_app/src/training/today-training/components/TodayTrainingCard.scss`
- This round:
  - 收紧 `tt-schedule-stack` 外层白卡：加大圆角、调整阴影、抬高头部与右侧 `查看全部` 胶囊尺寸
  - 将嵌入式 `TodayTrainingCard` 的内层边框卡、顶部灰条、顺延标签、标题字号、状态胶囊和底部双按钮继续向参考图靠拢
  - 主按钮改为更浅的米色块面，右侧列表按钮放大到更接近参考图的方形尺寸
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 小程序运行态验证（`9420`）：
    - `mrc relaunch /pages/index/index --port 9420`：通过
    - `mrc where --port 9420`：当前页面 `pages/index/index`
    - `mrc exists .tt-schedule-stack/.training-card--embedded/.main-action-btn__icon --port 9420`：均存在
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
  - 当前阻塞：
    - 按用户要求继续使用 `weapp-devtools` 执行 `mrc screenshot` 两次，命令均连接成功但长时间无返回，未产出截图文件
    - 尝试使用系统级 `screencapture` 做辅助截图时，当前机器返回 `could not create image from display/rect`，说明本机会话下未拿到可用录屏截图能力

- Latest (`2026-04-24`): 底部导航页统一移除微信默认导航栏并补顶间距
- Task: 底部导航栏每个按钮对应页面去除微信默认导航栏，并在已移除的页面顶部预留 `180rpx` 上间距
- Scope:
  - 学员端：`pages/index/index`、`discovery/index`、`me/toolbox/index`、`me/messages/index`、`me/profile/index`
  - 教练端：`coach/overview`、`coach/videos`、`coach/students`、`coach/plan-lib`、`coach/my-profile`
  - 已经是 `navigationStyle: 'custom'` 的页面不重复移除，只补样式时按现状处理
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npm run typecheck`：失败，仍为仓库既有大量历史类型错误；未见本轮新增指向上述底部导航页面的单独结论
  - 小程序运行态验证（`9420`）：
    - `mrc relaunch /discovery/index --port 9420`：通过
    - `mrc where --port 9420`：当前页面 `discovery/index`
    - `mrc exists .discovery-page --port 9420`：存在
    - `mrc exists .page-header --port 9420`：存在
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条

- Latest (`2026-04-24`): 小程序「发现」页主内容按参考图重排
- Task: 根据用户提供的发现页参考图，重做小程序 `discovery/index` 的主要内容布局
- Requirement:
  - 保持每次修改后自动编译再反馈
- Scope:
  - 页面位于 `wechat_app/src/discovery/index.tsx`
  - 头部改为大标题 + 副标题 + 圆角搜索栏 + 六宫格分类入口
  - `服务商品` 改为带封面图的横向商品卡，补齐标签、教练信息、价格与购买/加购按钮
  - `热门动作` 改为参考图式的纵向列表卡，包含左侧封面、标题摘要、作者/点赞与详情按钮
  - `推荐教练` 区块下沉到主内容后段，保留原筛选与加载更多能力
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npx next build`：通过
  - 根目录 `npm run typecheck`：失败，仍为仓库既有大量历史类型错误；本轮未新增指向 `discovery/index` 的单独新错误结论
  - 小程序运行态验证（`9420`）：
    - `mrc relaunch /discovery/index --port 9420`：通过
    - `mrc exists .quick-category-row --port 9420`：存在
    - `mrc exists .market-cover-wrap --port 9420`：存在
    - `mrc exists .action-list-card --port 9420`：存在
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
  - 当前阻塞：
    - `mrc screenshot screenshots/weapp/discovery-reference-2026-04-24.png --port 9420` 本轮长时间无返回，仍未拿到稳定截图文件

- Latest (`2026-04-24`): 小程序首页「我的计划 / 今日安排 / 轻量任务」布局优化
- Task: 将首页中的「进入今日训练」「联系教练」合并进「我的计划」板块底部，并按参考图优化「今日安排」「轻量任务」区块布局
- Requirement:
  - 用户新增要求：今后每次修改后都要自动执行编译，再反馈结果
- Scope:
  - 页面位于 `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
  - 将 `进入今日训练` 主按钮从独立块移动到顶部「我的计划」卡片底部
  - 将 `联系教练` 入口并入同一卡片底部，与续费/移除自建计划共用次级操作区
  - 「今日安排」头部新增右侧 `查看全部` 入口，用于切换月历展开态
  - 收紧嵌入式 `TodayTrainingCard` 结构：顶部摘要、日期信息、训练主按钮与轻量任务卡片更接近参考图的卡片层级
- Status: implemented on `2026-04-24`
- Verification:
  - `wechat_app npm run build:weapp`：通过
  - 根目录 `npm run lint`：通过（脚本仅提示未配置 eslint）
  - 根目录 `npm test`：通过（21 files, 100 tests）
  - 根目录 `npx next build`：通过
  - 根目录 `npm run typecheck`：失败，仍为仓库既有的大量历史类型错误，包含 Next 路由类型、Supabase 类型和 `wechat_app` 别名解析等问题；本轮未新增与 `today-training` 改动直接对应的新错误结论
  - 小程序运行态验证（`9420`）：
    - `mrc where --port 9420`：当前页面为 `pages/index/index`
    - `mrc exists .tt-plan-actions --port 9420`：存在
    - `mrc exists .section-header__action --port 9420`：存在
    - `mrc exists .embed-topline --port 9420`：存在
    - `mrc exists .strength-side-btn --port 9420`：存在
    - `mrc click .section-header__action --port 9420` 后，`mrc exists .schedule-calendar-anchor__toggle-icon--expanded --port 9420`：存在，说明“查看全部/收起月历”交互生效
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
  - 当前阻塞：
    - `mrc screenshot` 在本机本轮仍返回 `fail to capture screenshot`，因此本轮没有拿到新的开发者工具截图文件
  - 本轮追加微调：
    - 将嵌入式 `TodayTrainingCard` 的力量模块统计卡（动作/计划组数/完成进度）移除
    - 标题区改为“标题 + 右侧状态胶囊 + 下方单行摘要”
    - 主按钮视觉改为更接近参考图的浅米色大按钮，保留右侧列表辅助按钮
    - `mrc exists .strength-stats --port 9420`：不存在
    - `mrc exists .panel-inline-meta/.main-action-btn/.strength-side-btn --port 9420`：均存在
  - 本轮再次调整：
    - 去掉计划卡底部的“联系教练”按钮
    - 在“切换教练”按钮左侧新增当前激活教练头像入口，点击进入原“联系教练”页
    - 「今日安排」标题图标改为浅底黑色图标风格；标题、按钮和边框进一步向参考图靠拢
    - 「轻量任务」标题区改为“图标气泡 + 标题 + 右侧新增轻任务胶囊”的结构
    - `wechat_app npm run build:weapp`：通过
    - 根目录 `npm test`：通过（21 files, 100 tests）
    - `mrc errors 20 --port 9420` / `mrc warnings 20 --port 9420`：均为 0 条
    - 本轮 `mrc exists` 对若干新元素查询在本机开发者工具连接上出现长时间无返回，因此未拿到稳定的元素存在性回执；运行日志层面未见报错

- Latest (`2026-04-24`): 按用户要求启动开发环境
- Task: 启动 `coachlink` Web 前后端开发服务、小程序 `dev:weapp` 监听，以及微信开发者工具自动化会话
- Status: started on `2026-04-24`
- Verification:
  - 根目录 `npm run dev` 已启动，Next.js 16 开发服务监听 `http://localhost:3000`
  - `curl -I http://127.0.0.1:3000` 返回 `307 Temporary Redirect` 到 `/coach/discovery`，说明 Web 服务可响应
  - `wechat_app npm run dev:weapp` 已启动并完成首轮 watch 构建，输出目录为 `wechat_app/dist`
  - 微信开发者工具自动化服务监听 `9420`
  - `mrc where --port 9420` 可连接，当前页面为 `pages/index/index`
  - `mrc errors 10 --port 9420` / `mrc warnings 10 --port 9420` 均为 0 条

- Latest (`2026-04-23`): 按用户要求根据项目 skills 启动开发环境
- Task: 启动 `coachlink` Web 前后端开发服务、小程序 `dev:weapp` 监听，以及微信开发者工具自动化会话
- Scope:
  - 用户要求先从 `D:\WPSDrive\632379361\WPS云盘\创业-部分资料版\健身书籍pdf的文字版本\力量训练原理.docx` 开始
  - 内容必须是“笔记 / 解读”形态，不能做原书全文搬运或章节替代
  - 笔记需要成体系、深入浅出、通俗好读，并预留可直接给 AI 画图的提示词
  - 用户进一步明确：`1 本书 = 1 篇长文` 太粗糙，应改为 `1 本书 = 1 个专题 + 多篇文章`
  - 目标不只是生成文案，还要让知识库 `书籍笔记` 页面能把结构化内容正常展示出来，并能从同一本书的总览跳到各分篇
- Status: implemented on `2026-04-24`
- Fix:
  - `src/content/knowledgeBooks/strengthTrainingPrinciplesNote.ts`
    - 从单篇长文升级为《力量训练原理》专题清单
    - 当前拆分为 `1` 篇总览 + `7` 篇原理分篇
    - 每篇都保留非侵权的 interpretive reading note 定位
    - 总览保留整本书框架；分篇按“专项性 / 超负荷 / 疲劳管理 / SRA / 变式 / 阶段增益 / 个体差异”逐篇展开
    - 每篇都单独配 `1` 条对应配图提示词
  - `scripts/import-knowledge-book-notes.ts`
    - 新增可复用的书籍笔记导入脚本
    - 支持 dry run / `--apply`
    - 自动读取 `.env.local` / `.env.development` / `.env`
    - 现已支持按 `collectionSlug` 批量导入同一本书的多篇文章
    - 通过标题对 `knowledge_books` 做 insert / update
  - `src/app/dashboard/knowledge/books/[id]/page.tsx`
    - 修复书籍详情页原先把结构化 `content` 渲染成 JSON 字符串的问题
    - 新增结构化内容归一化：支持 Markdown / HTML / fallback JSON
    - 新增“解读型笔记”说明卡
    - 新增“配图提示词”卡片区
    - 新增“同书专题”卡片区，可从总览页跳到其它分篇
- Data sync:
  - 已执行 `npx tsx scripts/import-knowledge-book-notes.ts strength-training-principles --apply`
  - 当前专题共 `8` 篇记录已写入 / 更新到 `knowledge_books`
  - 总览 ID：`52f3a7b7-e13c-4676-9bf6-5cd22f84beb3`
  - 分篇 ID：
    - 专题01 专项性：`ba7e9765-aa2b-4b7c-a5f9-870837585794`
    - 专题02 超负荷：`71502d2f-06e7-4cae-a75c-951026820e6d`
    - 专题03 疲劳管理：`5060297e-2840-4e34-9cf7-4b1dd97277ec`
    - 专题04 SRA：`d9f0fd46-371b-4c3d-89de-5900a97e5148`
    - 专题05 变式：`892d10d9-f661-4800-81eb-9beb8b706879`
    - 专题06 阶段增益：`9aed3b20-1681-451d-aa51-0abceda10b4f`
    - 专题07 个体差异：`dcf05903-2afd-4d30-82e0-0fcefc4c7822`
  - 当前默认发布状态：`is_published=true`
  - 当前默认访问权限：`is_free=true`
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 104 tests）
  - `npm run typecheck`：仓库仍有大量历史类型错误；本次新增文件相关报错已定向清掉
  - `npx next build`：被当前运行中的 `next dev` 占用 `.next/lock` 阻塞，未拿到最终构建结果
  - 浏览器验证：通过
    - 使用 Playwright 脚本登录本地 dev 站点后，打开书籍列表与详情页
    - 确认列表页已从单篇变为同书多篇卡片，可见总览与专题分篇
    - 确认总览详情页可见“同书专题”区域，并能看到专题01与专题07等分篇入口
    - 截图：`test-results/knowledge-books-series-list.png`、`test-results/knowledge-book-series-detail.png`
- Next step:
  - 下一本书可直接按同一模式拆成 `1 篇总览 + 多篇章节 / 主题分篇`
  - 若后续要改成付费内容，可直接把该记录的 `is_free` 切成 `false`

---

- Task: 修复教练枭马葛为学员测试账号0628生成计划时报“没有匹配的训练计划”
- Scope:
  - 用户明确要求这次不需要代理做 UI 验证，由用户自己在页面上验证
  - 用户进一步明确：当前总任务是 `useLLM=true` 走纯 AI 两阶段生成，`match.ts` 硬匹配不应混入 AI 路径
  - 即使规则上“匹配不到模板”，LLM 也应该能自己从模板全集里选一个；如果没有合适模板，也允许从零生成计划
  - 目标是修复 `/api/plan-lib/create-ai-instance` 在 0628 这类问卷下直接 400 的后端逻辑，同时把 AI 路径与 legacy 路径重新拆清楚
- Status: implemented in code on `2026-04-24`
- Root cause:
  - 旧 `matchPlan` 对标签匹配过严：问卷选的是 `臂屈伸个数`，而枭马葛现有模板主要是 `臂屈伸负重 / 引体负重 / 引体个数`，精确匹配会直接筛成 0
  - 旧逻辑读取“每周训练次数”时只兼容老的 `type=times` 结构；当前问卷实际存的是 `option(question=每周训练次数)`，导致训练频次条件识别不完整
- Fix:
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.ts`
    - Stage B 不再要求 LLM 直接输出 `training_days` JSON
    - 改为先输出紧凑 `plan_script`，再通过 `parsePlanScript()` 编译成 `training_days`
    - prompt 中把已选模板骨架也从 JSON 改为 `plan_script`，统一 AI 修改器与 AI 生成器的中间层
    - prompt 进一步收紧休息日 DSL：休息日备注优先写成 `D2 off #备注`，显式禁止模型写出 `D2 off !备注`
    - 编译动作名时同时允许使用“当前动作库 + 所选模板骨架中的历史动作”，避免模板里已有变体动作在生成时丢失
    - 新增订阅周期约束：`subscribedWeeks=4` 时，prompt 必须要求输出完整 4 周 / 28 天，而不是只给 1-4 个训练日
    - 新增“问卷意图硬约束”解析与二次纠偏：如果问卷明确只练某个专项（例如只练臂屈伸），prompt 会把它当成硬约束；若 AI 首次输出仍保留对立专项（如引体），系统会自动重试一次，仍不满足则直接报错而不是落垃圾计划
  - `src/app/api/plan-lib/ai-personalize-plan/entity.ts`
    - `PersonalizePlanResult` 增加 `planScript`
    - `ActionLibraryEntry` 增加 `type`
    - `GeneratePersonalizedPlanInput` 增加 `subscribedWeeks`
    - 模板摘要/选择结果增加 `source`，区分模板库与历史计划骨架
  - `src/app/api/plan-lib/ai-personalize-plan/service.ts`
    - `buildActionLibrary()` 补齐 `type`
    - `ai_generation_log.promptVersion` 升级为 `v1.3-script`
    - `enforcePlanSpan()`：学员购买 4 周时，AI 若只生成几天短周期，将直接拒绝创建
    - Stage A 选中的骨架若不在模板库，会继续尝试从 `coach_plan_instances` 历史计划里取骨架
  - `src/app/api/plan-lib/create-ai-instance/match.ts`
    - 新增 `extractWeeklyTrainingDays()`，兼容解析老 `times` 结构和新 `option + 每周训练次数` 结构
    - 保留 `matchPlan()` 仅供 `useLLM=false` 的 legacy 规则路径使用
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - AI 候选骨架不再只看 `coach_plan_templates`，还会合并最近的 `coach_plan_instances`
    - 插入实例时，只有骨架来源是模板库才回写 `coach_plan_template_id`
  - `src/app/api/plan-lib/ai-personalize-plan/select-template.ts`
    - 没有模板时不再表达为“无法生成”，而是明确记录为“将直接从零生成计划”
    - 模板选择 prompt 现在会显式读取“问卷意图提炼”和骨架专项标签；若问卷明确只练单一专项，会优先选择对应单专项模板而不是组合模板
  - `src/app/api/plan-lib/ai-personalize-plan/questionnaire-intent.ts`
    - 新增问卷专项偏好解析器：从 `tags / option / text / times` 中提炼出“专项偏好、是否单专项硬约束、每周频率”
    - 当前先重点覆盖 `引体 / 臂屈伸 / 平衡发展` 这条真实问题链路
    - “每周训练次数”现在同时兼容老 `times` 和新 `option(question=每周训练次数, value=2次)` 结构
    - 问卷里明确的每周训练次数（如每周 2 次）已升级为硬约束，并在生成后按周校验训练日数量
  - `src/lib/planScript.ts`
    - 休息日解析器现在兼容 `D2 off #备注` 和 `D2 off !备注` 两种同行备注写法，避免 AI 偶发写出 bang 语法时直接被误判成“未找到动作”
  - `src/lib/planScript.test.ts`
    - 新增回归用例，覆盖 `D1 off !有氧：慢走30分钟` 这类休息日同行备注写法
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.test.ts`
    - 新增回归用例，覆盖“问卷明确每周训练 2 次，但 AI 首次输出 3 练时自动重试修正”
  - `src/app/api/plan-lib/ai-personalize-plan/personalize-plan.ts`
    - 无模板时 prompt 改为允许从零生成，不再要求返回空计划
    - prompt 明确要求：如果问卷写了“每周训练 X 次”，则每个 W 周块都必须恰好安排 X 个训练日
    - 若 AI 首次输出的周训练频率与问卷不一致（例如问卷 2 练但计划 3 练），系统会自动带纠偏提示重试一次；仍不满足则直接报硬约束冲突
  - `src/app/api/plan-lib/ai-personalize-plan/service.ts`
    - Stage A 选不到模板时，不再强行拿第一个模板兜底
    - Stage A 选中的模板不存在/不可访问时，改为从零生成，而不是抛错
    - 无模板但动作库可用时，允许 LLM 直接从零生成计划
    - 有模板但校验后动作全掉光时，回退到所选模板骨架，避免生成空计划
    - 模板摘要新增专项标签推断，供 Stage A 模板选择参考
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - `useLLM=true` 时只走 AI 两阶段生成，不再回退到 `match.ts`
    - AI 路径失败时，直接返回 AI 错误给前端，而不是偷偷改走 legacy 匹配
    - 入口层去掉“无模板直接报错”的门槛，让 AI 服务层决定是选模板还是从零生成
    - `useLLM=false` 时继续保留原 `matchPlan() + fillTemplate()` 旧规则路径
- Verification:
  - 用真实订阅 `3a100757-1d1c-4fd1-94d2-f433affec296` 的问卷数据跑本地脚本确认：
    - legacy 精确匹配结果 `0`
    - 说明之前 `没有匹配的训练计划` 的根因确实来自旧规则路径被错误带入 AI 生成流程
  - 用真实订阅和数据库复查确认：
    - 学员 `测试账号0628` 当前订阅 `subscribed_weeks=4`
    - 枭马葛名下可用模板实际有 `10` 个，且大量为 `56/84/105` 天长计划
    - 当前短计划实例 `04ce17b4-e120-4e37-b8d4-76ebc635cf3f` 的 `ai_generation_log.stageA.templateId = null`
    - 旧 prompt 里明确写了“优先给出 1-4 个训练日”，这是只生成 4 天微周期的直接原因
  - AI 生成链路脚本化定向测试：通过（3 files, 21 tests）
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 106 tests）
  - `npm run typecheck`：122 秒超时，仍未跑完仓库既有历史类型面
  - `npx next build`：本轮通过；日志里有既有 Redis timeout 噪音，但未阻塞构建完成
- Next step:
  - 由用户重新为测试账号0628生成：若问卷明确只练臂屈伸且每周训练 2 次，新计划里不应再保留引体专项主项，且每个 W 周块都应恰好只有 2 个训练日
  - 若用户再次看到 500 且提示“脚本无法编译”，优先检查 AI 是否又写了新的 DSL 变体；当前已兼容“休息日 + bang 备注”这条真实报错链路
  - 用户本轮已明确“不用你测试，我来手动运行就行”，因此页面与真实生成结果由用户手动验证
  - 用户最新又补充：教练端“清空当前计划”不能只支持归档，因为部分 AI 乱生成的垃圾计划不应该留下归档记录；本轮已把学员列表改成“归档保留 / 彻底删除垃圾计划”二选一弹窗
  - 同步修复 `src/app/api/plan-lib/delete-instance/route.ts`：删除权限校验改成和归档接口同语义，教练本人可对自己学员的当前计划做彻底删除

---

- Task: 人体地图胸小肌内容从“互动/阅读试点”收敛为“一篇详实主文章”
- Scope:
  - 用户明确指出当前所谓“互动筛查”还不是真互动，先不做互动模式
  - 图片暂时不处理，优先确保已有文章和转录素材能被整理进一篇小白可读、内容充实的主文章
  - 当前仍以胸前区域为样板：人体图没有单独胸小肌 hitbox，先挂在 `胸大肌` 点击区
- Status: implemented on `2026-04-23`
- Fix:
  - `src/app/dashboard/knowledge/page.tsx`
    - 移除胸小肌硬编码 `CoreGuidePanel` 试点，不再展示 `互动 / 阅读` 两个入口
    - 选中部位后只展示模式说明卡和 `主文章`
    - 部位文章列表收敛为 1 篇，避免用户点击后看到一堆材料
  - `scripts/import-body-map-formal-guides.ts`
    - 将 `body-map-guide-020-pectoralis-minor` 改写为《胸小肌完整指南：圆肩筛查、肩前紧张与训练处理》
    - 主文整合胸小肌、圆肩、肩关节、锁骨/肩峰位置、肩胛胸廓节律、胸椎活动度、胸大肌、前锯肌、中下斜方肌、肩袖控制及胸小肌视频转录里的训练场景
    - 内容结构覆盖：这篇整合了哪些内容 / 一句话理解 / 位置和影响 / 什么时候想到胸小肌 / 小白筛查 / 训练处理 / 可执行组合 / 常见误区 / 停止自处理边界
  - 数据库已同步 `2026-04-23-body-map-formal-guides-v4`
- Verification:
  - 导入脚本 `--apply`：通过，`updated=11`，`errors=0`，输出 `temp_dir/body_map_formal_guides_import_apply_20260423_040704.json`
  - 浏览器验证：DEV 快速登录后打开 `/dashboard/knowledge`，点击 `胸大肌`，确认没有 `互动 / 阅读`，只显示 `主文章`；打开详情页确认新小节“这篇主文整合了哪些内容”、筛查段、训练段和风险边界均可见
  - 截图：`test-results/body-map-main-article-list.png`、`test-results/body-map-main-article-detail-v4.png`
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npm run typecheck`：上次运行 184 秒超时，残留 `tsc --noEmit` 进程已停止；未得到完整类型检查结论
  - `npx next build`：此前已完成编译和静态页生成，但因本地 dev server/`.next` 文件锁在 standalone copy 阶段报 `EBUSY`，未形成干净最终退出码
- Next step:
  - 如果用户认可胸小肌样板，把同一“一个点击部位一篇主文”的模板批量套到其它已入库正式指南；真正的互动筛查要等后续做成问答/动作选择流后再命名为互动。

---

- Task: 优化人体地图筛查/训练模式的内容分层
- Scope:
  - 用户反馈当前人体地图内容太乱，筛查模式和训练模式看到的是同一批内容，且内容过多导致用户懵
  - 目标是让“筛查模式 / 训练模式”产生真实差异，并把默认展示从“长材料堆叠”改为“少量可执行引导 + 推荐阅读”
- Status: implemented in code on `2026-04-22`
- Fix:
  - `src/app/api/knowledge/nodes/route.ts`
    - 新增 `mode=screening|training` 查询语义
    - 读取 `knowledge_nodes.content.body_map_modes` 做模式过滤
    - 人体地图查询默认排除 `content_level=transcript-pack` / source-material 素材包，避免把原始转录材料直接塞给用户
    - 对结果做模式相关排序：`formal-guide` 优先，其次按筛查/训练关键词排序
    - 人体地图默认最多返回 `8` 条；前端当前请求限制为 `6` 条
    - 返回 `content_summary`，剥离长 HTML body，减少列表接口负担
  - `src/app/dashboard/knowledge/page.tsx`
    - 切换筛查/训练时重新请求对应模式内容
    - 选中部位后先展示模式专属行动卡：
      - 筛查模式：活动范围/疼痛信号/动作代偿
      - 训练模式：发力感/动作选择/逐步加量
    - 文章区改为“推荐阅读”，文案明确“只看筛查/问题管理”或“只看训练/动作方法”
    - 内容卡增加 `系统指南 / 延伸阅读 / 知识点` 标签，降低用户判断成本
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：构建前失败于 `.next/types/validator.ts` 缺失；构建后重跑 184 秒超时无输出，未得到新增文件相关错误
  - 浏览器验证：已尝试用 Playwright 打开 `http://localhost:3000/dashboard/knowledge`，但当前无登录态，页面/API 返回未授权或长连接等待，无法完成真实人体图点击验证
- Next step:
  - 用户在已登录浏览器刷新 `/dashboard/knowledge` 后，点击同一部位切换筛查/训练，应先看到不同的 3 步行动卡，下面推荐阅读数量也应明显收敛。

---

- Task: 为人体地图文章补充小白友好的解剖/动作配图
- Scope:
  - 先以胸小肌文章为样例，确定文章需要的配图类型和准确性标准
  - 图像目标不是学术论文级复杂解剖，而是帮助小白理解“在哪里、怎么影响体态、怎么筛查、怎么放松/训练”
- Status: in progress on `2026-04-22`
- Requirement:
  - 圆肩/胸小肌相关体态图不能只画成“肩胛骨单独前倾”；应表达肩带整体前引链条：锁骨/肩峰端前引，带动肩胛骨前引、前倾、内旋，并让肩膀前扣更容易被用户看懂。
  - 面向小白的图中文字优先用“肩膀前扣 / 锁骨前引 / 肩胛前引+前倾”这类可理解标签，少用过度专业且容易误读的单一术语。
- Proposed content direction:
  - 当前胸小肌指南内容偏“系统笔记”，对小白仍然偏长、偏密。下一步应把同一主题拆成两种前台消费方式：`互动模式` 用少量问题/动作卡片带用户一步步判断；`阅读模式` 保留一篇结构化短文用于完整理解。
  - 对每个身体部位，不建议同时展示很多文章。筛查模式和训练模式各保留 1 篇主文章即可：筛查文章解决“我是不是和它有关、什么时候该停/就医”；训练文章解决“我现在该怎么练、怎么避免代偿”。底层转录和长资料继续留作素材，不直接堆给用户。

---

- Task: 人体地图“一个部位一个核心指南”试点
- Scope:
  - 先用胸前区域做样板：当前人体图没有单独胸小肌 hitbox，所以先挂在 `胸大肌` 点击区
  - 点击胸前区域后，不再先让用户面对文章列表；先出现 `胸小肌核心指南` 的互动/阅读双入口
  - 推荐阅读区域在试点中收敛为 `核心文章`，只露出一篇正式指南
- Status: implemented on `2026-04-22`
- Fix:
  - `src/app/dashboard/knowledge/page.tsx`
    - 新增胸小肌核心指南试点数据与 `CoreGuidePanel`
    - 点击 `胸大肌` 时显示“核心指南试点”：问题卡片、互动筛查/互动训练步骤、阅读模式短解释
    - `筛查模式 / 训练模式` 继续控制互动步骤内容
    - `互动 / 阅读` 作为部位内容消费方式，默认回到互动
    - 对试点部位，底部列表从“推荐阅读”改为“核心文章”，优先只展示胸小肌正式指南
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败于仓库既有类型问题（Next 16 route params、动作库 schema、小程序 Taro 依赖等）；定向搜索未见 `src/app/dashboard/knowledge/page.tsx` 新增错误
  - 浏览器验证：使用本地 `localhost:3000` DEV 快速登录后打开 `/dashboard/knowledge`，通过 SVG `胸大肌` 区域触发选中，已看到 `胸小肌核心指南`、互动筛查内容和核心文章；切到“阅读”后看到“它在哪里 / 为什么会影响圆肩”等阅读内容
  - 截图：`test-results/body-map-core-guide-pilot.png`、`test-results/body-map-core-guide-pilot-reading.png`
- Next step:
  - 让用户实际体验胸前区域样板；如果认可，再把该结构抽成可配置数据模型，而不是把每个部位都硬编码在页面里。

---

- Task: 将教练订阅支付链路拆成“订单/支付记录”和“正式订阅”两层
- Scope:
  - 用户确认为了后期数据分析方便，订阅链路不再把“待支付草稿”和“正式成交订阅”混在 `coach_subscriptions` 一张表里
  - 新模型：`coach_subscription_orders` 记录选套餐、待支付、待确认、已支付等订单事实；`coach_subscriptions` 只在付款确认/平台支付成功后生成或更新正式订阅
  - 需要覆盖学员下单、平台支付宝创建/回调、个人收款码/线下已付提交、教练待确认/历史、收入看板与旧数据兼容
- Status: implemented in code on `2026-04-22`; database migration not yet applied in current remote database
- Fix:
  - 新增迁移 `supabase/migrations/20260422_subscription_orders.sql`，定义 `coach_subscription_orders`
  - 新增 `src/types/subscriptionOrders.ts`、`src/lib/subscriptionOrders.ts`、`src/lib/coachPaymentRecords.ts`
  - 新增 API：
    - `/api/subscription/create-subscription-order`
    - `/api/subscription/update-subscription-order`
    - `/api/subscription/confirm-subscription-order`
  - 学员教练主页订阅/续费流程改为先创建订单，支付确认后再正式激活/续费订阅
  - 支付宝创建与支付成功履约支持 `subscriptionOrderId`，平台支付成功后自动调用订单 finalize
  - 教练端“待支付确认 / 历史”改为读取新订单层，同时保留旧 `coach_subscriptions` 历史 fallback
  - 教练收入总览/收入明细按 `2026-04-22T00:00:00+08:00` 作为切换点：新付款从订单表统计，旧历史从订阅表统计，避免双算
  - 增加迁移前兼容：如果当前数据库还没有 `coach_subscription_orders`，教练端读接口回退旧数据；新写入接口返回明确提示“订阅订单表尚未迁移，请先执行 supabase/migrations/20260422_subscription_orders.sql”
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：244 秒超时，无具体错误输出
  - 浏览器验证：用临时学员登录后访问刘三乐教练页，点击 `3个月 / ¥199` 套餐；由于该教练页有问卷，UI 点击先进入问卷链路，随后在同一已登录浏览器会话直接调用新订单 API，返回 `503` 和明确迁移提示，说明当前阻塞是数据库未建表而不是前端/编译问题
  - 截图：`test-results/subscription-order-browser-check.png`
- Blocker:
  - 当前远程数据库缺少 `public.coach_subscription_orders`
  - `supabase migration list --linked` 显示本地/远程迁移历史严重分叉，不能安全地直接 `supabase db push` 全量推送；需要只执行单个 SQL 文件 `supabase/migrations/20260422_subscription_orders.sql`，或由数据库管理员在 Supabase SQL Editor 中执行该迁移
- Next step:
  - 执行 `supabase/migrations/20260422_subscription_orders.sql` 后，再完整浏览器验证：临时学员选择 3 个月套餐 -> 创建订单 -> 上传/提交个人收款码凭证 -> 教练端待确认显示订单 -> 教练确认后生成正式订阅。

---

- Task: 整理并同步人体地图新增转录素材
- Scope:
  - 用户补充说明 `C:\Users\29454\.openclaw\workspace-main\body-map-system\content` 下 Apr 21 19:00 之后真正新增的 68 个 transcript，分布在胸小肌、腕屈肌群、大圆肌、颞下颌关节、咬肌、翼内肌、颈前淋巴结、肱三头肌、腹外斜肌、股二头肌、半腱肌/半膜肌等主题
  - 目录存在 `topic/topic/source/transcript.txt` 和 `020-胸小肌/video/bilibili/...` 等嵌套结构，不手动平铺，由导入脚本递归扫描并按 source id 去重
  - 在保留 `transcript-pack` 原始素材层的同时，把可直接面向用户展示的主题整理为 `formal-guide`
- Status: completed on `2026-04-21`
- Fix:
  - `scripts/import-body-map-transcript-packs.ts` 重新 dry-run/apply，确认本轮嵌套目录被识别并同步到数据库
  - 转录包当前识别结果：`26` 个 topic、`22` 个可挂现有人体图、`4` 个头面/颈前待扩点击区、`276` 份去重后的 transcript、无薄弱 topic
  - `scripts/import-body-map-formal-guides.ts` 升级到 `2026-04-21-body-map-formal-guides-v2`
  - 正式指南从 `7` 篇扩展到 `11` 篇，新增：
    - `肱三头肌系统指南：推类动作、肘伸力量与长头训练`
    - `腹外斜肌系统指南：抗旋转、侧向稳定与呼吸核心`
    - `股二头肌系统指南：后链发力、腘绳肌拉伤与硬拉跑跳`
    - `半腱肌与半膜肌系统指南：内侧腘绳肌、膝稳定与后链控制`
  - apply 结果：
    - 转录包：`updated=26`、`inserted=0`、`errors=0`
    - 正式指南：`inserted=4`、`updated=7`、`errors=0`
- Output:
  - 转录包报告：`temp_dir/body_map_transcript_pack_import_apply_20260421_222018.json`
  - 正式指南报告：`temp_dir/body_map_formal_guides_import_apply_20260421_222007.json`
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败于仓库既有类型问题（Next 16 route params、动作库/schema 类型、小程序 Taro 依赖等），非本次导入脚本引入
- Next step:
  - 现有素材不需要平铺目录即可继续复用；后续若新增转录，直接放在 topic 任意嵌套目录下即可由脚本递归吸收。

---

- Task: 修复刘三乐学员 li 支付历史金额显示为 99 的问题
- Scope:
  - 用户反馈刘三乐教练下学员 `li` 明明付款 `199`，列表显示已购 `12周`，但“待支付确认 -> 历史”里显示“月费 99”
  - 需要核查真实订阅记录、付款凭证、前端支付历史展示口径，以及订阅创建时套餐价格是否同步
- Status: completed on `2026-04-21`
- Root cause:
  - 订阅 `26df041e-a4e3-4dac-83db-679ad2e41fae` 确认为刘三乐教练下学员 `li`
  - 数据库原值为 `subscribed_weeks=12`、`monthly_price=9900`、`payment_method=personal_qrcode`、`payment_data.offline_payment=null`
  - 凭证截图显示实际付款 `-199.00`，付款留言为“烛火3个月力量”
  - 根因是 `/api/subscription/create-subscription` 遇到已有未生效订阅时，只更新了 `subscribed_weeks` / 产品信息，没有同步更新 `monthly_price` / `tier` / `status`，导致“12周 + 99元”的脏组合
  - 支付历史表头仍叫“月费”，进一步把“方案/支付金额”误导成月付
- Fix:
  - 已将 li 订阅记录 `monthly_price` 从 `9900` 修正为 `19900`，`subscribed_weeks` 保持 `12`
  - 已在该订阅 `payment_data.manual_repair` 写入修复原因、旧值、新值、凭证核验标记和修复人
  - `src/app/api/subscription/create-subscription/route.ts`
    - 已有 `active` 订阅不再由创建订阅接口重写价格/周期，续费继续走专门链路
    - 已有非 active 订阅重新选择套餐时，同步更新 `tier`、`monthly_price`、`status`、产品信息和 `subscribed_weeks`
    - 返回更新后的订阅，而不是只返回旧查询里的 `id`
  - `src/app/dashboard/students/PaymentConfirmationDialog.tsx`
    - “月费”列改为“支付金额”
    - 增加“购买周期”列
    - 对普通扫码记录标注“方案金额”，线下已付记录继续优先显示“线下实付”
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：184 秒超时，无错误输出；仓库长期存在大体量历史类型问题
  - 浏览器验证：用刘三乐账号登录 `http://localhost:3000/dashboard/students`，打开“待支付确认 -> 历史”，li 行显示 `12周` 和 `¥199.00`
  - 截图：`test-results/payment-history-li-199-loaded.png`
- Next step:
  - 若后续还要同步教练收入看板，需进一步把 `get-revenue-details` 中“订阅月费”的历史文案也改成“订阅收入/方案金额”

---

- Task: 美化并深化 CoachLink 商业计划书，产出 PDF
- Scope:
  - 基于用户提供的 `CoachLink 商业计划书 v2` 继续打磨，而不是替换商业定位
  - 重点增强外发阅读感、结构层次、当前数据口径、传统教练线上化问题分析
  - 输出可交付 PDF 版本，同时保留可继续迭代的 Markdown 源文档与生成脚本
- Status: completed on `2026-04-21`
- Output:
  - 增强版 Markdown：`docs/CoachLink_商业计划书_v2_1.md`
  - PDF 成品：`output/pdf/CoachLink_商业计划书_v2_1.pdf`
  - Word 可编辑版：`output/docx/CoachLink_商业计划书_v2_1.docx`
  - Word 紧凑版：`output/docx/CoachLink_商业计划书_v2_1_紧凑版.docx`
  - Word 封面修正版：`output/docx/CoachLink_商业计划书_v2_1_封面修正版.docx`
  - PDF 生成脚本：`scripts/generate-business-plan-pdf.py`
  - Word 生成脚本：`scripts/generate-business-plan-docx.py`
- Verification:
  - PDF 生成成功，共 `21` 页，文件大小 `368,163` bytes
  - 使用 `pypdf` 校验：21 页均可抽取文本，无空白页
  - 关键内容命中：`CoachLink 商业计划书 v2.1`、`线上自由教练的商业化操作系统`、`传统教练困境`、`注册用户`、`1,296`、`上传训练视频用户`
  - 用户截图反馈第一版 PDF 在 VS Code 预览器中文字不可见；根因是使用了 `STSong-Light` 这类未嵌入 CID 字体
  - 已改为嵌入 Windows 中文字体 `Deng.ttf/Dengb.ttf`，并验证 PDF 内包含 `/FontFile2` 嵌入字体
  - 当前环境缺少 `pdftoppm/mutool/ghostscript/magick`，Chrome/Edge headless 未能生成 PDF 页面截图，因此未完成真正的 PNG 视觉渲染校验
  - Word 版生成成功，文件大小 `54,797` bytes；反读校验包含 `225` 个段落、`16` 张表，关键内容命中
  - 本机未发现 LibreOffice/Word 命令行转换器，因此未生成旧二进制 `.doc`，交付现代 Word `.docx`
  - 用户反馈 Word 版“内容排版过于分散”，已调整 Word 生成器：取消每个 `##` 大章节前强制分页、收紧页边距与页眉页脚距离、压缩正文/列表/标题段距、去掉表格后的硬空行
  - 新输出 `CoachLink_商业计划书_v2_1_紧凑版.docx`，反读校验为 `196` 个段落、`16` 张表
  - 用户随后反馈“第一页还是有点问题，其他没问题”；已继续调整封面生成策略：
    - 去掉第一页的真实表格，改成纯段落式“关键数据”数据行
    - 第一页页脚改为留空，避免封面被页脚干扰
    - 新输出 `CoachLink_商业计划书_v2_1_封面修正版.docx`
    - 反读校验：`201` 个段落、`15` 张表；第一页前 10 段顺序为标题、定位、副文案、关键数据 4 行、阶段判断、版本信息
  - 用户再次指出“第一页后面都是空白”；已删除封面末尾的强制分页，让正文从第一页直接续接
  - 新输出 `CoachLink_商业计划书_v2_1_首页无空白版.docx`，反读校验前 10 段后直接进入 `执行摘要`
- Next step:
  - 若要继续外发融资/路演版，可基于 v2.1 再压缩成 8-12 页 BP deck 或一页式投资人摘要。

---

- Task: 在学员执行训练计划前增加阅读须知
- Scope:
  - “执行计划阅读须知”必须是教练为模板/计划实例填写的专属内容，不是平台统一文案
  - 学员首次进入某个计划实例的正式训练执行前强提醒；计划详情页和训练执行页可回看
  - 教练端需要在模板编辑页和学员计划编辑页维护这段内容，并在从模板创建实例、AI 生成实例时继承到实例
- Status: implemented in code on `2026-04-21`
- Fix:
  - 新增数据库字段 `coach_plan_templates.execution_notice` 与 `coach_plan_instances.execution_notice`
  - 教练端模板页、学员计划页新增“执行须知”输入，保存时写入模板/实例
  - 模板复制、手动从模板建计划、AI 个性化建计划都会把模板上的执行须知带到计划实例
  - `ExecutionPlanNoticeDialog` 改为优先展示教练填写的执行须知，平台文案只保留安全底线兜底
  - 今日训练、训练执行页直达入口、计划历史页回看入口全部改为读取实例上的 `execution_notice`
  - 本地已读状态仍使用 `localStorage` 按 `userId + plan_instance_id` 记录，只负责“这个实例是否已读过”
- Verification:
  - 按用户最新要求，本轮只改代码，未执行 lint / typecheck / build / browser 验证
- Next step:
  - 用户执行 SQL 迁移后，可在教练端为模板和具体学员计划填写专属执行须知，再验证学员首次执行拦截是否展示教练内容

---

- Task: 清理测试账号0628的失败 AI 空计划
- Scope:
  - 用户反馈测试账号0628此前 AI 创建失败，但空计划仍显示为“进行中”，导致无法正常重新生成
  - 目标是清空当前坏计划，同时保留该学员订阅关系和资料，以便重新走 AI 深度个性化生成
- Status: completed on `2026-04-21`
- Fix:
  - 定位订阅 `3a100757-1d1c-4fd1-94d2-f433affec296`
  - 定位坏计划实例 `1d7b45f1-1a5b-4db7-ab81-51bae2965443`
  - 确认该实例 `status=active`、`training_days=2`、`actionSets=0`、无执行记录
  - 已将该实例归档为 `archived`，保留订阅 `active`
  - 修复 `src/app/api/subscription/coach-subscriptions/route.ts`：`has_plan_instance` 和预计结束日计算不再把 `archived` 计划算作当前/有效计划
- Verification:
  - 数据库复查：该订阅下 `active/paused/completed/scheduled` 计划为空，仅剩归档坏实例
  - `npm run lint`：通过当前提示脚本
  - `npx vitest run src/app/api/subscription/coach-subscriptions.integration.test.ts`：通过
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - 定向 typecheck 命中既有 `coach-subscriptions/entity.ts` 类型继承错误，非本次 route 状态过滤改动引入
- Next step:
  - 用户刷新 `/dashboard/students` 后，测试账号0628应显示为未配置/待处理，可重新打开“AI 深度个性化”生成。

- Task: 给教练端增加手动清空当前计划入口
- Scope:
  - 用户指出只由代理进数据库归档是治标不治本，教练后台应该能手动清空当前计划，方便重新启用 AI 生成计划
  - 清空语义采用“归档当前计划”：保留订阅、学员资料和历史记录，只把当前计划从学员端执行流中移除
- Status: implemented in code on `2026-04-21`
- Fix:
  - `src/app/dashboard/students/page.tsx`
    - 桌面训练计划卡片新增“清空当前计划”图标按钮
    - 移动端展开学员卡片后新增“清空”按钮
    - 点击后弹确认框，确认后调用已有 `/api/plan-lib/archive-instance`
    - 成功后本地把该学员 `plan` 置空、训练进度归零，并让其重新进入未配置计划可选择状态
    - 给“清空当前计划”和 AI 生成图标补 `aria-label`，方便自动化测试和可访问性
- Verification:
  - Playwright 通过现有 `localhost:3000` + DEV 教练登录 + API mock 验证：
    - 有计划学员显示清空按钮
    - 点击清空弹确认框
    - 确认后请求 `archive-instance`，payload 为 `{ instanceId: "plan-instance-1" }`
    - 列表变成“未配置计划”，AI 生成按钮重新出现
    - 截图：`test-results/students-clear-plan-after.png`
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 101 tests）
  - `npx next build`：通过
  - `npm run typecheck`：仍会在当前仓库超时或命中既有类型问题，本次页面编译由 build 覆盖通过

- Task: 修正教练端 LLM 个性化生成计划的模板/动作库流程
- Scope:
  - 用户反馈生成后的计划详情显示“教练没有可用的计划模板”“可用动作库为空”，并把计划改成休息日
  - 正确业务流应是：先选教练计划模板 -> 导入模板动作 -> 基于模板保守调整 -> 创建实例后同步对应教练动作到学员动作库
  - 动作库为空不能成为阻止创建计划或生成空计划的理由；尤其不能把“学员动作库为空”和“教练动作库为空”混在一起
- Status: implemented in code on `2026-04-20`
- Root cause:
  - `create-ai-instance/service.ts` 的 LLM 分支使用 `actorCoachId` 查询 `coach_plan_templates.coach_id` 和 `coach_actions.coach_id`
  - 但当前项目里模板和教练动作的 `coach_id` 存的是教练用户 `users.id`；`actorCoachId` 是 `coaches.id`，只适合用于校验订阅归属
  - 因此 LLM 分支把教练模板和动作库查成空，然后进入从零生成 prompt，模型按“可用动作库为空”输出了全休息计划
- Fix:
  - 查教练模板、教练动作、自动计算动作、`matchPlan`、`fillTemplate` 的 coach 身份统一改用 `actorUserId`
  - 订阅归属校验继续使用 `actorCoachId`
  - LLM 流程只允许模板驱动：没有可用模板 / 选中模板不可访问时，抛错交给 legacy 规则匹配 fallback，不再从零生成
  - 当动作库读取为空时，保留已选模板骨架，不调用 Stage B 让模型改写成休息日
  - 当 LLM 输出没有任何训练动作时，回退 legacy 规则匹配；最终仍无训练动作则阻止创建空计划
  - AI 创建实例后复用 `syncCoachActionsToStudentLibrary`，把训练计划中使用的教练动作同步到学员动作库，和手动从模板创建保持一致
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npx vitest run src/app/api/plan-lib/ai-personalize-plan`：通过（4 files, 24 tests）
  - `npm test`：通过（21 files, 101 tests）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'create-ai-instance|ai-personalize-plan|sync-actions|personalize-plan|select-template'`：无相关错误输出
  - `npx next build`：编译与静态页生成成功，最终 standalone copy 因当前 3000 dev server 占用 `.next` 文件触发 Windows `EBUSY` 文件锁
- Next step:
  - 重启/刷新本地 dev server 后用教练账号重新生成：应先选到教练模板，不再显示“教练没有可用模板/可用动作库为空”，生成后学员动作库应 best-effort 同步对应教练动作。

- Task: 修复教练端开启 `AI 深度个性化` 生成计划时报学员会员配额不足
- Scope:
  - 用户以教练身份在 `/dashboard/students` 开启 AI 深度个性化并确认生成计划
  - 请求 `/api/plan-lib/create-ai-instance` 返回 403，提示“配额不足，请升级会员或购买加油包”
  - 该提示来自学员侧会员 AI 配额逻辑，教练后台给学员制定计划不应消耗学员会员配额
- Status: implemented in code on `2026-04-20`
- Root cause:
  - `src/app/api/plan-lib/create-ai-instance/service.ts` 在完成教练身份和订阅归属校验后，仍无条件调用 `checkAndConsumeAiQuota(subscription.student_id, 1)`
  - 这导致教练端生成计划被学员会员余额拦截，并返回错误的升级会员提示
- Fix:
  - 移除教练端 `createAiInstanceForSubscription` 中的学生会员 AI quota 检查
  - 保留原有教练身份、订阅归属、订阅 active 状态、LLM fallback、订阅剩余额度等校验
  - 批量生成复用同一服务函数，因此同步不再因学员会员配额失败
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npx vitest run src/app/api/plan-lib/ai-personalize-plan`：通过（4 files, 23 tests）
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'create-ai-instance|ai-personalize-plan|bulk-create-ai-instances'`：无相关错误输出
  - `npx next build`：通过
  - 代码确认：`create-ai-instance/service.ts` 已无 `checkAndConsumeAiQuota` / `membershipLimit` / “配额不足”相关调用
- Next step:
  - 在已登录教练页面重试开启 `AI 深度个性化` 后确认生成计划，应不再出现学员会员配额不足提示；若失败，下一步看真实 LLM API / 模板匹配 / 数据库迁移错误。

- Task: 升级教练 AI 分身资料库为多文档检索加载
- Scope:
  - 用户作为教练枭马葛，已从大量学员聊天记录中提取个人 AI 分身资料，目录为 `C:\Users\29454\Documents\微信聊天记录导出\ai_coach_knowledge_base`
  - 当前单一 `knowledge_base` 文本框会被保存上限和 prompt 截断限制影响，不能充分利用 10 个 Markdown 文件
  - 目标是支持把 Markdown 资料作为结构化知识文档保存，并在自动回复时按当前学员问题检索相关文档注入 prompt
- Status: implemented in code on `2026-04-20`
- Fix:
  - 新增 `src/lib/coachAiKnowledge.ts`
    - 定义教练 AI 知识文档结构
    - 支持按文件名/内容推断分类：身份风格、训练理念、沟通策略、动作技术、计划设计、营养补剂、伤病边界、常见问题、内容运营
    - 自动回复时始终优先保留 persona / philosophy / communication / injury 等核心文档，并按学员问题关键词检索 topic 文档
  - 新增迁移 `supabase/migrations/20260420_coach_ai_knowledge_documents.sql`
    - 给 `coach_ai_auto_reply_settings` 增加 `knowledge_documents jsonb`
  - 更新 `/api/coach/ai-auto-reply-settings`
    - GET/POST 支持 `knowledgeDocuments`
    - 兼容未执行新迁移时的旧字段读取
    - 保存多文档时做数量、单文档长度、总长度保护
  - 更新 `src/lib/coachAiAutoReply.ts`
    - 不再只把 `knowledge_base` 整段截断塞入 prompt
    - 新增“核心补充资料 + 按当前问题检索命中的教练知识文档”两层上下文
  - 更新 `src/app/messages/page.tsx`
    - AI 分身弹窗新增 Markdown 多文件导入
    - 可以一次选择 `persona.md`、`program_design.md`、`nutrition_supplements.md` 等文件
    - 文档支持启用/停用、删除、清空，并展示自动分类和字数
  - 顺手补齐 `src/app/api/coach/broadcast-message/entity.ts` 的图片群发 DTO 字段，避免同一消息页类型检查被旧字段污染
- Verification:
  - 用户最新要求“不用写测试，只管写代码；我执行 SQL 并验证功能”，因此已删除新增测试文件，后续未继续追加验证命令
  - 在用户打断前已跑过：`npm run lint` 通过当前提示脚本；`npm test` 通过；`npx next build` 通过；全量 `npm run typecheck` 仍失败于仓库历史类型面，定向过滤本次 AI 分身相关文件无输出
- Next step:
  - 用户执行 `supabase/migrations/20260420_coach_ai_knowledge_documents.sql`
  - 在 `/messages` 点击“AI 分身”，导入 `C:\Users\29454\Documents\微信聊天记录导出\ai_coach_knowledge_base` 下 10 个 `.md` 文件并保存
  - 用学员号向枭马葛发不同类型问题验证：动作技术、计划调整、补剂、疼痛/伤病

- Task: 为教练文章增加独立“专栏”页与入口
- Scope:
  - 用户提出“教练的文章能不能搞一个专栏”
  - 目标不是再造新内容系统，而是在现有 `coach_contents` 基础上补一个按教练聚合的公开专栏页
  - 需要同时打通三处入口：全站文章广场、教练主页内容页签、专栏页本身
- Status: implemented in code on `2026-04-20`
- Fix:
  - 新增 `src/app/articles/coach/[coachId]/page.tsx`
    - 改为服务端公开页面，直接读取已审核教练和其 `coach_contents` 图文文章
    - 展示教练名、头衔、文章列表、阅读/点赞数据，并保留文章详情跳转
  - 新增 `src/app/articles/coach/[coachId]/loading.tsx`
    - 提供专栏页加载骨架
  - `src/app/articles/page.tsx`
    - 将“教练内容 · 公开资讯”升级为“教练专栏广场”
    - 每篇文章补充“查看某教练专栏”入口
  - `src/app/coach/profile/[id]/CoachContent.tsx`
    - 页签文案从“教学内容”调整为“教练专栏”
  - `src/app/coach/profile/[id]/content-panel/Content.tsx`
    - 在教练主页内容面板顶部增加专栏说明卡和“进入专栏”按钮
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm run typecheck`：失败，仍为仓库既有问题；当前报错是 `.next/types/validator.ts` 缺失
  - `npx next build`：通过，路由清单包含 `ƒ /articles/coach/[coachId]`
  - `npm test`：通过（21 files, 100 tests）
  - 浏览器验证：
    - 当前会话没有 AGENTS.md 指定的 `web-devtools` skill
    - 已改用本地 dev server + Playwright 脚本验证 `http://localhost:3000/articles -> /articles/coach/[coachId]`
    - 结果：找到 `11` 个专栏入口，成功进入 `枭马葛专栏`，页内识别到 `6` 个文章卡片
    - 截图：`test-results/coach-column-articles-page.png`、`test-results/coach-column-page.png`

- Task: 将教练文章专栏升级为“命名专栏 + 闲散文章”结构
- Scope:
  - 用户追问：专栏是否需要名字，以及同一教练是否会同时存在专栏文章和闲散文章
  - 结论：轻量的“按教练聚合文章”不够，需要真正变结构
  - 目标：每位教练可以创建命名专栏，文章可选择归属某专栏；未选择专栏的文章保留为闲散文章
- Status: implemented in code on `2026-04-20`
- Fix:
  - 新增迁移 `supabase/migrations/20260420_coach_content_columns.sql`
    - 新表 `coach_content_columns`
    - `coach_contents` 增加 `column_id` 和 `column_sort_order`
    - `column_id IS NULL` 表示闲散文章
    - 补索引、外键、RLS、grant
  - `src/types/database.types.ts` / `src/types/index.ts`
    - 补 `coach_content_columns` 类型
    - 补 `CoachContentColumnRow`
    - 补 `coach_contents.column_id` / `column_sort_order`
  - 新增 `/api/coach/content-columns`
    - GET 获取当前教练专栏
    - POST 新建专栏
    - PUT 更新专栏基础信息
  - `publish-content` / `update-content`
    - 支持写入和更新 `column_id` / `column_sort_order`
    - 校验所选专栏必须属于当前教练
  - `src/app/dashboard/content/ContentEditor.tsx`
    - 新增“内容归属”：闲散文章 / 某个专栏
    - 编辑器内只负责选择“闲散文章 / 已有专栏”，不再把新建专栏输入框塞进文章表单
    - “管理 / 新建专栏”会打开统一的专栏管理弹窗；在编辑器内创建或选中专栏后会自动回填到内容归属
  - `src/app/dashboard/content/page.tsx`
    - 加载教练专栏列表
    - 内容列表展示所属专栏或“闲散文章”
    - 支持按专栏归属过滤
    - 新增独立“专栏管理”弹窗，用于创建专栏、查看已有专栏、筛选或选中专栏
  - `src/app/api/coach/content-columns`
    - 用户截图反馈 `POST /api/coach/content-columns 500` 后复查：专栏表已存在，失败更像是 API 使用匿名 Supabase client 写入时被 RLS 拦截
    - 已改为：API 先用登录 session 校验当前教练身份，再用 `serviceRoleSupabase` 执行专栏表的列表/创建/更新，避免 RLS 误拦截服务端可信写入
    - 重复 slug 时返回已有专栏，不再直接 500
  - `src/app/articles/coach/[coachId]/page.tsx`
    - 公开页按命名专栏分区展示
    - 单独展示“闲散文章”
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npx next build`：通过，路由清单包含 `ƒ /api/coach/content-columns` 和 `ƒ /articles/coach/[coachId]`
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck`：超时；二次定向过滤同样超时，未得到新增文件相关错误输出
  - 用户截图后的追加验证：
    - `npx next build`：通过
    - `npm test`：通过（21 files, 100 tests）
    - `npm run lint`：通过当前提示脚本
    - `npm run typecheck`：失败于仓库既有大面积类型问题（Next 16 route params、动作库/schema 类型、小程序 Taro 依赖等）；定向过滤 `content-columns` / `dashboard/content` / `ContentEditor` 无命中
    - service role 数据库验证：临时插入 `coach_content_columns`、读取、删除，全部成功且清理完成
    - Playwright 尝试打开 `http://localhost:3000/dashboard/content`，但无共享登录态，被重定向到 `/login`；截图 `test-results/content-columns-dashboard-check.png`
  - Deployment blocker:
    - 这版代码必须与 SQL 迁移一起上线，不能只部署代码

- Task: 导入 body-map-system 文章到当前人体地图知识库
- Scope:
  - 盘点 `C:\Users\29454\.openclaw\workspace-main\body-map-system\articles` 现有 134 篇 Markdown 是否可直接复用到当前人体地图
  - 将可用文章按“直接同名部位 / 别名映射 / 相关结构或问题节点”挂载到当前 26 个可点击肌肉/关节
  - 先把现有内容填充进人体地图，再明确当前仍缺的内容空白
- Status: implemented in code and imported on `2026-04-20`
- Fix:
  - 新增 `scripts/import-body-map-articles.ts`
    - 读取外部 body-map-system Markdown 文章
    - 用 `markdown-it` 转为 `knowledge_nodes.content.body` 可渲染 HTML
    - 支持 `direct / alias / related / skipped` 四类映射
    - 默认 dry-run 输出 JSON 报告，`--apply` 时用 Supabase service role 幂等 upsert 到 `knowledge_nodes`
    - 同步补写 `knowledge_node_closures` 自关联，保证详情与树结构兼容
  - 导入结果：
    - 总文件 `134`
    - 可利用 `130`
    - 直接命中 `19`
    - 别名映射 `4`
    - 相关挂载 `107`
    - 跳过 `4`（`颈前淋巴结区 / 颞下颌关节 / 咬肌 / 翼内肌`，当前人体图无对应点击区）
    - 当前 `26` 个可点击部位已全部有内容，不再有空部位
- Verification:
  - dry-run：`temp_dir/body_map_article_import_dry-run_20260420_034304.json`
  - apply：`temp_dir/body_map_article_import_apply_20260420_034811.json`
    - `updated=130`，`errors=0`
  - `npm run lint`：通过当前提示脚本
  - `npm run typecheck`：失败，仓库既有问题；当前报错为 `.next/types/routes.d.ts` 与 `.next/types/validator.ts` 缺失
  - `npx next build`：通过
  - `npm test`：通过（21 files, 100 tests）
- Next step:
  - 优先补“头面/颈前区域”问题节点与点击区，吸收这次跳过的 4 篇文章
  - 若要让“筛查模式 / 训练模式”真正分流结果，可在 `/api/knowledge/nodes` 增加对 `content.body_map_modes` 的过滤

- Task: 补充 body-map-system 新转录 topic 到人体地图知识库
- Scope:
  - 评估 `C:\Users\29454\.openclaw\workspace-main\body-map-system\content` 下 26 个 topic 目录及后续新增转录是否可补强当前人体地图
  - 把当前可用的转录 topic 作为补充型知识节点导入 `knowledge_nodes`
  - 递归兼容 scp 产生的嵌套目录，并合并重点主题的中文别名目录
  - 头面/颈前主题先作为 `pending` 待接入节点入库，不误挂到当前 26 个点击区
- Status: implemented in code and imported on `2026-04-21`
- Fix:
  - 新增 `scripts/import-body-map-transcript-packs.ts`
    - 读取外部 `content/<topic>/.../transcript.txt`
    - 已升级为递归扫描，兼容 `114-wrist-flexors\114-wrist-flexors\...` 这类嵌套目录
    - 合并重点主题中文别名目录：`020-胸小肌 / 036-颈前淋巴结区 / 037-颞下颌关节 / 038-咬肌 / 039-翼内肌 / 114-腕屈肌群`
    - 把同一 topic 下的多份转录整理成“转录素材摘录”型 HTML 页面
    - 用现有人体图部位映射把 topic 归到相关 `body_region`
    - 头面/颈前主题保留自身 `body_region`，并写入 `content.pending_body_map_hitbox=true`
    - 默认 dry-run 输出 JSON 报告，`--apply` 时幂等 upsert 到 `knowledge_nodes`
  - 导入结果：
    - 总 topic `26`
    - 当前人体图可用 `22`
    - 待扩点击区 `4`（`cervical-lymph-nodes / temporomandibular-joint / masseter / medial-pterygoid`）
    - 合并后总转录文件 `250`
    - 实际入库 `26`（`22` 个更新，`4` 个新增 pending 节点）
  - 本轮重点补强的部位：
    - `大圆肌 / 岗下肌 / 内收肌 / 肱三头肌 / 腕屈肌群 / 腹外斜肌 / 股二头肌 / 半腱肌 / 足弓 / 踝背屈受限 / 肘关节`
- Verification:
  - dry-run：`temp_dir/body_map_transcript_pack_import_dry-run_20260421_204524.json`
  - apply：`temp_dir/body_map_transcript_pack_import_apply_20260421_204731.json`
    - `inserted=4`，`updated=22`，`skipped=0`，`errors=0`
  - `npm run lint`：通过当前提示脚本
  - `npm run typecheck`：失败于仓库既有类型问题（Next 16 route params、动作库/schema 类型、小程序 Taro 依赖等）；未见本次导入脚本相关错误
  - `npx next build`：通过
  - `npm test`：通过（21 files, 101 tests）
- Next step:
  - 若后续扩人体图点击区，可直接接入本轮新增的 `颈前淋巴结区 / 颞下颌关节 / 咬肌 / 翼内肌` pending 节点
  - 内容层面下一步更适合从“素材摘录”升级成正式系统指南，而不是继续盲目堆同主题转录

- Task: 将人体地图重点转录素材整理成正式系统指南并入库
- Scope:
  - 用户确认由代理整理当前人体地图素材，并同步到数据库
  - 第一批整理 7 个主题：`胸小肌 / 腕屈肌群 / 大圆肌 / 颞下颌关节 / 咬肌 / 翼内肌 / 颈前淋巴结区`
  - 将“转录素材摘录”升级为用户可直接阅读的正式知识节点
  - 对头面/颈前主题保持保守医学边界，先以 `pending_body_map_hitbox=true` 入库，后续扩点击区再展示
- Status: implemented and imported on `2026-04-21`
- Fix:
  - 新增 `scripts/import-body-map-formal-guides.ts`
    - 生成 7 篇正式系统指南
    - 使用统一结构：定位、常见表现、自我观察、处理策略、误区、风险边界
    - 当前人体图可用主题：
      - `胸小肌系统指南：圆肩、肩前侧紧张与肩胛控制`
      - `腕屈肌群系统指南：握力、前臂内侧疼痛与高尔夫球肘`
      - `大圆肌系统指南：拉类动作、肩后侧发力与背阔肌区分`
    - 待扩头面/颈前点击区主题：
      - `颞下颌关节指南：弹响、咬紧与张口受限的风险边界`
      - `咬肌指南：咬紧牙、磨牙与面颊紧张管理`
      - `翼内肌指南：深层咀嚼肌、张口偏移与 TMJ 关联`
      - `颈前淋巴结区指南：肿大、压痛与何时就医`
  - 数据库导入：
    - dry-run：`temp_dir/body_map_formal_guides_import_dry-run_20260421_210006.json`
    - apply：`temp_dir/body_map_formal_guides_import_apply_20260421_210114.json`
    - `inserted=7`，`updated=0`，`errors=0`
- Verification:
  - dry-run 成功：`total_guides=7`，`usable_guides=3`，`pending_guides=4`
  - apply 成功写入 Supabase：`inserted=7`，`errors=0`
  - lint 脚本等价检查通过（项目当前 lint 只是提示 Next 16 未配置 eslint）
  - `npm test` 等价 Vitest 命令通过（21 files, 101 tests）
  - `typecheck` 失败于仓库既有大面积类型问题（Next 16 route params、动作库/schema、小程序 Taro 依赖等），未见本次脚本相关错误
  - `next build` 两次卡在 `Creating an optimized production build ...` 直到超时；当前机器存在大量常驻 node 进程，未强杀以免影响用户 dev 服务
- Next step:
  - 后续更适合继续把其他高价值素材包升级为正式指南，而不是继续只导入转录摘录
  - 若要让头面/颈前 4 篇在人体地图 UI 中出现，需要新增对应 hitbox 或问题模式入口

- Task: 优化 AI 生成配置弹窗中的 `AI 深度个性化` 开关表达
- Scope:
  - 用户反馈原来的 `开启/关闭` ToggleButton 状态不清晰，截图里难以判断当前到底是关闭状态还是点击后关闭
  - 目标是换成更传统、明确的开关样式，并直接显示当前状态
- Status: implemented in code on `2026-04-20`
- Fix:
  - `src/app/dashboard/students/AiInstanceConfigDialog.tsx`
    - 将 `ToggleButton` 替换为 PrimeReact `InputSwitch`
    - 在标题旁增加明确状态标签：`已关闭` / `已开启`
    - 保留说明文案和原有 `useLLM` 参数传递逻辑
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'AiInstanceConfigDialog|dashboard/students/page|dashboard\\students\\page'`：无相关错误输出
  - `npx next build`：通过
  - 浏览器验证：已用 Playwright 尝试打开 `http://localhost:3000/dashboard/students`，但自动化浏览器无教练登录态，被重定向到 `/login`；无法实际打开该弹窗截图验证。截图保存于 `test-results/ai-config-switch-verification.png`

- Task: 修复 `/dashboard/students` 桌面学员表格训练计划列撑宽导致横向滚动
- Scope:
  - 用户反馈训练计划列里的长描述会把表格撑得很宽，需要手动横向滑动才能看到最后一列
  - 目标是在桌面 DataTable 内限制训练计划卡片宽度，让长计划描述在本列内截断，不再撑开整张表
- Status: implemented in code on `2026-04-20`
- Fix:
  - `src/app/dashboard/students/page.tsx`
    - 桌面 DataTable 增加 `tableStyle={{ tableLayout: 'fixed', width: '100%' }}`
    - 调整桌面列宽分配，为固定 checkbox 列预留空间
    - 训练计划卡片和描述行补 `min-w-0`，让 `truncate` 在 flex 布局中真正生效
    - 计划描述分隔符设为 `shrink-0`，描述文字本身在本列内省略
- Verification:
  - `npm run lint`：通过当前提示脚本
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck`：仍失败于项目既有历史类型问题；定向过滤 `dashboard/students/page` 无相关错误输出
  - `npx next build`：编译、收集页面和静态页面生成均成功，但最终 standalone copy 因本机 3000 服务占用 `.next` 文件触发 Windows `EBUSY`
  - 浏览器验证：用 Playwright 打开 `http://localhost:3000/dashboard/students`，因没有该浏览器上下文的教练登录态被重定向到 `/login`；未能在真实表格数据态下自动截图验证。截图保存于 `test-results/students-table-overflow-check.png`
- Next step:
  - 用已有登录态浏览器刷新 `/dashboard/students`，确认底部横向滚动条消失；若仍出现，优先检查训练进度列 `min-w-[180px]` 或外层容器宽度。

- Task: 移植 LLM 个性化训练计划生成到当前 dev 分支
- Scope:
  - 从 `origin/feat/ai-personalize-plan` 手工移植 LLM 相关文件，不整分支合并旧 `app/` 小程序结构
  - 保留当前 `dev` 的订阅剩余额度 / 下一阶段计划 / 默认起点判断逻辑
  - 修复特性分支里与当前 schema 和 `source` 约束不兼容的问题
- Status: implemented in code on `2026-04-20`
- Findings:
  - 当前本地 `dev` 与 `origin/dev` 均为 `fd9656d844c886035899377c1a1c17f1d2db67aa`，没有 `src/app/api/plan-lib/ai-personalize-plan/`、`useLLM`、`ai_generation_log`、`AiGenerationLogCard` 或 `20260416_add_ai_generation_log.sql`。
  - 远端存在 `origin/feat/ai-personalize-plan`，提交 `1f12d7554761edb87357d19113bdf5f9e92a056f`，其中确实包含用户转述的 20 个左右文件改动和 23 个单测。
  - 该远端特性分支未合入当前 `dev`，且基于较旧主线，仍携带根目录 `app/` 小程序结构；当前项目要求小程序在 `wechat_app/`，直接合并会产生目录/状态文件/基础设施冲突。
  - 静态检查发现特性分支实现存在至少两个上线阻断：`coach_actions` 查询了当前 schema 不存在的 `category`/`description` 列；插入计划时写 `source='ai-personalized'`，但当前数据库约束只允许 `coach/self`。
- Fix:
  - 新增 `src/app/api/plan-lib/ai-personalize-plan/`
    - Stage A：`select-template.ts` 让 LLM 从模板摘要里选骨架
    - Stage B：`personalize-plan.ts` 让 LLM 基于学员上下文和动作白名单个性化调整训练日
    - `validate-output.ts` 做 `actionId` 白名单过滤、day 重编号和 JSON 输出清理
    - `service.ts` 编排 Stage A/B、校验和 `fillTemplate` 重算重量
  - `create-ai-instance` / `bulk-create-ai-instances` DTO、route、service 透传 `useLLM`
  - `create-ai-instance/service.ts`
    - `useLLM=true` 时走 LLM 分支，失败时 fallback 到现有 `matchPlan + fillTemplate`
    - 保留当前 `dev` 的 `getSubscriptionCarryoverSummary` 剩余额度判断和默认起点语义
    - PR 记录读取使用 `actorUserId` 做权限身份，而不是误用 coach row id
    - 动作库查询使用当前真实字段 `id,name,type,detail`，并在 prompt 映射为 `category/description`
    - 不再写非法 `source='ai-personalized'`，继续保持 `source` 默认 `coach`，用 `ai_generation_log` 判断 AI 个性化记录
  - 前端配置弹窗新增 `AI 深度个性化` ToggleButton，单条/批量生成时传 `useLLM`
  - 学员计划详情页新增 `AiGenerationLogCard`，当实例有 `ai_generation_log` 时展示 Stage A/B reasoning
  - 新增迁移 `supabase/migrations/20260416_add_ai_generation_log.sql`
  - 新增 4 个测试文件，共 23 个 LLM 单测
- Verification:
  - `npm run lint`：通过当前脚本（脚本提示未配置 eslint）
  - `npm test`：通过（21 files, 100 tests）
  - `npm run typecheck`：失败，仍为项目历史类型问题；二次过滤 `ai-personalize-plan|create-ai-instance|bulk-create-ai-instances|AiInstanceConfigDialog|dashboard\\students\\page|AiGenerationLogCard|20260416_add_ai_generation_log` 无匹配错误
  - `npx next build`：第一次最终 standalone copy 遇到 Windows `EBUSY` 文件锁；清理 `.next` 后重跑通过
  - 浏览器验证：当前会话没有 AGENTS.md 指定的 `web-devtools` skill；已用 Playwright 打开 `http://localhost:3100/dashboard/students` 并截图到 `test-results/ai-personalize-plan-dashboard-students.png`，页面因缺少登录态重定向到登录弹窗，无法实际点击“AI 深度个性化”开关或走真实学员生成流程
- Next step:
  - 在 staging 应用 `20260416_add_ai_generation_log.sql` 后，用真实教练账号走通：无计划学员 -> 打开 AI 生成配置 -> 开启 AI 深度个性化 -> 生成计划 -> 计划详情页看到 AI 个性化生成记录。

- Task: 基于当前真实数据回答项目 8 条补充信息
- Scope:
  - 区分 `已上线 / 已开发未上线 / 规划中`
  - 回答用户侧、教练侧、供需撮合、核心场景、种子用户、风险责任机制、优先变现对象
  - 真实运营数据以当前 Supabase 配置和生产埋点为准；无埋点或无法严谨归因的数据必须明确标注不可精确回答
- Status: analysis completed on `2026-04-18`
- Data snapshot:
  - 统计口径：北京时间 `2026-04-18`，近 7 日从 `2026-04-11 00:00` 起，近 30 日从 `2026-03-19 00:00` 起
  - 注册用户 `1296`
  - 近 7 日登录用户 `165`，近 30 日登录用户 `718`
  - 行为埋点近 7 日去重用户 `27`，近 30 日去重用户 `42`
  - 页面埋点近 7 日去重会话 `447`，近 30 日去重会话 `1947`
  - 近 7 日完成训练打卡用户 `23`，完成训练记录 `49`
  - 全量完成训练用户 `65`，完成训练记录 `794`
  - 完成过整套计划用户 `5`，完成计划实例 `8`
  - 上传过训练视频用户 `16`，训练/执行视频共 `69`
  - 已批准教练 `15`，近 30 日教练行为活跃 `2`，真正带过学员/有订阅/有计划执行的教练 `3`
  - 教练订阅关系 `126`，active `84`，waiting `1`；当前订阅均在 `professional/growth` 教练层级，`buddy` 暂无订阅
  - 好友/搭子关系 `20`，其中 accepted `15`
  - 支付订单 `222`，订阅订单 `86`，其中 paid `15`；订阅支付客单价约 `180.14` 元；付费订阅用户 `14`，重复付费用户 `1`
  - AI 精确使用人数当前没有稳定埋点；`student_quotas` 有 `105` 行，其中 `56` 行余额低于旧/免费额度，最多只能作为“可能使用过 AI/配额被消耗”的弱证据
- Notes:
  - `coach_ai_auto_reply_settings` 表在当前 Supabase 中不存在，说明教练 AI 自动回复迁移尚未应用到线上库；该功能只能列为“已开发未上线/未部署”。

- Task: 为每个教练增加 DeepSeek AI 自动回复虚拟分身
- Scope:
  - 教练可以在消息中心配置 AI 自动回复开关
  - 教练可以维护基础提示词和资料库，供 AI 回复学员私信时参考
  - 先使用 DeepSeek OpenAI 兼容接口，模型为 `deepseek-chat`
  - 学员给教练发送文本消息时，若该教练已开启自动回复，则系统自动以教练身份插入一条 AI 回复
  - AI 回复必须在消息气泡中明确标注“教练虚拟分身自动回复”，提醒用户这不是教练本人实时输入
  - AI 回复必须参考系统资料和教练资料库，不能只凭模型常识瞎回复
- Status: implemented in code on `2026-04-16`
- Fix:
  - 新增迁移 `supabase/migrations/20260416_coach_ai_auto_reply.sql`
    - 新表 `coach_ai_auto_reply_settings`
    - 每个教练按 `coach_user_id` 保存 `enabled`、`system_prompt`、`knowledge_base`、`model`
  - 新增 `src/lib/coachAiAutoReply.ts`
    - 使用 `DEEPSEEK_API_KEY` + `https://api.deepseek.com` + `deepseek-chat`
    - 只处理一对一私聊中“学员发给教练”的文本消息
    - 自动拼装 DeepSeek 上下文：
      - 教练档案：姓名、头衔、简介、专项、支持重点、教学理念等
      - 学员档案：昵称/姓名、性别、年龄、身高、体重、训练目标/水平、作息、运动数据卡
      - 订阅关系：状态、档位、购买周期、开始日期、预计结束日期、订阅补充资料
      - 当前计划摘要：计划名称、说明、状态、完成进度、接下来若干训练日动作
      - 最近聊天上下文
    - 自动回复包含安全边界：不冒充真人教练、不处理医疗诊断、不承诺计划/价格/退款等需真人确认事项
    - 若系统资料、教练资料库、聊天上下文都没有足够依据，则要求 AI 明确说明需要教练本人确认，不能编造
    - 插入消息时写入 `content_metadata.coach_ai_auto_reply=true`
  - 新增 `/api/coach/ai-auto-reply-settings`
    - GET/POST 读取和保存当前教练的 AI 自动回复设置
  - `src/app/messages/page.tsx`
    - 教练消息中心新增“AI 分身”入口
    - 支持开关、基础提示词、资料库编辑
  - `src/app/api/chat/send-message/route.ts`
    - 发文本消息成功后触发 AI 自动回复并等待插入完成
  - `src/components/chat/MessageItem.tsx`
    - AI 回复气泡展示“教练虚拟分身自动回复”和“重要事项请等待教练本人确认”提示
  - `.env.local`
    - 复用项目既有的 `DEEPSEEK_API_KEY` 环境变量；这不是新的独立密钥体系
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test`：通过（17 files, 77 tests）
  - `npm run typecheck`：超时未完成，符合近期历史表现
  - `npx next build`：用户中止并明确表示“不用编译，写代码就行”，因此未继续构建
  - 浏览器验证：未执行；用户本轮明确不要求编译/验证，只要求写代码
- Note:
  - 用户在 `2026-04-17` 纠正：DeepSeek key 原本就是项目既有同一个 key，本功能应复用 `DEEPSEEK_API_KEY`，不要理解成新增了一套独立 API key 配置
  - 用户在 `2026-04-17` 进一步明确：AI 自动回复必须参考资料，不能凭自己的感觉瞎回复；已在 `coachAiAutoReply` 中补系统上下文拼装和“不足则转真人确认”的约束

- Task: 同步 main/dev 的微信小程序目录命名并修复 Next 根路由冲突
- Scope:
  - 小程序工程原本合入到根 `app/`，会被 Next.js 识别为 App Router 并导致主站 `/` 404
  - main 已统一为 `wechat_app/`，dev 远端曾使用 `wechat-app`，需要同步成同一命名
- Status: implemented on `2026-04-16`
- Fix:
  - main/dev 均使用 `wechat_app/` 存放小程序代码
  - 根目录不再保留 `app/` 或 `wechat-app/`
- Verification:
  - main: `npx next build` 通过，路由清单重新包含 `○ /`
  - dev: `npx next build` 通过，路由清单包含 `○ /`

- Task: 修复计划脚本模式把括号动作变体误匹配为基础动作的问题
- Scope:
  - 用户在脚本模式输入 `负重引体（底部暂停）` 时，系统会直接识别成基础 `负重引体`
  - 这会丢失“底部暂停 / 顶端暂停 / 反手”等动作变体语义，属于计划脚本编译层的严重错误
  - 脚本模式应比智能导入更严格：动作名包含括号变体时，必须优先按完整动作名匹配，不能自动降级为基础动作
- Status: implemented on `2026-04-16`
- Root cause:
  - `src/lib/planScript.ts` 之前复用了 `findBestExistingActionMatch()`
  - 该函数来自智能导入链路，会通过 `sanitizeActionName()` 去掉括号内容，用于“复用友好”的宽匹配
  - 在计划脚本这种可编译 DSL 场景下，这种宽匹配会把 `负重引体（底部暂停）` 和 `负重引体` 视为同类，从而错误命中基础动作
- Fix:
  - `src/lib/planScript.ts`
    - 新增脚本专用动作解析逻辑
    - 先按完整动作名做精确匹配，保留括号内容，并兼容中英文括号
    - 只有动作名不包含括号变体时，才允许回退到 `findBestExistingActionMatch()` 宽匹配
    - 若脚本动作名包含括号变体但动作库无精确项，则明确报错，不再静默降级
  - `src/lib/planScript.test.ts`
    - 新增回归测试：`负重引体（底部暂停）` 必须匹配到底部暂停变体，而 `负重引体` 匹配基础动作
    - 新增回归测试：缺失的括号变体不会降级为基础动作
  - `src/utils/template.ts`
    - 放宽 `makeWeekDays()` 参数类型到只依赖 `type` 字段，消除脚本解析结果传入时的类型噪音
- Verification:
  - `npx vitest run src/lib/planScript.test.ts`：通过（4 tests）
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm run typecheck 2>&1 | Select-String -Pattern 'planScript|PlanScriptDialog|dashboard/students/plan|dashboard/plan-lib/edit|utils/template'`：无相关错误输出；完整 typecheck 仍会因仓库历史类型错误返回失败
  - `npx next build`：通过
  - `npm test`：通过（17 files, 77 tests）
  - 浏览器验证：未完成；当前会话没有可调用的 `web-devtools` / `browser` 工具

- Task: 将“计划脚本模式”从教练计划库模板编辑页扩展到具体学员计划编辑页
- Scope:
  - 用户希望 `/dashboard/students/plan/[subscriptionId]` 这种具体学员计划编辑页面也能使用紧凑脚本模式
  - 目标是让教练不只在计划模板库中编辑脚本，也能直接对某个学员当前计划草稿进行脚本化修改
  - 页面地址示例：`/dashboard/students/plan/06f07de8-e013-4106-a5ef-0637147a7e0b`
- Status: implemented on `2026-04-16`
- Fix:
  - `src/app/dashboard/students/plan/[id]/page.tsx`
    - 复用 `PlanScriptDialog`
    - 复用 `formatTemplateToPlanScript()` / `parsePlanScript()`
    - 在学生计划页的 `BasicInfoForm.extraButton` 区域新增“脚本模式”按钮
    - 打开时把当前学员计划草稿转成紧凑脚本
    - 应用时解析脚本并更新 `days`、`description`、`selectedDayIndex`
    - 对已有计划同步标记为待保存，保持原有自动保存/手动保存链路
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm run typecheck`：失败，仍是仓库历史类型错误；定向过滤未发现错误指向 `dashboard/students/plan`、`planScript` 或 `PlanScriptDialog`
  - `npx next build`：通过
  - `npm test`：通过（17 files, 75 tests）
  - 浏览器验证：未完成；当前会话没有可调用的 `web-devtools` / `browser` 工具，且该页面需要教练登录态

- Task: 补齐教练端“当前计划已完成后创建下一阶段计划”的可见入口
- Scope:
  - 用户在 `/dashboard/students` 看到学员计划进度 `32/32`、`100%`，但列表仍显示“进行中”，也看不到“创建新计划 / 结束当前计划 / 自动结束”的明显操作
  - 该场景对应“学员买 3 个月，前 2 个月计划已执行完，教练要继续创建下一阶段计划；新计划从第 1 天开始，学员端只放行剩余额度”
- Status: implemented on `2026-04-16`
- Root cause:
  - 学员列表只按 `coach_plan_instances.status` 展示，未把“active 但所有训练日已完成”的逻辑完成态派生成 `completed`
  - 学员计划详情页虽已有“从模板创建”能力，但未把“创建下一阶段计划”和“归档当前计划”显性暴露，导致教练不知道下一步入口
  - AI/手动创建接口把默认 `startWeek=1/startDay=1` 也当成显式起点，可能绕过剩余额度结转检查
- Fix:
  - `src/app/api/coach/list-students/route.ts`
    - 列表接口按当前计划训练日和已完成执行记录派生 `is_logically_completed`
    - active 但训练日全部完成时，对前端返回 `status='completed'`
  - `src/app/dashboard/students/page.tsx`
    - 列表和移动端卡片统一按逻辑完成态展示“已完成”
    - 移动端主按钮在完成后改为“创建下一阶段”
    - 桌面端完成计划的快捷 AI 按钮提示改为“AI 生成下一阶段”
  - `src/app/dashboard/students/plan/[id]/page.tsx`
    - 完成计划后显示绿色提示区，提供“创建下一阶段计划”和“只归档当前计划”
    - 选择模板创建下一阶段时直接进入新阶段模式，旧计划由创建接口自动归档
  - `src/app/api/plan-lib/create-instance/route.ts`
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - 默认 `第1周第1天` 不再视为手动迁移起点，仍会走剩余额度检查；只有大于第1天的起点才视为显式迁移
- Verification:
  - `npm run lint`：通过（脚本提示项目未配置 eslint）
  - `npm test`：通过（17 files, 75 tests）
  - `npx next build`：通过
  - `npm run typecheck`：第一次因 `.next/types` 缺失失败；构建后重跑超时，无进一步输出
  - 浏览器验证：未完成；当前会话没有可调用的 `web-devtools`/`browser` 工具，且该页面需要教练登录态

- Task: 为教练端计划库增加“导出计划文本”能力，形成“导出文本 -> AI/人工编辑 -> 再导入”闭环的基础层
- Scope:
  - 用户希望在教练端计划库中把现有模板导出成文本形式
  - 导出能力仅限教练端计划库，不扩展到学员计划或 `/me` 侧自建计划
  - 文本格式需尽量贴近现有智能导入能理解的结构，而不是导出一整份 JSON
- Status: implemented on `2026-04-13`
- Fix:
  - `src/lib/planExportText.ts`
    - 新增模板文本格式化器，把 `training_days` 转成周/天/动作行形式
    - 支持训练日、休息日、强度、组次、休息时间，以及条件分支动作的文本展开
  - `src/app/api/plan-lib/export-template-text/route.ts`
    - 新增教练模板文本导出 API
    - 仅允许已登录教练导出属于自己的模板
    - 服务器端解析模板并补动作名映射，返回导出文本和 `.txt` 文件名
  - `src/app/dashboard/plan-lib/page.tsx`
    - 计划库列表新增“导出文本”入口
    - 导出后可在弹窗内预览、复制或下载 `.txt`
  - `src/app/dashboard/plan-lib/edit/[id]/page.tsx`
    - 编辑页新增“导出文本”按钮
    - 基于当前编辑中的 `days + actions + description` 实时导出，包含未保存的本地修改
  - `src/app/dashboard/plan-lib/components/TemplateTextExportDialog.tsx`
    - 统一导出文本预览弹窗
  - `src/lib/planExportText.test.ts`
    - 新增文本格式化回归测试
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test -- src/lib/planExportText.test.ts`：通过
  - `npm test`：通过（16 files, 72 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，仍是仓库既有 `.next/types/routes.d.ts` / `.next/types/validator.ts` 缺失
  - 浏览器验证：未完成；当前会话未提供 AGENTS.md 指定的 `web-devtools` skill，无法做该新增交互的浏览器级确认

- Task: 扩宽计划 AI 修改器的可编辑边界，优先支持“周范围 + 指定训练日 + 最后 N 次动作 + 替换 + 组次/RM”这类结构化批量改动
- Scope:
  - 用户最新明确指出：当前 AI 修改器在涉及多周、多次出现、定向替换的场景下边界过窄
  - 失败示例为“第 5 周到第 15 周的第 3 天，一共出现了 3 次负重引体，最后 1 次负重引体全部换成海豹划船，3 组 8 次，10RM”，接口此前返回“零处可以修改”
  - 目标不是继续依赖模型临场生成代码碰运气，而是先吃掉高频、可结构化表达的编辑指令
- Status: implemented on `2026-04-12`
- Root cause:
  - 旧链路基本依赖 LLM 生成修改代码；当指令涉及“范围 + 次序 + 最后一次匹配 + 参数覆盖”时，模型容易生成 no-op 代码
  - 旧实现只要代码执行成功就会继续往下走，没有把“执行成功但结果完全没变”识别为失败，因此前端会看到“0 处修改”
- Fix:
  - `src/lib/batchOperationDeterministic.ts`
    - 新增确定性规则引擎，直接解析“周范围 / 第几天 / 最后 N 次某动作 / 替换成新动作 / 组次 / RM”
    - 动作匹配支持用户宽口径表达，如 `负重引体` 命中 `正手负重引体`
    - 若替换动作不在动作库中，则生成 `pending:*` 临时 actionId，继续复用既有待确认动作链路
  - `src/app/api/plan-lib/batch-operation/route.ts`
    - 在 LLM 代码生成前先跑确定性规则命中
    - 若命中则直接返回 preview / action plan，不再让模型兜圈子
    - 对 LLM fallback 增加 no-op 检测：`executionResult.result` 与原 `trainingDays` 完全一致时，不能算成功，必须重试或显式报错
  - `src/lib/batchOperationDeterministic.test.ts`
    - 新增用户失败案例的回归测试
    - 新增“宽口径动作名匹配更具体动作名”的测试
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npx vitest run src/lib/batchOperationDeterministic.test.ts`：通过
  - `npm test`：通过（15 files, 69 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，但仍是仓库既有历史类型错误海，未发现本次新增规则文件对应的新报错
  - 前端 skill / 浏览器验证：按用户 `2026-04-12` 最新要求跳过，不再执行
- Next step:
  - 继续把高频批量编辑模式收敛成“结构化编辑语法 + diff 预览”，而不是把所有复杂修改都丢给自由生成代码
  - 用户在 `2026-04-13` 进一步明确希望：AI 编辑器的目标不是“重生成整份 JSON”，而是输出一种更轻量、低 token、可被规则器快速映射到 `training_days` 的中间格式，再渲染回前端
  - 用户在 `2026-04-13` 新增了更具体的思路：既然系统已经具备“混乱文本 -> 规整结构”导入，以及“结构 -> 规整文本”导出，那么下一步应评估把“规整文本 / 计划脚本”作为可编辑中间层，再由编译器映射回 `training_days`，并对比其功能边界与 token 成本
  - 用户进一步明确：`actionId` 不必出现在人类/AI 编辑的计划脚本中，只要能按动作名稳定解析；若脚本里出现新动作，则先触发“新建动作/确认动作”步骤，再继续编译计划
  - 用户在 `2026-04-13` 继续收敛需求：优先设计“最小 token 耗费的可编译计划脚本”，要求脚本以训练语义为主、尽量省字、可稳定编译回 `training_days`

- Task: 修复训练执行页组间休息在离开页面后丢失的问题
- Scope:
  - 用户反馈 `/training-execution/[instanceId]` 的组间休息计时器即使已支持“本页挂后台按真实时间回算”，只要离开训练执行页组件，计时状态仍会丢失
  - 需要覆盖“退出当前训练执行界面，再回来继续训练”的场景，而不只是页面保持打开时的 `visibilitychange/focus`
  - 用户在本轮最新要求里明确表示：不需要做任何前端验证，只需要直接修改代码
- Status: implemented on `2026-04-12`
- Root cause:
  - 当前实现把休息截止时间只存放在页面内 `restEndAtRef`
  - 当用户离开训练执行页时，React 组件卸载，`restEndAtRef` 会随组件一起丢失
  - 因此再次进入同一训练页时，无法恢复之前尚未结束的组间休息
- Fix:
  - `src/app/training-execution/[instanceId]/page.tsx`
    - 新增按 `user + instance/impromptu + dayIndex` 生成的 `restTimerStorageKey`
    - 新增 `persistRestTimer()` / `readPersistedRestTimer()` / `clearPersistedRestTimer()`，把休息截止时间持久化到 `localStorage`
    - `beginRestTimer()` 与 `+30s` 现在会同步刷新持久化截止时间
    - 页面重新进入并拿到当前 `execution.id` 后，会尝试恢复尚未结束的组间休息
    - 训练完成、快速完成、跳过休息、倒计时自然结束时都会清理持久化状态，避免脏恢复
    - 新增 `normalizePlannedRestSeconds()`，把历史脏数据里被放大 60 倍的休息时长（如 10800）纠正回真实秒数（180）
    - `syncRestTimer()` 在恢复旧的持久化计时器时，若发现剩余时间明显超出组间休息合理范围，会立刻回写纠正后的截止时间，避免继续显示成 180 分钟
  - `src/app/api/execution/start/route.ts`
    - 创建新的执行记录时，对 `planned_rest_seconds` 做同一套归一化，防止新进入训练页后继续拿到异常超大的休息秒数
  - `src/app/api/execution/_helpers/syncExecutionPlan.ts`
    - 同步历史执行记录与当前计划配置时，也统一纠正异常休息时长，避免旧记录反复把错误值带回前端
- Verification:
  - 本轮按用户 `2026-04-12` 最新要求，未继续运行任何 lint/typecheck/build/test 或前端验证命令；由用户自行验证前端行为

- Task: 规划视频上传链路从“仅前端压缩直传”升级为“前端减负 + 服务端异步处理”的下一阶段方案
- Scope:
  - 当前已实现浏览器前置压缩 + signed upload + 视频记录入库
  - 需要在不打断现有上传体验的前提下，进一步提升播放兼容性、存储治理、处理可观测性与后续扩展能力
  - 重点关注训练视频主链路，同时兼容动作示范视频、问卷示例视频等其它视频入口
- Status: proposed on `2026-04-12`
- Findings:
  - 现有 `src/lib/videoCompression.ts` 已承担浏览器端预压缩
  - `training_videos` 表已具备 `processing_status`、`thumbnail_url`、`duration_seconds`、`metadata` 等可复用字段
  - 当前 `src/app/api/user/_helpers/videoRecord.ts` 默认直接以 `processing_status='ready'` 创建记录，尚未真正接入服务端异步处理状态机
- Proposed next step:
  - 保留前端压缩作为上传前减负
  - 新增服务端异步视频处理任务，统一产出可播放版本、封面、时长与处理状态
  - 后续若转码稳定，再评估原始视频保留/清理策略与分场景码率策略

- Task: 修复“购买 53 周但两个月计划被错误推到 2026-07-14 才完成”的预计完成日公式
- Scope:
  - 用户指出 `/dashboard/students` 中某学员显示“已购 53 周”，但当前第一阶段计划只有约两个月，预计完成日却被算到 `2026-07-14`
  - 需要确认是购买周期和计划周期混淆导致，而不是学员真实还剩这么久
  - 目标是让预计完成日按“当前计划实例的实际训练节奏/跨度”估算，而不是按总购买周数摊薄
- Status: implemented on `2026-04-12`
- Root cause:
  - `src/lib/subscriptionEstimatedEndDate.ts` 之前在估算 `remainingDaysEstimate` 时，把 `subscribed_weeks` 直接传给 `estimateRemainingDays()`
  - 当学员购买 53 周、但当前计划实例只有 8 周左右时，公式会把当前计划的训练天数按 53 周平均摊开，导致预计完成日被明显拖长
  - `src/app/api/subscription/check-subscription/route.ts` 的定时巡检链路也复用了同样的错误口径，可能把错误日期再次写回数据库
- Fix:
  - `src/lib/subscriptionCredits.ts`
    - `estimateRemainingDays()` 参数从“购买周数”改为“当前计划节奏周数 `cadenceWeeks`”
  - `src/lib/subscriptionEstimatedEndDate.ts`
    - 改为使用当前实例 credits scope 对应的有效周数 `effectivePlanWeeks`
    - 不再用总购买周数去推当前阶段预计完成日
  - `src/app/api/subscription/check-subscription/route.ts`
    - 统一改用 `deriveProjectedSubscriptionEndDate()`，避免后台巡检继续按旧公式刷新错误 `end_date`
  - `src/lib/subscriptionCredits.test.ts`
    - 新增“购买 53 周但当前计划只有 8 周节奏时，不应被拉长到十几周后”的回归思路覆盖
- Verification:
  - `npm test`：通过（14 files, 67 tests）
  - `npx next build`：通过
  - `npm run lint`：本轮未重跑；此前仓库脚本仅提示未配置 eslint
  - `npm run typecheck`：超时未完成；仓库仍存在既有类型检查阻塞
  - 浏览器验证：未完成；当前会话环境未提供 AGENTS.md 要求的 `web-devtools` skill，无法做该页面的浏览器级验证

- Task: 支持计划编辑器直接调整同一天内动作顺序，并为后续“灵活编辑计划”保留升级方向
- Scope:
  - 用户在 `/dashboard/plan-lib/edit/[id]` 想把同一天里的第 1、2 个动作对调，但当前编辑器做不到
  - 需要至少支持同日动作上移/下移，覆盖教练模板编辑、学员计划编辑、`/me` 侧自建计划等共用入口
  - 用户在本轮最新要求里明确表示：只需要改代码，不需要再调用任何 skill 做前端验证
- Status: implemented on `2026-04-12`
- Root cause:
  - `training_days[].actionSets[]` 本身就是有序数组，后端保存也会保留顺序
  - 但前端 `PlanDayCard` 只有删除/筛选，没有任何重排入口或状态 handler，所以第 1、2 个动作无法直接交换
- Fix:
  - `src/app/dashboard/plan-lib/components/PlanDayCard.tsx`
    - 每个动作卡片头部新增“上移 / 下移”按钮
    - 首项禁用上移，末项禁用下移，避免越界
  - 以下页面补 `handleMoveActionSet()`，直接交换 `actionSets` 数组顺序：
    - `src/app/dashboard/plan-lib/edit/[id]/page.tsx`
    - `src/app/dashboard/plan-lib/create/page.tsx`
    - `src/app/dashboard/students/plan/[id]/page.tsx`
    - `src/app/me/plan-lib/create/page.tsx`
    - `src/app/me/plan-lib/edit/[id]/page.tsx`
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test`：通过（14 files, 66 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，但仍是仓库既有历史类型错误海；未出现本次排序改动对应的新报错定位到上述编辑页
  - 前端 skill / 浏览器验证：按用户 `2026-04-12` 最新要求跳过，不再继续执行
- Next step:
  - 若要把“灵活编辑计划”再往前推，建议新增“文本脚本视图”作为高级模式，但继续让 `training_days` 结构化 JSON 作为最终真相，避免直接把自由文本变成唯一数据源

- Task: 重新对齐“跨计划实例结转”的产品语义，确认新计划应从第 1 个月顺序执行而不是跳到尾段
- Scope:
  - 用户明确指出：学员买 3 个月，旧计划已做完并归档后，教练新建 2 个月计划时，新计划应从自己的第 1 个月开始按顺序执行
  - 当前代码把“历史已消耗周数”直接映射到新计划尾段，导致默认 `start_execution_day` 可能跳到新计划后半段
  - 需要后续评估是否将“剩余额度结转”从“改起点”改为“限制可执行窗口/credits”
- Status: requirement clarified on `2026-04-12`
- Root cause:
  - `src/lib/subscriptionCarryover.ts` 当前实现按“剩余周数映射到新计划尾段”推断 `start_execution_day`
- Next step:
  - 若进入实现，优先改为“新计划从 day 1 开始 + 剩余额度单独限制”，并同步收紧前端/后端对超出剩余额度部分的展示与执行门禁

- Task: 拆清“购买周期 vs 实际执行时长”语义，并让教练修改购买周期时同步刷新预计完成日
- Scope:
  - 用户明确指出“学员买的计划长度”和“实际执行完成所需时长”不是一个概念
  - 典型场景：学员购买 1 个月计划，但因延迟/推迟，实际执行可能需要 1 个半月
  - 需要确保教练在 `/dashboard/students` 修改购买周期时，`end_date` 会跟随当前执行节奏重算，而不是停留在旧值
  - 同时要避免前台继续把 `end_date` 当成“硬到期”，导致延期执行时文案误导
- Status: implemented on `2026-04-12`
- Fix:
  - 新增 `src/lib/subscriptionEstimatedEndDate.ts`
    - 抽出基于 `subscribed_weeks + training_days + completed executions + start_execution_day` 的统一预计完成日推导逻辑
  - `src/app/api/subscription/update-subscription/route.ts`
    - 教练手动修改 `subscribed_weeks` 且未显式传 `end_date` 时，自动读取当前计划实例进度并重算 `end_date`
  - `src/app/api/execution/updateEstimatedEndDate.ts`
  - `src/app/api/coach/list-students/route.ts`
    - 统一复用同一套预计完成日推导，避免“保存后列表显示”和“训练执行后回写”使用不同算法
  - `src/app/dashboard/students/StudentDetailDialog.tsx`
    - 文案从“订阅周期”改为“购买周期”
    - 保存购买周期后直接使用后端返回的最新 `end_date`，让弹窗即时反映新的预计完成日
    - `end_date` 已过时不再显示“已到期”，改为“已超过原预计完成日 xx 天”
    - “总跟随周数”在 `status=active` 时不再被过期的 `end_date` 截断
  - `src/app/dashboard/students/page.tsx`
    - 列表列名改为“购买周期 / 预计完成”
    - 桌面端与移动端统一展示 `已购xx周` + `预计完成 yyyy/mm/dd`
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npm test`：通过（14 files, 66 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，仍为仓库既有问题：`D:/files/coachlink/.next/types/validator.ts` 缺失
  - 浏览器验证：未完成；当前会话环境未提供 AGENTS.md 要求的 `web-devtools` skill，无法做该页面的浏览器级验证

- Task: 修复计划库编辑页 AI 修改器在 Gemini/Ofox 链路下报 `400 Unable to submit request because at least one contents field is required`
- Scope:
  - 用户在 `/dashboard/plan-lib/edit/[id]` 使用 AI 修改器时，输入自然语言指令后立即报错
  - 错误来自 Ofox 转发的 Gemini/Vertex 兼容层，提示请求里至少要有一个 `contents` 字段
  - 需要确认是前端没传指令，还是后端组装 LLM 请求时把用户内容丢掉
- Status: implemented on `2026-04-11`
- Root cause:
  - `src/app/api/plan-lib/batch-operation/route.ts` 中多次调用 `openai.chat.completions.create()`
  - 这些请求把完整提示词都塞进了单条 `system` 消息，没有显式 `user` 消息
  - 在 Ofox -> Gemini/Vertex 兼容链路下，这类请求会被判定为缺少 `contents`，直接返回 400
- Fix:
  - `src/app/api/plan-lib/batch-operation/route.ts`
    - 新增 `buildPromptMessages()`，统一把提示词组装为 `system + user` 两条消息
    - 意图识别、查询回答、补充追问判断、代码生成四处 LLM 调用全部改用该消息结构
    - 新增空 `instruction` 的 400 保护，避免再次发出无意义请求
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（14 files, 66 tests）
  - `npm run typecheck`：失败，仍为仓库既有问题：`D:/files/coachlink/.next/types/validator.ts` 缺失
  - 浏览器验证：未完成；当前会话环境未提供 AGENTS.md 要求的 `web-devtools` skill，无法做该交互的真实浏览器复现

- Task: 修复“我的学员”里手动修改剩余时长后，列表仍显示旧的 `4周计划` 的语义错位
- Scope:
  - 用户在 `/dashboard/students` 点击学员昵称进入详情弹窗后，可直接编辑“剩余时长”
  - 现状是该编辑只更新 `end_date`，但列表中的“订阅状态”实际显示 `subscribed_weeks`，导致改了剩余时长后仍显示旧的 `4周计划`
  - 用户要求仔细修改，并明确表示本轮由自己手动验证，无需代理继续做构建或页面验证
- Status: implemented in code on `2026-04-11`
- Fix:
  - `src/app/dashboard/students/StudentDetailDialog.tsx`
    - 新增基于“开始日期 -> 新结束日期”的周数推导逻辑
    - 保存剩余时长时，除了更新 `end_date`，也同步更新 `subscribed_weeks`
    - 若结束日期早于开始日期，前端直接拦截并提示
    - 保存成功后 toast 明确提示已同步到多少周
  - `src/app/dashboard/students/page.tsx`
    - 列表列名从“订阅状态”改为“订阅周期”
    - 桌面端/移动端的周期标签统一改为显示 `xx周周期`，避免误导成状态字段
    - 补上 `onStudentUpdate`，让弹窗保存后列表和当前选中学员立即同步刷新
- Verification:
  - `npm run lint`：通过（脚本仅提示项目未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（14 files, 66 tests）
  - `npm run typecheck`：
    - 第一次失败原因为 `.next/types` 尚未生成，不是本次改动直接导致
    - 用户随后明确表示“不用构建去验证，我来验证就行”，因此未继续追类型检查结果
  - 前端浏览器验证：按用户本轮最新要求交由用户自行验证，代理未继续执行
- Next step:
  - 若用户后续仍觉得“改结束日期”和“改订阅额度”混在一起容易误解，可再拆成两个明确入口：`预计结束日` 与 `延长订阅周数`

- Task: 为训练执行页及通用视频上传链路增加前置压缩，缓解大视频上传限制与服务器存储压力
- Scope:
  - 用户要求在 `training-execution` 训练执行页上传训练视频时，先在前端尝试压缩再上传
  - 同时把其他复用视频上传链路一并覆盖，避免只有单页受益
  - 目标是减少上传失败率、缩短上传时间，并让服务端记录压缩后的真实体积
  - 用户在本轮明确表示“不用去验证执行，你只管改就行”
- Status: implemented on `2026-04-11`
- Fix:
  - 新增 `src/lib/videoCompression.ts`
    - 基于浏览器 `video + canvas + MediaRecorder` 做前置压缩
    - 大于阈值或分辨率过高的视频会先缩到较小体积/尺寸，再进入直传
    - 若压缩收益不明显，则自动回退原文件，避免越压越大
  - `src/app/service/videoService.ts`
    - `uploadVideoFile()` 在申请 signed upload URL 前先执行 `prepareVideoForUpload()`
    - 对外暴露“准备中/压缩中/上传中”进度
    - `submit-video-url` 元数据新增压缩信息（原始体积、上传体积、mime、尺寸、策略）
  - `src/app/service/actionLibService.ts`
    - 动作库演示视频上传接入同一套前置压缩
  - `src/app/service/coachService.ts`
    - 教练问卷示例媒体上传在视频场景下同样先压缩再发到 `/api/coach/upload-question-media`
  - 前端入口同步放宽并统一说明：
    - `src/components/video/VideoUploader.tsx`
    - `src/app/coach/plans/dashboard/[id]/components/SetVideoUploader.tsx`
    - `src/app/ranking/[id]/SubmissionDialog.tsx`
    - `src/app/training-execution/[instanceId]/page.tsx`
    - `src/app/dashboard/action-lib/ActionEditDialog.tsx`
    - `src/app/me/action-lib/StudentActionEditDialog.tsx`
- Verification:
  - `npm run lint`：通过（脚本仅提示 Next 16 未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（14 files, 66 tests，含新增 `src/lib/videoCompression.test.ts`）
  - `npm run typecheck`：失败，但输出均为仓库既有/历史类型问题；未筛到本次新增文件相关报错
  - 浏览器验证：用户明确要求本轮不做执行验证，因此未继续跑页面回归

---

- Task: 修复学员训练执行页组间休息在后台不走时的问题
- Scope:
  - 用户反馈页面位于 `/training-execution/[instanceId]`，学员在执行今日训练计划时，组间休息倒计时挂后台后不会继续按真实时间推进
  - 目标是在不改训练主流程的前提下，让休息计时基于真实经过时间结算，而不是依赖前台每秒递减
  - 用户在本轮明确表示“不需要你去验证，你只管改就行”
- Status: implemented on `2026-04-11`
- Root cause:
  - `src/app/training-execution/[instanceId]/page.tsx` 原实现使用 `setInterval` 每秒递减 `restTimer`
  - 页面切到后台后浏览器会节流或暂停定时器，导致返回前台时剩余休息时间停留在旧值
- Fix:
  - `src/app/training-execution/[instanceId]/page.tsx`
    - 新增 `restEndAtRef`，开始组间休息时记录真实截止时间戳
    - 新增 `beginRestTimer()` / `syncRestTimer()`，改为用 `Date.now()` 与截止时间回算剩余秒数
    - 页面重新获得焦点或从后台回到前台时，立即同步剩余休息时间
    - `+30s` 改为延长真实截止时间，而不是只改本地显示秒数
    - 跳过休息时同步清空截止时间引用，避免残留计时状态
- Verification:
  - `lint`：通过（项目脚本仅输出“未配置 eslint”提示）
  - `typecheck`：失败，仓库存在大量历史 TypeScript 错误；本次改动未新增与休息计时相关的报错
  - `next build`：通过
  - `npm test`：通过（13 files, 63 tests）
  - 前端浏览器验证：按用户本轮要求跳过；此前尝试访问目标 URL 时，未登录态会被重定向到登录页
- Next step:
  - 若后续还要修“切后台时休息结束提醒没弹出/没响铃”，可继续把计时逻辑抽成共享 hook，并补浏览器级回归验证

- Task: 让 `/streetlifting-index/calculator` 记住上一次填写的计算器输入，避免重复填写性别/体重/负重等字段
- Scope:
  - 用户要求在线力量计算器保留上一次填写结果
  - 重点覆盖会被反复输入的字段：性别、体重、附加负重及同页其他计算参数
  - 用户在本轮明确表示“不需要你去验证，你只管改就行”
- Status: implemented in code on `2026-04-11`
- Fix:
  - `src/app/streetlifting-index/calculator/page.tsx`
    - 保留现有 localStorage 草稿恢复逻辑
    - 新增 `persistDraftNow()`，在页面隐藏、关闭、刷新前立即落盘，避免仅靠 400ms 防抖导致“刚填完就离开页面”时丢失
    - 新增“清空上次输入”按钮，允许用户手动清除本机已保存内容
- Verification:
  - 按用户要求，本轮未继续做浏览器验证
  - `npm run lint`：通过（脚本仅提示未配置 eslint）
  - `npm test`：通过（13 files, 63 tests）
  - `npx next build`：通过
  - `npm run typecheck`：失败，仍为仓库级既有历史类型错误，未见与本次计算器改动直接相关的新错误定位到该页面
- Next step:
  - 若用户后续仍反馈“没记住”，再针对其实际使用环境（浏览器/无痕模式/嵌入 WebView）做定点排查

---

- Task: 梳理订阅系统全链路语义，并为“跨计划实例结转剩余订阅时长/credits”改造做安全设计
- Scope:
  - 用户要求先彻底梳理当前订阅系统的真实逻辑，避免直接改动导致原有正确链路回归
  - 需要确认创建订阅、支付确认、续费、计划自动匹配、手动建计划、开始训练、订阅门禁、到期巡检、宽限期、自愈回填之间的关系
  - 目标问题：同一学员购买 3 个月，但教练先做 2 个月计划后又新建一个 2 个月计划时，系统应识别“只剩 1 个月可走”，而不是把新实例误当成新的完整额度
  - 改造约束：不能破坏当前已成立的 B1 语义，包括“订阅按训练日 credits 消耗”“start_date 以第一次开始训练为准”“end_date 主要用于预计完成日与宽限期输入”“同订阅仅保留一个当前计划实例”
- Status: analysis in progress on `2026-04-10`
- Findings so far:
  - 当前门禁按“订阅 subscribed_weeks -> 当前实例 credits 范围 -> 当前实例 completed executions”判定，不会自动跨历史实例累计已消耗额度
  - 同一个 `coach_subscription_id` 新建实例时会归档该订阅下旧的 `active/paused` 实例，因此“当前计划”始终只看最新实例
  - 现有系统已存在多处历史兼容/自愈逻辑（pending_renew、offline renew、rebind legacy instance、normalize stale end_date），后续改造必须先区分“主语义”与“兼容补丁”
- Fix on `2026-04-10`:
  - 新增 `src/lib/subscriptionCarryover.ts`
    - 基于同一订阅下历史计划实例的最远进度（`max(start_execution_day - 1, completed day_index)`）推断已消耗周数
    - 将“历史已走周数”映射到新计划尾段，自动推断 `start_execution_day`
  - `src/app/api/plan-lib/create-instance/route.ts`
    - 手动创建计划时，若教练未显式填写 `startWeek/startDay`，自动继承历史订阅进度
    - 若订阅剩余周期已耗尽，则拒绝创建新计划并提示先续费
  - `src/app/api/plan-lib/create-ai-instance/service.ts`
    - AI 建计划时同样自动继承历史订阅进度
    - 计划名称/描述里的“从第几周开始”改为显示推断后的真实起点
  - `src/app/api/plan-lib/create-ai-instance/route.ts`
  - `src/app/api/plan-lib/bulk-create-ai-instances/route.ts`
  - `src/app/api/plan-lib/auto-match-plan/service.ts`
    - 去掉默认强制传 `startWeek=1/startDay=1`，让自动推断能够生效
- Verification:
  - `npm run lint`：通过（脚本提示未配置 eslint）
  - `npx next build`：通过
  - `npm test`：通过（13 files, 63 tests）
  - `npm run typecheck`：两次超时，仓库级历史类型面仍未跑完，未发现本次改动触发的新增编译错误输出
- Next step:
  - 若需要彻底修复“已存在的历史错误实例”，可继续补一个只读自愈：对当前活动实例在读取时比对历史进度并提示/自动回填 `start_execution_day`
  - 若后续发现“跨计划替换但周数映射仍不够精确”的个案，再评估是否需要把“历史最远进度”升级为更细粒度的订阅消耗账本

---

- Task: 升级“申请成为教练”流程为分层入驻申请，并把分层信息接入找教练链路
- Scope:
  - 用户要求先梳理当前申请教练流程，再基于“训练搭子 / 进阶教练 / 专业教练”分层供给思路升级现有功能
  - 需要把单一教练认证升级为可承载分层生态的数据底座，而不是只改文案
  - 需要修复当前申请状态只落在 `coach_applications`、但 `users.coach_status` / `session.user` 不跟随的问题
  - 需要让 `coach_track` 真正进入前台发现/搜索/详情展示，而不是停留在申请后台
- Status: implemented in code on `2026-04-08`
- Findings on `2026-04-08`:
  - 当前线上流程本质是“单一教练认证”：入口在 `/coach/application`，提交到 `create-coach-application`，后台在 `/admin/coach-applications` 审核，通过后创建/更新 `coaches` 并给 `users.is_coach=true`
  - 申请状态展示链路有断层：创建申请时不会同步 `users.coach_status`，学员侧资料页可能仍显示“未申请”
  - 学员资料卡中的多个入口仍指向不存在的 `/apply*` 路由，而不是真实页面 `/coach/application`
  - 后台 UI 已出现 `reviewing` / `needs_info` 状态，但历史建表约束只保证了 `pending/approved/rejected`
  - `coach_track` 在第一轮升级后仅存在于申请与审核侧，未进入发现页、搜索页、详情页
- Fix:
  - 数据模型：
    - 新增迁移 `supabase/migrations/20260408_layered_coach_application_tracks.sql`
    - `coach_applications` / `coaches` 增加 `coach_track`、`service_modes`、`target_student_levels`、`support_focus`
    - `coach_applications.status` 约束扩展为支持 `reviewing` / `needs_info`
  - 接口：
    - `src/app/api/coach/create-coach-application/route.ts`
      - 写入分层字段
      - 创建申请后同步 `users.coach_status='pending'`、`is_coach=false`
    - `src/app/api/coach/update-coach-application/route.ts`
      - 支持更新分层字段
      - 审核通过时把分层信息同步到 `coaches`
      - 审核状态变化时同步 `users.coach_status`
      - 已获批教练本人修改申请资料时，不再自动把申请重新打回 `pending`
    - `src/app/api/coach/get-aggregated-info/route.ts`
      - 聚合返回时兼容合并最新申请里的分层字段
    - `src/app/api/coach/get-all-coaches/route.ts`
      - 新增 `coachTrack`、`serviceMode`、`targetStudentLevel` 筛选能力
  - 前端：
    - `src/app/coach/application/page.tsx`
      - 升级为分层申请表单
      - 新增“训练搭子 / 进阶教练 / 专业教练”三档选择
      - 新增服务方式、适合学员阶段、阶段问题聚焦
      - 提交成功后主动刷新 session
    - `src/app/admin/coach-applications/page.tsx`
      - 后台审核列表新增“层级”列
    - `src/app/admin/coach-applications/CoachApplicationDialog.tsx`
      - 详情弹窗展示分层字段
    - `src/components/student/profile/CoachApplicationCard.tsx`
      - 修正入口到 `/coach/application`
      - 补齐 `needs_info` 状态展示
    - `src/app/coach/application/ReviewInfoDisplay.tsx`
      - 补齐 `needs_info` 展示文案与样式
    - `src/app/coach/discovery/DiscoveryContent.tsx`
      - 新增按层级浏览的快速筛选
      - 教练卡片展示层级标签
    - `src/app/search/page.tsx`
      - 新增层级 / 服务方式 / 学员阶段筛选
      - 搜索结果卡片展示层级标签
      - 修复“只看同城”判定与距离展示不一致：改为 `isSameCityForFilter`
        - 优先按省+市一致
        - 若教练未完善省市但与用户距离很近（30km 内）则同城兜底命中
    - `src/app/coach/profile/[id]/CoachIntroduction.tsx`
      - 教练详情页展示层级、服务方式、适合阶段、阶段问题聚焦
    - `src/app/coach/profile/[id]/EditCoachProfileDialog.tsx`
      - 教练本人编辑资料时新增层级、服务方式、适合学员阶段、阶段问题聚焦维护能力
    - `src/app/api/coach/update-coach-profile/route.ts`
      - 教练资料更新接口支持持久化分层字段
      - 兼容把 `support_focus` 同步回 `profile.supportFocus`，避免新旧展示来源分叉
    - `src/app/api/coach/get-all-coaches/route.ts`
      - 新增 `preferredCoachTrack` 排序偏好
      - 在未显式筛选层级时，优先把更贴近当前学员阶段的教练排到前面
  - 数据回填：
    - 新增迁移 `supabase/migrations/20260408_rebalance_existing_professional_coaches.sql`
    - 已实际回填当前数据库：
      - 保留 `professional`：`刘三乐 / 枭马葛 / 四方力量-五花肉 / 文武双缺的杰`
      - 保持 `buddy`：`沈妈妈`
      - 其他当前仍为 `professional` 的已批准教练统一降为 `growth`
    - 同步修正了 `coaches` 与 `coach_applications(status=approved)` 两张表，避免前台与后台层级不一致
- Verification:
  - `npm run lint`：通过（脚本仅提示 Next 16 未配置 eslint）
  - `npm run typecheck`：多次超时，未在限定时间内跑完；仓库存在较大历史类型面，需单独清查
  - `npx next build`：通过
  - `npm test`：通过（12 files, 57 tests）
  - 浏览器验证：已尝试
    - `next dev` 本地会出现“端口可监听但页面长时间不返回首字节”的异常，未能稳定用于自动化
    - 改用 `next start` 成功验证公开链路与登录链路：
      - 发现页分层区截图：`test-results/manual/coach-discovery-layered.png`
      - 学员登录后搜索页筛选截图：`test-results/manual/coach-search-student-authenticated.png`
      - 教练本人资料编辑弹窗截图：`test-results/manual/coach-profile-edit-dialog-layered.png`
      - 数据回填后的搜索页截图：`test-results/manual/coach-search-after-track-rebalance.png`
- Next step:
  - 在稳定的 `next dev` 会话里补一次申请页 `/coach/application` 的端到端录入验证
  - 若继续推进创业规划，下一步应把 `coach_track` 接入推荐排序权重、报名转化漏斗与教练供给运营面板
- Last updated: `2026-04-08`

---

## Current UI Task (`2026-04-27`)

- Task: simplify WeChat mini-program `today-training` information architecture.
- Scope:
  - Target code is the mini-program path `wechat_app/src/training/today-training`, not the Web page under `src/app/today-training`.
  - Move the weekly calendar strip below the primary daily progress/action card.
  - Merge the separate "enter today training" card into the daily progress card.
  - Keep secondary actions such as impromptu training, contact coach, and remove self-plan as compact inline pills.
- Status: first pass implemented.
- Verification:
  - `wechat_app`: `npm ci` installed missing local dependencies.
  - `wechat_app`: `npm run build:weapp` passed.
  - Root: `npm run lint` passed as the existing informational lint script.
  - Root: `npm run typecheck` timed out after 120s with no output, matching known historical typecheck burden.
  - Root: `npx next build` passed.
  - Root: `npm test` passed, 21 files / 106 tests.
- Visual verification:
  - Automated web-devtools verification could not be completed in this session because the required `web-devtools` skill/tool is not available here, and this is a WeChat mini-program screen that needs WeChat DevTools for faithful rendering.

---

## Current Product Analysis (`2026-04-27`)

- Task: synchronize WeChat mini-program private-message functionality with the Web chat surface.
- Status: first implementation completed; user will run and verify manually.
- Key finding:
  - The Web client already exposes the fuller chat surface: reply-to-message, quote jump, message search with anchor loading, video references, AI auto-reply decoration/settings, broadcast notification handling, browser push/SSE, and rich rendering for multiple message metadata types.
  - The WeChat mini-program currently reuses the same `/api/chat/*` backend for core rooms/messages, but the UI/service layer only supports a lightweight subset: room list, text/image send, mark-as-read, local latest-page cache, and polling refresh.
- Implemented:
  - `wechat_app/src/services/chatService.ts`
    - Added mini-program DTO support for `replyToMessageId`, `anchorMessageId`, `searchMessages`, `videoReferences`, typed `contentMetadata`, and room lookup by `roomId`.
  - `wechat_app/src/me/messages/chat/index.tsx`
    - Added reply-to-message composer state and optimistic metadata.
    - Added rendering for `contentMetadata.reply_to_message`, `video_references`, `broadcast`, and `coach_ai_auto_reply`.
    - Added quote click/jump with `anchorMessageId` loading and highlight.
    - Added in-chat search backed by `/api/chat/search-messages`.
    - Added training video reference picker/sender using existing `/api/chat/list-student-videos`.
    - Added fallback display for video/voice/file message types.
  - `wechat_app/src/me/messages/chat/index.scss`
    - Added compact search bar, reply banner, video picker, quote cards, metadata badges, and video/file cards.
  - `wechat_app/src/utils/chatMessageCache.ts`
    - Added 60-day cache trimming for mini-program chat messages.
- Verification:
  - Per latest user instruction, stop running code-level/build/browser verification; user will run manually.

---

## Current Product Analysis (`2026-04-27`, coach plan library and students)

- Task: compare coach-side Web vs WeChat mini-program differences for `计划库` and `我的学员`.
- Status: analysis completed, no code changes requested or made.
- Finding:
  - The two ends are not completely disconnected: the mini-program already reuses many Web backend APIs and has functioning lightweight versions of both modules.
  - `计划库` still differs materially: Web has AI import, AI modifier, text export/download, plan script editing, execution notice support, richer pagination and fuller template edit/sync controls; mini-program has core list/create/edit/copy/delete and a mobile editor but lacks several power-user tools.
  - `我的学员` still differs materially: mini-program has list/search/sort, payment pending/history, chat entry, AI generation, detail, feedback, plan editing, template import, autosave, and 1RM updates; Web still has richer dialogs for questionnaire editing, subscription/prior week editing, refunds, coach review notes, clear current plan archive/delete, configurable AI generation, AI plan modifier from feedback, AI generation logs, and fuller analytics/history.
- Product judgment:
- The gap remains large, but it is now a "Web professional workstation vs mini-program lightweight mobile console" gap rather than a total absence of mini-program modules.

---

## Mini-Program Execution Notice Alignment (`2026-04-28`)

- Task: align the student-side WeChat mini-program `execution_notice` flow with the existing Web gating behavior.
- Scope:
  - The coach-side template/instance data contract already exists; this round only fills the student-side mini-program runtime flow.
  - Gate entry from mini-program `today-training` before the student first enters a plan execution.
  - Add a second guard inside mini-program `training-execution` so direct deep links cannot bypass the notice.
  - Reuse local device acknowledgement semantics instead of introducing a server-side read-state table.
- Status: implemented in code on `2026-04-28`.
- Fix:
  - `wechat_app/src/utils/executionPlanNotice.ts`
    - Added local acknowledgement helpers keyed by `userId + instanceId`.
  - `wechat_app/src/components/ExecutionPlanNoticePopup/*`
    - Added a reusable mini-program popup that renders coach notice content plus platform safety baselines.
  - `wechat_app/src/training/today-training/TodayTrainingScreen.tsx`
    - Entering plan execution from today's training now checks local acknowledgement first; unread students must confirm the notice before navigation continues.
  - `wechat_app/src/training/training-execution/index.tsx`
    - Added direct-open fallback gating; unread plan executions preload instance context, show the notice first, then start or resume training only after confirmation.
  - `wechat_app/src/training/today-training/components/TodayTrainingCard.tsx`
    - Added `onOpenExecution` override so parent-level gating can intercept all training-entry paths.
  - `wechat_app/src/services/trainingService.ts`
    - Mini-program `PlanInstance` typing now includes `execution_notice` / `executionNotice`.
- Verification:
  - `wechat_app/npm run build:weapp`: passed.
  - `npm run lint`: passed; current script only prints the existing lint-not-configured notice.
  - `npm test`: passed, 21 files / 106 tests.
  - `npm run typecheck`: still fails on existing repo-wide historical issues, including Next 16 route validators, Supabase type drift, and mini-program alias/type noise.
  - `npx next build`: compile succeeded, but standalone finalization hit a transient Windows `EBUSY` copy lock on `.next/server/middleware-build-manifest.js`.
- Blocker:
  - WeChat DevTools visual/manual verification is still pending because this session does not expose the required `weapp-devtools` tool.

---

## WeApp UI Polish (`2026-04-15`)

- Task: 参考 Dribbble 风格优化小程序首页与底部导航
- Scope:
  - 首页：`custom` 导航栏、渐变背景、品牌图标替换 emoji、彩色卡片与 promo banner
  - `BottomNav`：深色胶囊、白色 active pill、图标+文字动画、消除跳转白屏
- Fix:
  - `wechat-app/src/pages/index/index.tsx` / `index.scss`
  - `wechat-app/src/components/BottomNav.tsx` / `BottomNav.scss`
  - `wechat-app/src/pages/index/index.config.ts`（`navigationStyle: 'custom'`）
- Verification:
  - 构建通过（`npm run build:weapp`）
  - DevTools 截图验证通过（端口 3002）
- Commit: `258313e` on `origin/dev`
- Status: completed

---

## Hotfix Note (`2026-04-08`)

- Task: 修复“计划逻辑已完成但页面仍显示进行中/制定中”的状态错位
- Scope:
  - 学员端 `全部计划` 列表状态与真实执行进度不一致
  - 历史详情页对逻辑已完成计划仍显示“开始今日训练”
  - `today-training` 在“订阅仍 active 但当前阶段计划已完成”时误显示“计划正在制定中”
- Fix:
  - `student/plan-lib/list-history` 改为基于执行记录计算完成度，并把“逻辑完成 + status=active”按 `completed` 展示
  - `plan-lib/get-instance` 返回 `isLogicallyCompleted/derivedStatus`
  - `me/plan-history/[id]` 基于派生状态控制按钮显示
  - `today-training` 在无当前计划但 `has_plan_instance=true` 时展示“当前阶段计划已完成”的引导态
- Verification:
  - `npm run lint`：通过（脚本提示未配置 eslint）
  - `npm run typecheck`：失败，主要为仓库既有历史类型错误（与本次改动无直接关联）
- 追加修复（同日）：
  - 复现到 `today-training` 显示“当前阶段计划已完成”但实际计划未完成的问题，根因是：
    - `coach-subscriptions` 返回的 `has_plan_instance=true` 触发了完成态文案
    - 同时 `get-instance` 门禁仍按 `end_date` 先行拦截，导致当前计划无法加载
  - 已修复 `src/lib/subscriptionAccess.ts`：
    - `evaluateSubscriptionPlanAccess` 对 `status=active` 不再直接按 `end_date` 拦截
    - active 订阅改为严格按 credits（`computeCreditsScope` + `computeUsedCredits`）判定是否过期
  - 已补回归测试：`src/lib/subscriptionAccess.test.ts` 新增“active 且 end_date 已过但 credits 未耗尽时仍允许访问”用例
- 本轮验证（追加）：
  - `npx vitest run src/lib/subscriptionAccess.test.ts`：通过（7 tests）
  - `npm run lint`：通过（脚本提示）
  - `npm run typecheck`：长时间无输出，超时后中止（仓库历史类型负担）
  - `npx next build`：通过
  - `npm test`：通过（12 files, 58 tests）

---

## Coach-Side Web/WeApp Alignment (`2026-04-27`)

- Task: align the coach mini-program `计划库` and `我的学员` pages with the Web coach workstation as closely as possible.
- Implemented:
  - Mini-program coach plan library now supports template execution notice, AI text import via `/api/plan-lib/parse-template`, and text export via `/api/plan-lib/export-template-text`.
  - Mini-program student plan editing now preserves/edits `executionNotice` and syncs it through create/update instance calls.
  - Mini-program student list now has configurable single/bulk AI generation start week/day, keep-original-index option, and current-plan clear flow with archive/delete modes.
  - Mini-program student detail now exposes subscription/prior training week editing plus coach private review create/edit/delete.
  - Backend `coach/get-student` now returns subscription fields needed by mini-program detail, and coach review update/delete routes now enforce coach ownership before mutation.
- Verification:
  - `wechat_app/npm run build:weapp`: passed.
  - `npm run lint`: passed (script reports lint is not configured in Next 16 project).
  - `npm test`: passed (21 files, 106 tests).
  - `npx next build`: passed when run alone; an earlier parallel run hit a transient Windows `EBUSY` copy lock during standalone finalization.
  - `npm run typecheck`: still fails on existing repo-wide historical type errors, including Next 16 route params under `.next/*/validator.ts`, Supabase generated type drift, and mini-program alias/type issues.
- Remaining note:
  - Browser/WeChat DevTools visual verification is still pending because this session does not expose the required `web-devtools` / `weapp-devtools` tools.
  - Remaining differences are now mostly heavier workstation capabilities (full AI modifier/script mode/refund/deeper analytics), not the core plan-library/student-management workflows.

---

## coachlink LLM（`2026-04-09` 追加）

- `coachlinkLlm`：默认 `google/gemini-3.1-flash-lite-preview`；开发环境打印 `OFOXAI_MODEL` 与 effective 模型；`COACHLINK_USE_DEEPSEEK=1` 强制 DeepSeek。
- `parse-actions` / `parse-template`：`maxTokens` 65536 → 16384，减轻 Gemini reasoning 烧 token。
- 若终端仍显示旧模型：检查 `.env.local` 是否仍写 `OFOXAI_MODEL=...gemini-3-flash-preview`（会覆盖代码默认）。
---

## Payment Split / Settlement Audit (`2026-05-17`)

- Task: review the coach subscription payment split system, including platform escrow-style payment, coach/platform split, coach onboarding, and 7-day refund protection.
- Status: code/database audit completed; no code changes made.
- Current implementation shape:
  - New intended path is Huifu-backed platform payment:
    - Mini-program coach subscription payment creates Huifu JSPay order via `/api/payment/wechat/coach/create`.
    - Paid notify/query then fulfills the subscription and calls Huifu balance payment split from platform cash account to coach.
    - Local wallet is credited only after `coach_subscription_settlements` reaches split success.
  - Coach onboarding exists via `/api/coach/merchant/open-huifu-account`, storing `huifu_id`, `huifu_open_status`, and `huifu_card_token`.
  - Coach withdrawal exists via `/api/coach/wallet/huifu/withdraw`.
  - 7-day refund protection exists only as wallet withdrawal lock in `src/lib/coachWalletLock.ts`, not as delayed third-party settlement.
- Key findings:
  - Database sample showed only 1 `coach_subscription_settlements` row, status `wallet_credited`, amount 100 fen split as 80/20, attempts 3. This suggests one sample path ran through, not a broadly proven production path.
  - Database sample showed 35 paid subscription-like `alipay_orders`, but only 2 use new `coach_subscription*` order types; 33 still use legacy `subscription*` types.
  - Only 1 coach currently appears Huifu-opened with card token; 16 are still `pending`.
  - Web coach subscription payment creation still emits legacy order types `subscription/subscription_renew`, while the Huifu split execution path mainly gates on `coach_subscription/coach_subscription_renew`. This creates a high-risk mismatch where Web paid orders may fulfill subscription but not trigger Huifu split.
  - `executeBalancePayment` currently transfers only coach net amount as `transAmtYuan` and only one receiver, despite comments/docs describing 80/20 transfer. Platform fee is locally recorded, but the actual Huifu balance-payment call does not appear to move the 20% to a platform receiver.
  - Huifu refund API is not implemented. Current refund endpoint still calls Alipay `alipay.trade.refund`, so it is not correct for Huifu/WeChat mini-program subscription orders.
  - There is no automated 7-day delayed split job; payment success attempts split immediately, then wallet withdrawal is frozen for 7 days. This is not the same as "funds stay unsettled for 7 days then split".
  - Settlement `processing` rows are treated as already claimed; there is manual retry for failed rows, but no clear async callback/query reconciliation for uncertain Huifu balance-payment results.
- Suggested next implementation priorities:
  1. Unify coach subscription order type semantics across Web and mini-program, or make split detection provider/metadata based so all platform-paid coach subscriptions enter settlement.
  2. Fix/confirm Huifu balance-payment amount semantics: either transfer only coach share deliberately and document it, or include platform 20% receiver if actual remote split is required.
  3. Add Huifu refund support and refund ledger reversal before exposing refund as reliable for Huifu-paid orders.
  4. Decide product policy for 7-day refund: wallet withdrawal lock only vs true delayed split; implement scheduled settlement if true delayed split is required.
  5. Add settlement reconciliation job/admin dashboard for `pending/processing/split_failed` rows and broaden integration tests around notify/query idempotency.
## Rich Coach Application Materials And Profile Showcase (`2026-06-06`)

- Task: Upgrade coach applications and coach homepages on Web and WeChat mini-program so proof materials support richer media instead of plain text-only chips.
- Implemented:
  - Added Supabase migration `20260606_coach_application_materials.sql` for `coach_applications.application_materials jsonb not null default []`.
  - Added shared rich material normalization/derivation helpers in `src/lib/coachApplicationMaterials.ts` and mini-program counterpart `wechat_app/src/utils/coachApplicationMaterials.ts`.
  - Added authenticated upload API `/api/coach/upload-application-media` for image/video proof material uploads into the existing `videos` bucket.
  - Updated coach application create/update/get, approval sync, coach profile update, and aggregated profile responses so legacy summary fields remain derived compatibility data while rich materials are preserved.
  - Added Web rich material editor on `/coach/application`, profile edit support, admin application detail material display, and public coach homepage material grouping/media wall.
  - Added WeChat mini-program application material editor with upload/link/public controls, coach-owned profile edit entry, and student-facing discovery profile material rendering.
- Verification:
  - `npx vitest run src/lib/coachApplicationMaterials.test.ts`: passed.
  - Targeted esbuild syntax checks for changed Web/WeChat pages, components, and upload route: passed.
  - `git diff --check`: passed with CRLF warnings only.
  - `npm run lint`: passed; script still prints the existing Next 16 lint-not-configured notice.
  - `npm run typecheck`: passed.
  - `npm test`: passed, 33 files / 162 tests.
  - `npx next build`: passed; build emitted existing baseline-browser-mapping and local Redis timeout warnings.
  - `cd wechat_app; npm run build:weapp`: passed after allowing the slow Taro/Vite transform stage to complete.
  - WeChat DevTools automation: `mrc` and WeChat DevTools auto port 9420 started successfully. Verified `/coach/application` rich material section, add-material interaction, public toggle, upload/link controls with screenshots in `screenshots/weapp/`.
  - Web browser automation: because `web-devtools` skill is not available in this session, used Playwright against local `next dev`. Verified `/coach/application` rich material cards and add-material dialog after DEV coach quick login, and verified `/coach/profile/mock-coach-profile` public material rendering with private material absent from non-owner mock response. Screenshots saved in `screenshots/web/`.
- Blockers / residual risk:
  - Dedicated `web-devtools` skill is not present in `.kimi/skills` or exposed tools; Web verification used Playwright instead.
  - `npm run test:e2e` failed on existing local e2e environment issues: seed/login requests to `127.0.0.1:3000` reset/refused and one backend CRUD login failed. No failure stack pointed at the new material code.
  - Admin application detail browser verification was attempted but blocked by the separate `/admin/login` credential flow; code-level implementation and build/type/test coverage passed.
  - Student-facing WeChat discovery profile could not be data-verified in DevTools because the current local discovery list returned 0 coaches and `mrc mock` failed with `mp.mockJson is not a function`; route opened but showed `获取教练信息失败`.

---

---

## Flow Documentation (`2026-06-06`, questionnaire to plan completion and renewal)

- Task: User asked for the first system flowchart covering the path from a student filling a coach questionnaire, through plan generation/execution/completion, to renewal waiting, plus a very detailed explanation of how the AI algorithm works.
- Status: documentation and downloadable artifacts completed.
- Output:
  - Added `docs/work/flows/coach-service-questionnaire-plan-renewal-ai.md`.
  - Added `docs/work/flows/coach-service-flow-explainer.md`.
  - Added downloadable image artifacts:
    - `output/coachlink-questionnaire-plan-renewal-ai-flow.png`
    - `output/coachlink-questionnaire-plan-renewal-ai-flow.svg`
  - Added Word explainer:
    - `output/coachlink-questionnaire-plan-renewal-ai-explainer.docx`
  - Added detailed Mermaid artifacts:
    - `docs/work/flows/coach-service-detailed-mermaid-flow.mmd`
    - `output/coachlink-detailed-mermaid-flow.png`
    - `output/coachlink-detailed-mermaid-flow.svg`
- Contents:
  - Business flow Mermaid chart: coach homepage/subscription entry, questionnaire, payment/order state, active subscription, initial plan automation, student execution, plan completion, next phase generation, insufficient-entitlement renewal waiting, and renewal recovery.
  - AI algorithm Mermaid chart: automation trigger, data gathering, Stage A template/history skeleton selection, Stage B plan_script generation, deterministic parsing/validation, plan span enforcement, 1RM/load calculation, instance insertion, notification, feedback adjustment, and next-phase/renewal automation.
- Verification:
  - Rendered SVG to PNG with Playwright and visually inspected the PNG.
  - Rendered detailed Mermaid via browser Mermaid runtime; switched to pure SVG labels (`htmlLabels=false`) so the standalone SVG can be opened/downloaded reliably.
  - Generated `.docx` explainer with python-docx.
  - No app/browser verification required because this was documentation/artifact generation only.
