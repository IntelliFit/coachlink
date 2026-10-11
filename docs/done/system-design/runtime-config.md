# Runtime Configuration

CoachLink Web uses a strict single-source runtime configuration model. The application can read business configuration from local env files or from Apollo, but it must not merge both.

## Source Selection

The root `.env` file is the bootstrap file. It is intentionally small and must only decide the config source plus the bootstrap fields needed for that source.

```env
CONFIG_SOURCE=local
LOCAL_ENV_FILE=.env.development
```

Valid values:

- `CONFIG_SOURCE=local`: load business config from one local env file.
- `CONFIG_SOURCE=apollo`: fetch all business config from Apollo.

Do not put Supabase keys, payment keys, LLM keys, or other business config in `.env` unless that value is an Apollo bootstrap value. In Apollo mode, local business env files are not loaded.

## Local Mode

In local mode, `LOCAL_ENV_FILE` selects the only business env file to load.

```env
CONFIG_SOURCE=local
LOCAL_ENV_FILE=.env.development
```

If `LOCAL_ENV_FILE` is omitted:

- development uses `.env.development`
- production build/start uses `.env.production`

The old `.env.local` merge pattern is not the project runtime contract anymore. Use one selected local env file so local behavior matches the production/Apollo source-selection model.

## Apollo Mode

In Apollo mode, `.env` contains only Apollo bootstrap settings:

```env
CONFIG_SOURCE=apollo
APOLLO_CONFIG_SERVER_URL=https://apollo-configservice.example.com
APOLLO_APP_ID=coachlink
APOLLO_CLUSTER=local
APOLLO_NAMESPACES=application.env
# APOLLO_ACCESS_KEY_SECRET=
# APOLLO_LABEL=
```

Apollo should store the business config as `.env` / Java-properties style key-value content:

```env
NEXT_SUPABASE_URL=https://...
NEXT_SUPABASE_ANON_KEY=...
NEXT_SUPABASE_SERVICE_ROLE_KEY=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://coachlink.fit
WANJIE_ARK_API_KEY=...
WANJIE_ARK_BASE_URL=https://maas-openapi.wanjiedata.com/api/v1
WANJIE_ARK_MODEL=deepseek-v4-pro
# WANJIE_ARK_FAST_MODEL=deepseek-v4-flash
```

JSON Apollo responses with a `configurations` object are also supported, but `.env` style content is preferred because the current codebase reads `process.env.KEY` directly.

## Startup Path

Runtime entry points run through `scripts/config/bootstrap-env.mjs`:

- `npm run dev` -> `scripts/start-dev.mjs`
- `npm run start` -> `scripts/start-prod.mjs`
- `npm run dev:debug-login` -> `scripts/start-local-debug.mjs` (explicit local-only mini-program account debugging)

The debug launcher uses the same single-source bootstrap. It binds only `127.0.0.1` (default port 3003), uses `.next-local-debug` and generates a per-launch pairing code/signing key in process memory. These are ephemeral developer controls, not Apollo business configuration and not normal auth secrets. Debug tokens expire after one hour and are rejected by ordinary/production servers. Background jobs and sensitive payment/admin/account-binding routes are disabled on this dedicated backend. The selected database may still be real: training writes are not sandboxed. See `docs/work/local-user-id-debug-login-2026-10-08.md` before use.

The bootstrap sets `__NEXT_PROCESSED_ENV=true` before launching Next.js. This prevents Next.js from auto-loading `.env.development`, `.env.production`, `.env.local`, or `.env` after the selected source has already been applied.

The standalone build copies `scripts/start-prod.mjs` and `scripts/config/` into `.next/standalone/`, and rewrites the standalone `package.json` start script to preserve the same bootstrap behavior after deployment.

`npm run build` does not load runtime config by default. Docker image builds normally do not have the runtime `.env` mounted yet, so build-time config must come from normal build args or process env. Set `COACHLINK_BUILD_LOAD_RUNTIME_CONFIG=1` only for environments that intentionally want the build to fetch local/Apollo runtime config before `next build`.

## Public Env Caveat

`NEXT_PUBLIC_*` values are compiled into the browser bundle during `next build`. Runtime changes to `NEXT_PUBLIC_*` after build do not update already-built client JavaScript. For Docker/K8s builds, pass required public values as build args or CI environment variables, or explicitly opt in to `COACHLINK_BUILD_LOAD_RUNTIME_CONFIG=1`.

Server-only values such as service-role keys, payment secrets, cron secrets, Redis credentials, and LLM keys are read at process startup.

## 万界方舟大模型配置

CoachLink 的服务端大模型调用统一使用万界方舟 OpenAI 兼容接口。将以下业务配置放入 Apollo，或放入 local 模式选中的单一业务配置文件：

```env
WANJIE_ARK_API_KEY=...
WANJIE_ARK_BASE_URL=https://maas-openapi.wanjiedata.com/api/v1
WANJIE_ARK_MODEL=deepseek-v4-pro
# WANJIE_ARK_FAST_MODEL=deepseek-v4-flash       # 意图判断/完整性检查等短任务（代码默认值）
# WANJIE_ARK_PLAN_MODEL=deepseek-v4-pro        # 可选；未配置时继承 WANJIE_ARK_MODEL
# WANJIE_ARK_PLAN_SCRIPT_MODEL=deepseek-v4-flash # 纯 PlanScript 计划编辑（代码默认值）
# WANJIE_ARK_PLAN_SCRIPT_FALLBACK_MODEL=claude-sonnet-4-6 # 仅用于本地无法确定解析的详细长计划
# WANJIE_ARK_ANTHROPIC_MESSAGES_URL=https://maas-openapi.wanjiedata.com/api/anthropic/v1/messages
# WANJIE_ARK_COACH_REPLY_MODEL=deepseek-v4-pro # 可选；未配置时继承 WANJIE_ARK_MODEL
# WANJIE_ARK_VISION_MODEL=qwen3-vl-flash        # 计划图片导入等视觉输入
```

`WANJIE_ARK_BASE_URL` 必须包含 `/v1`：项目使用的 OpenAI SDK 会在其后追加 `/chat/completions`，最终请求地址为 `/api/v1/chat/completions`。

计划分析、知识库问答、功率解读和教练自动回复等正文任务默认使用 `deepseek-v4-pro`；计划修改器的意图判断、指令完整性检查默认使用 `deepseek-v4-flash`。普通计划编辑读取 `WANJIE_ARK_PLAN_SCRIPT_MODEL`，默认 `deepseek-v4-flash`，模型只返回纯 PlanScript，不再输出包裹计划的 JSON。对于已经明确写出 8～12 周、每天动作、重量和组次的详细计划，服务端优先做确定性 PlanScript 提取并逐条校验处方数量，不再让模型重新抄写整份计划；只有本地无法确定解析的格式才通过万界方舟 Anthropic 端点按半周分段兜底，默认 `claude-sonnet-4-6`。`WANJIE_ARK_PLAN_SCRIPT_FALLBACK_MODEL` 与 `WANJIE_ARK_ANTHROPIC_MESSAGES_URL` 均为可选项，未配置时使用上面的代码默认值并复用同一 `WANJIE_ARK_API_KEY`。不要将视觉模型设为全局 `WANJIE_ARK_MODEL`。计划图片导入通过 `getCoachlinkVisionLlm()` 读取 `WANJIE_ARK_VISION_MODEL`。当前 Key 的 `/models` 虽包含 `qwen3.6-flash`，但图片输入仍应选用名称中明确含 `vl` 的 `qwen3-vl-flash`；不要仅根据 `flash` 名称推断多模态能力。

PlanScript 同时承载计划结构、处方负荷和动作级全局 1RM：动作行使用 `@60kg`、`@8rm`、`@75%` 表示固定重量、RM、百分比；W1 前可使用 `1RM 负重引体 = 50kg`、`1RM 负重引体 += 2.5kg`、`1RM 负重引体 -= 2.5kg`。解析器会把 1RM 指令转换为现有的内部预览/确认/保存结构，所以模型侧不需要再生成 `oneRmAdjustments` 或 `loadAdjustments` JSON。绝对 1RM 按脚本数值精确设置；相对增减按 2.5kg 步长归一化。

## Adding New Config

When adding a new runtime setting:

1. Add the value to the selected source only: one local env file or Apollo.
2. Read it through `process.env.MY_KEY` in server-side code, matching existing project style.
3. Use `NEXT_PUBLIC_` only for values that are safe to expose to the browser.
4. Do not add a fallback that reads another local env file in Apollo mode.
5. Do not call `dotenv.config()` in Web runtime entry paths. Use `scripts/config/bootstrap-env.mjs`.

Utility or one-off scripts may still load env files explicitly, but that does not change the Web runtime contract.
