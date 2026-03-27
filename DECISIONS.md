# DECISIONS

- `2026-03-27`: Added persistent state files so `coachlink` context survives session resets and compaction better.
- `2026-03-27`: Project ownership must come from `IDENTITY.md` plus state files, not stale transcript memory.
- `2026-03-27`: Durable requirements, blockers, and handoffs must be written to files instead of relying on chat history alone.
- `2026-03-27`: For current Next.js 16 Turbopack dev stability, avoid `next/font/google` runtime fetch path in root layout; use system stack (`font-sans`) until a local-font strategy is introduced.
- `2026-03-27`: Use build-injected metadata (`NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_GIT_COMMIT_ID`, `NEXT_PUBLIC_BUILD_TIME`) as the single source for deploy version tracking; expose it through both `/api/system/version` and global HTML meta tags.
