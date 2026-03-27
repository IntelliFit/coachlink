# CURRENT_TASK

- Task: Add deploy version traceability for frontend and backend (`appVersion + gitCommitId + buildTime`)
- Scope:
  - injected build metadata in `next.config.ts` with fallback auto-read (package version + `git rev-parse --short HEAD` + ISO build time)
  - added shared version helper `src/lib/version.ts`
  - added backend version APIs `GET /api/system/version` and public `GET /api/public/version`
  - exposed version in global `head` via layout metadata and explicit `<meta>` tags
- Status: completed
- Blocker: none
- Next step: optional UI entrance can call `/api/public/version` to show a visible version panel for guests
- Last updated: `2026-03-27`
