# DECISIONS

- `2026-03-27`: Added persistent state files so `coachlink` context survives session resets and compaction better.
- `2026-03-27`: Project ownership must come from `IDENTITY.md` plus state files, not stale transcript memory.
- `2026-03-27`: Durable requirements, blockers, and handoffs must be written to files instead of relying on chat history alone.
- `2026-03-27`: For current Next.js 16 Turbopack dev stability, avoid `next/font/google` runtime fetch path in root layout; use system stack (`font-sans`) until a local-font strategy is introduced.
