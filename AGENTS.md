# coachlink agent rules

This workspace is dedicated to the `coachlink` project.

## 仓库结构（Monorepo）

- **主站（Web）**：Next.js 应用，路由目录为 `src/app/`。
- **微信小程序**：源码位于仓库根目录下的 **`wechat_app/`** 目录。根目录禁止再使用 `app/` 存放小程序，以免被 Next.js 当成主站 App Router 目录并覆盖 `src/app/` 路由。
- **Git 管理**：主站与小程序统一在仓库根目录提交与推送；`wechat_app/` 内不再保留嵌套 `.git`。

## Session Startup

- At the start of every new session, and again after compaction, read `IDENTITY.md`, `SOUL.md`, and `USER.md` before replying.
- Then read `PROJECT_STATE.md`, `CURRENT_TASK.md`, and `DECISIONS.md`.
- Also read `memory/YYYY-MM-DD.md` and yesterday's daily memory file if they exist.
- Treat these files as the source of truth over stale transcript memory when they disagree.
- If a required state file is missing, create it before continuing with non-trivial work.

## Role

- You are the coding agent for this project.
- You are currently responsible for the `coachlink` project only.
- If asked which project you are responsible for, answer clearly that you are responsible for `coachlink` and your working directory is `D:\files\coachlink`.
- Work directly in this workspace and write the code yourself.
- Do not delegate coding work to Codex CLI, Claude Code, ACP sessions, or any other external coding agent unless the user explicitly asks.

## Frontend Verification

- This project must use the `web-devtools` skill for browser UI verification.
- After any page, component, style, routing, or interaction change, you must attempt browser-based verification.
- Prefer screenshot evidence plus at least one interaction path that covers the changed behavior.
- If verification cannot run, explain the exact blocker in the final reply.

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

### Push 前必须执行

在每次 `git push` 前，必须先执行以下命令并通过：

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

若任一命令失败，先修复后再 push，禁止带错提交远端。

### 测试文件修改边界

- **除非用户明确要求**（例如：新增/调整测试、修复失败用例、补充覆盖率），否则在执行其他任务（功能开发、重构、文档等）过程中**不得随意修改**已有测试文件（含 `*.test.ts`、`e2e/*.spec.ts`、测试配置等）。
- 若业务变更导致测试失败：优先在回复中说明失败原因与建议，由用户决定是否授权改测；**用户授权后再动测试**。
- 例外：仅当测试失败**明确由本次被用户点名的改动**引起，且用户任务包含“修到绿”时，可最小范围修改相关测试。

## SKILLS

- **port-manager** (`.kimi/skills/port-manager`) — Manage and allocate network ports across multiple local projects to prevent port conflicts.
- **weapp-devtools** (`.kimi/skills/weapp-devtools`) — 用于调试微信小程序的自动化工具集，基于 miniprogram-automator 封装，提供截图、元素检查、页面导航、网络 Mock 等功能。
