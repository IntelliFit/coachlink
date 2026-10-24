# coachlink agent rules

This workspace is dedicated to the `coachlink` project.

## 仓库结构（Monorepo）

- **主站（Web）**：Next.js 应用，路由目录为 `src/app/`。
- **微信小程序**：源码位于仓库根目录下的 **`apps/wechat/`** 目录。根目录禁止再使用 `app/` 存放小程序，以免被 Next.js 当成主站 App Router 目录并覆盖 `src/app/` 路由。
- **移动 APP**：源码位于仓库根目录下的 **`apps/mobile/`** 目录，技术栈采用 Expo + React Native，与 `food_link/apps/mobile` 保持同类工程方案。
- **Git 管理**：主站、小程序与 APP 统一在仓库根目录提交与推送；`apps/wechat/` 与 `apps/mobile/` 内不再保留嵌套 `.git`。

## Session Startup

- At the start of every new session, and again after compaction, read `IDENTITY.md`, `SOUL.md`, and `USER.md` before replying.
- Then read `PROJECT_STATE.md`, `CURRENT_TASK.md`, and `DECISIONS.md`.
- Also read `memory/YYYY-MM-DD.md` and yesterday's daily memory file if they exist.
- Treat these files as the source of truth over stale transcript memory when they disagree.
- If a required state file is missing, create it before continuing with non-trivial work.

## Role

- You are the coding agent for this project.
- You are currently responsible for the `coachlink` project only.
- If asked which project you are responsible for, answer clearly that you are responsible for `coachlink` and your working directory is the local clone path (例如 macOS 上常为 `/Users/<用户>/project/coachlink`，Windows 上可能为 `D:\files\coachlink`)。
- Work directly in this workspace and write the code yourself.
- Do not delegate coding work to Codex CLI, Claude Code, ACP sessions, or any other external coding agent unless the user explicitly asks.

## Frontend Verification

- **Web 主站**：必须使用 `web-devtools` skill 做浏览器端验证。
- **微信小程序（`apps/wechat/`）**：若改动涉及小程序页面、构建或真机/开发者工具行为，应使用 `weapp-devtools` skill 做验证（与 Web 的验证方式不同）。
- After any page, component, style, routing, or interaction change, you must attempt browser-based verification.
- Prefer screenshot evidence plus at least one interaction path that covers the changed behavior.
- If verification cannot run, explain the exact blocker in the final reply.
- If the user explicitly says they will manually run or verify the change (for example: `不用你测试，我来手动运行就行`), that instruction overrides the automatic browser/manual verification requirement for that task. In that case, do not run UI/manual verification yourself; focus on code changes and code-level checks, and state clearly in the final reply that manual verification was left to the user.

## 自动验收资源管理（强制）

- 微信开发者工具窗口属于可复用的项目资源，不属于每个对话的默认附件。不得因新对话、连接超时或截图失败而直接重复开窗。
- 设计与迁移步骤见 `docs/work/devtools-session-management-design-2026-10-06.md`。**目前尚无统一管理器实现**，不能声称已经自动排队或自动关窗；实现后所有验收脚本必须接入同一管理入口。
- 验收前核对项目完整路径、AppID、窗口标识、端口和构建目录，记录用途及当前占用者；空闲且版本匹配的窗口优先复用。窗口标题相同不能证明是同一项目；端口不同不能证明运行环境完全隔离。
- 同一逻辑小程序的导航、截图、mock、storage 操作必须串行；有人正在验收时，其他对话等待，不抢窗口。同一输出目录的构建、清缓存、配置切换也不得与验收并发；并行构建应使用完整且固定的独立输出。
- 新建窗口前必须先确认缺少可复用目标，并记录窗口由谁创建。规划上限为每个逻辑项目一个 AI 工作窗口、最多一个明确移交用户的验收窗口；达到上限先等待或回收已确认的闲置资源。用户原有窗口不计作可任意回收的 AI 窗口。
- 验收完成或失败均须执行收尾：恢复本任务 mock/测试 storage，断开连接，记录结果，并关闭本任务创建且未移交用户的临时窗口。借用的窗口只释放占用，不关闭。`disconnect()` 不等于关闭 GUI 窗口。
- 留给用户的窗口须明确标注项目、用途、固定构建版本与“待用户验收”，登记保留原因；不得留下归属不明的窗口后宣称交付完成。
- 超时只能在同一窗口有限重连；仍失败就收集错误并结束该次验收，不靠连续开窗恢复。归属不明、仍有活跃任务、存在未恢复测试状态或未保存内容的旧窗口，只盘点，不批量强杀开发者工具。

## Working Style

- Favor direct edits, concrete verification, and short status updates.
- Do not claim frontend behavior is correct unless you checked it in the browser or clearly state that it was not verified.

## Durable State

- Do not rely on chat transcript alone for project continuity.
- After any confirmed requirement, decision, blocker, milestone, ownership clarification, or handoff-worthy next step, write the durable part to files before the final reply.
- Update `CURRENT_TASK.md` for the actively worked task, status, blocker, or next step.
- Update `DECISIONS.md` for stable choices that should survive session resets.
- Append dated notes and short handoffs to `memory/YYYY-MM-DD.md`.
- When the user says "remember this" or corrects project context, write it down instead of keeping it only in conversation memory.

## Red Lines

- Never answer project ownership, current task, or decision history from stale transcript memory without rereading the state files.
- Never claim you are unassigned or unsure which project you own when `IDENTITY.md` and the state files are present.
- Never switch to another project by default.
- **禁止主动构建/推送镜像（2026-10-22 用户要求）。** `push-docker-ccr`、`push-boji-service-ccr`、Worker 镜像等任何 CCR 推送及随后的 K8s 滚动，只有用户在当前对话里明确说“推镜像/发布”时才执行；改完代码、提交或 `git push` 都不等于授权推镜像。多次改动先累积，由用户决定何时一起推（CCR 个人版有 100 标签上限）。
- **禁止把临时 Git worktree 的 `node_modules` 通过 Junction / symlink 指向主工作区或任何其他 worktree。** npm workspace 依赖会再次链接到 `apps/*`、`packages/*`，`git worktree remove` 或递归删除可能沿链接越界清空主工作区。
- 删除 worktree 或任何递归目录前，必须检查目标内的 reparse point；只有当所有链接目标都解析并确认位于待删除临时目录内部时才允许继续。含跨目录链接时必须先用“不遍历目标”的方式解除链接，禁止直接 `Remove-Item -Recurse` 或 `git worktree remove --force`。
- worktree 清理后必须立即检查主工作区 `git status --short`。一旦出现任何非预期 `D`，立刻停止所有后续清理/创建 worktree 操作，先恢复并完成事故审计，禁止带着异常继续执行。

## 设计规范

### 按钮样式（强制）
- **禁止任何按钮使用渐变色**（`linear-gradient` / `radial-gradient`）。
- 所有按钮必须使用纯色背景，主按钮使用品牌色 `#CF6D4E`，次按钮使用 `#FFFFFF` 边框样式。
- 按钮 `active` 态只允许调整透明度或加深纯色，禁止切换为渐变。

### 8 栅格理论（强制）
- 所有 **布局间距**（`margin`、`padding`、`gap`）必须为 **8rpx 的整数倍**。
- 所有 **元素尺寸**（`width`、`height`、`min/max-width`、`min/max-height`）应为 8rpx 的整数倍。
- `border-radius` 推荐值为 `8rpx`、`16rpx`、`24rpx`、`32rpx`、`48rpx`；`9999rpx` 仅用于胶囊/pill 形状。
- 以下属性可不受 8 栅格限制：`font-size`、`line-height`、`border-width`、`box-shadow`、`letter-spacing`。

## 代码修改规范

### 修改后检查流程
每次修改完成后，必须执行以下检查：

1. **语法检查** - 运行 lint 检查代码是否存在语法错误
   ```bash
   npm run lint
   ```
   > 注：本项目使用 Next.js 16，已移除内置 eslint，lint 脚本会提示运行 typecheck

2. **类型检查** - 检查 TypeScript 类型错误
   ```bash
   npm run typecheck
   ```
   > 项目存在历史类型错误，重点关注新增的错误

3. **构建验证** - 快速验证能否通过编译
   ```bash
   npx next build
   ```

4. **测试运行** - 确保修改不破坏现有功能
   ```bash
   npm test
   ```

### 常见错误处理

#### JSX 语法错误
- **症状**：`Expected '</', got '{'`
- **原因**：JSX 注释未正确闭合 `{/* ... */}`
- **修复**：确保注释以 `*/}` 结尾

#### 开发服务器崩溃
- **症状**：`ENOENT: no such file or directory, open '.next/dev/routes-manifest.json'`
- **解决**：运行 `npm run dev`，脚本会自动清理缓存并重启

#### 数据库列不存在错误
- **症状**：`column knowledge_nodes.is_collaborative does not exist`
- **原因**：数据库迁移未执行，代码查询了不存在的列
- **解决**：
  1. 短期：修改 API 代码，移除对缺失列的查询（兼容模式）
  2. 长期：在 Supabase 中执行迁移文件 `supabase/migrations/*.sql`

### BodyMap 组件注意事项

- **CSS 动画**：只使用颜色过渡（fill/filter），禁止使用 transform: scale() 影响 SVG 路径
- **高亮逻辑**：悬停时只高亮当前肌肉，已选中的不再同时高亮（hover 优先级 > selected）
- **布局**：控制按钮放在身体图上方，使用 flex justify-end 右对齐

### 开发服务器

- 使用 `npm run dev` 启动（已配置自动缓存清理和错误恢复）
- 如遇崩溃，脚本会自动清理 .next/dev 缓存并重启

## Web 运行配置（强制）

- Web 主站运行时配置采用严格单源模型，权威文档是 `docs/done/system-design/runtime-config.md`。
- 根目录 `.env` 是主配置/bootstrap 文件，只负责选择 `CONFIG_SOURCE=local|apollo`，以及该来源需要的少量 bootstrap 字段。
- `CONFIG_SOURCE=local` 时，只读取一个本地业务配置文件：`LOCAL_ENV_FILE` 指定的文件；未指定时开发默认 `.env.development`，生产 build/start 默认 `.env.production`。
- `CONFIG_SOURCE=apollo` 时，只读取 `.env` 里的 Apollo bootstrap 字段，然后从 Apollo 拉取全部业务配置；不得再读取 `.env.development`、`.env.production`、`.env.local` 或把本地业务配置和 Apollo 合并。
- `APOLLO_CONFIG_SERVER_URL` 必须填写最终地址，优先使用 `https://...`。不要使用会被 Nginx/Ingress 301 到 HTTPS 的 `http://...`，否则 Node fetch 跨协议重定向会丢失 `Authorization` / `Timestamp`，Apollo 日志会显示二者为 null。
- 运行时 Web 入口必须走 `scripts/config/bootstrap-env.mjs`：`npm run dev`、`npm run start` 和 Docker `CMD` 都已接入该 bootstrap。不要把运行入口改回直接 `next dev` / `next start` / `node server.js`。
- `npm run build` 默认不读取运行时 `.env`，因为 Docker/K8s 镜像构建阶段通常还没有挂载运行时配置。只有明确设置 `COACHLINK_BUILD_LOAD_RUNTIME_CONFIG=1` 时，构建才会读取本地/Apollo runtime config。
- 不要在 Web runtime 入口新增 `dotenv.config()`。如果用户或协作者问“配置怎么生效”，回答时应先说明 `.env` 决定 source，再按 local/apollo 分支说明，不能说“复制 `.env.example` 到 `.env.local`”。
- `NEXT_PUBLIC_*` 是构建期注入。Docker/K8s 构建应通过 build arg / CI 环境变量提供这些公开值，或显式设置 `COACHLINK_BUILD_LOAD_RUNTIME_CONFIG=1` 从 Apollo 获取；构建后改 Apollo 不会更新已构建的浏览器 JS。

## 测试与 Push 前门禁

### 三类测试必须同时存在

1. **前端交互测试**（UI 驱动）
   - 用例至少覆盖：登录、会话维持（刷新后仍已登录）。
2. **后端接口/数据库测试**（API 驱动）
   - 用例至少覆盖：学员个人计划基础 CRUD、教练计划基础 CRUD。
3. **AI 指令测试文件**
   - 必须维护一份可执行的 AI 测试 Prompt，指导代理按工具链完成回归测试。

### 幂等性强制要求

- 每一种测试都必须保证幂等性。
- 测试完成后数据库不得有残留变更（包括测试账号、计划、模板、执行记录等）。
- 所有创建数据都必须记录主键并在 `finally`（或等价清理流程）中删除。
- 即使断言失败，也必须执行清理。

### Push 前默认执行

在每次 `git push` 前，默认执行以下快速代码门禁并通过：

```bash
npm run lint
npm run typecheck
npm test
```

若任一命令失败，先修复后再 push，禁止带错提交远端。

`npm run test:e2e` **不再作为普通功能修改或每次 push 的默认门禁**。仅在以下情况运行：

- 用户明确要求执行 E2E；
- 本次修改直接涉及 E2E 覆盖的登录/会话维持、订阅流程或计划 API/数据库 CRUD；
- 用户要求发布前做完整回归。

若任务与上述链路无关，不得为了形式上的门禁消耗时间反复运行 E2E；应把时间优先用于当前问题的诊断、实现和针对性验证。

### 测试文件修改边界

- **除非用户明确要求**（例如：新增/调整测试、修复失败用例、补充覆盖率），否则在执行其他任务（功能开发、重构、文档等）过程中**不得随意修改**已有测试文件（含 `*.test.ts`、`e2e/*.spec.ts`、测试配置等）。
- 若业务变更导致测试失败：优先在回复中说明失败原因与建议，由用户决定是否授权改测；**用户授权后再动测试**。
- 例外：仅当测试失败**明确由本次被用户点名的改动**引起，且用户任务包含“修到绿”时，可最小范围修改相关测试。

## 移动端数据缓存策略（强制）

适用于 **App** 和 **微信小程序** 场景：

1. **存储范围**：默认仅存储过去 **60 天** 的记录。
2. **优先写本地**：任何数据变更必须先写入本地 `storage`，再异步同步到云端。
3. **优先读本地**：以本地 `storage` 为首要数据源，确保用户操作零延迟响应。
4. **异步拉取云端**：在读取本地数据的同时，后台异步拉取云端最新数据。
5. **云端优先更新**：当云端数据与本地不一致时，**永远以云端数据为准**更新本地 `storage`。
6. **本地作为缓存层**：本地 `storage` 承担数据缓存职责，保证离线可用和流畅体验。

### 微信小程序：今日训练页与训练执行页（落地规则）

以下与 `apps/wechat/` 中学员 **今日训练首页**、**训练执行** 相关；后续迭代**不得**在业务页里再写一套互不相认的 storage 键或 60 天规则，应复用或扩展既有工具。

| 用途 | Storage 键（常量见代码） | 工具模块 |
|------|--------------------------|----------|
| 今日训练首页聚合数据（订阅、计划、按天的 execution 摘要等） | `today_training_page_cache_v1` | `apps/wechat/src/utils/todayTrainingPageCache.ts` |
| 训练执行页「按次打开」的快照（整份 execution + planInstance + actions） | `training_execution_snapshots_v1` | `apps/wechat/src/utils/trainingExecutionCache.ts` |

**统一规则**

1. **60 天**：首页缓存整条 `savedAt` 过期即视为无效；训练执行快照按**条目** `savedAt` 裁剪，超过 60 天的条目删除（与上表「存储范围」一致）。
2. **进入训练执行**：可先读快照 **快速展示**，再请求云端；**云端返回后覆盖**本地快照（云端为准）。
3. **训练中写操作**：在 **`executionService` / `impromptuService` 等接口成功返回后**，必须同步更新：① 训练执行快照；② 计划模式下通过 `patchExecutionInTodayTrainingPageCache` 更新首页缓存里对应 `instanceId` 的 `executionsByDayIndex[dayIndex]`，以便返回今日训练页时**进度条与模块完成度**与刚完成的组一致（首页 `useDidShow` 仍会拉云端，本地补丁解决「返回瞬间」与弱网下的体验）。
4. **即兴训练**：只写训练执行快照，**不写**今日训练首页里的计划 execution 映射（无 `instanceId` 计划上下文）。
5. **新增「会改 execution 状态」的接口或 UI**：在成功回调里调用与现有 `syncTrainingExecutionToStorage` / `syncExecutionToCaches` 同级的持久化逻辑，避免只改内存不写 storage。

## SKILLS


- **port-manager** (`.kimi/skills/port-manager`) — Manage and allocate network ports across multiple local projects to prevent port conflicts.
- **weapp-devtools** (`.kimi/skills/weapp-devtools`) — 用于调试微信小程序的自动化工具集，基于 miniprogram-automator 封装，提供截图、元素检查、页面导航、网络 Mock 等功能。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
