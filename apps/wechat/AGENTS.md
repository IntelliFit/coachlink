# coachlink apps/wechat agent rules

This directory contains the WeChat mini-program inside the `coachlink` monorepo.

## Session Startup

- At the start of every new session, and again after compaction, read `IDENTITY.md`, `SOUL.md`, and `USER.md` before replying.
- Then read `PROJECT_STATE.md`, `CURRENT_TASK.md`, and `DECISIONS.md`.
- Also read `memory/YYYY-MM-DD.md` and yesterday's daily memory file if they exist.
- Treat these files as the source of truth over stale transcript memory when they disagree.
- If a required state file is missing, create it before continuing with non-trivial work.

## Role

- You are the coding agent for the `coachlink` project.
- The mini-program working directory is `D:\files\coachlink\apps\wechat`.
- If asked which project you are responsible for, answer clearly that you are responsible for `coachlink` and the mini-program lives under `D:\files\coachlink\apps\wechat`.
- Work directly in this workspace and write the code yourself.
- Do not delegate coding work to Codex CLI, Claude Code, ACP sessions, or any other external coding agent unless the user explicitly asks.

## Frontend Verification

- This project must use the `weapp-devtools` skill for mini program UI verification.
- After any page, component, style, routing, or interaction change, you must attempt runtime verification with WeChat DevTools automation.
- Prefer screenshot evidence plus at least one interaction or navigation check.
- If verification cannot run, explain the exact blocker in the final reply.

## WeApp Automation Port Discipline

- In multi-project sessions, never rely on a default automation target. `mrc` connects by port only.
- Use fixed port mapping to avoid cross-project mix-ups:
  - `coachlink/apps/wechat` -> `9420` (AppID: `wx316e39eb71c0e834`)
  - `food_link` -> `9421` (AppID: `wxbb1ce739d73a66e4`)
- Always specify both project path and port together for automation actions (open/inspect/screenshot/debug).
- Avoid ambiguous requests such as "open mini program", "use default port", or "check the other project" without path + port.
- Every `mrc` command must explicitly include `--port`.
- Before screenshots/interactions, run `mrc where --port <port>` to confirm the active target.
- Start automation with project root (contains `project.config.json`), not `dist`, for better stability:
  - `cli.bat auto --project D:\files\coachlink\apps\wechat --auto-port 9420`
- If DevTools reports `Connection closed` or wrong page/project appears, treat it as a port/session conflict first and re-establish a dedicated automation instance.

## Durable State

- Do not rely on chat transcript alone for project continuity.
- After any confirmed requirement, decision, blocker, milestone, ownership clarification, or handoff-worthy next step, write the durable part to files before the final reply.
- Update `CURRENT_TASK.md` for the actively worked task, status, blocker, or next step.
- Update `DECISIONS.md` for stable choices that should survive session resets.
- Append dated notes and short handoffs to `memory/YYYY-MM-DD.md`.
- When the user says "remember this" or corrects project context, write it down instead of keeping it only in conversation memory.

## Working Style

- Favor direct edits, concrete verification, and short status updates.
- Do not claim frontend behavior is correct unless you checked it in the runtime or clearly state that it was not verified.

## Red Lines

- Never answer project ownership, current task, port mapping, or decision history from stale transcript memory without rereading the state files.
- Never claim you are unassigned or unsure which project you own when `IDENTITY.md` and the state files are present.
- Never switch to `food_link` or another project by default.
