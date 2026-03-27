# CURRENT_TASK

- Task: Fix dev compile hang/error on `/dashboard/overview` caused by `next/font/google` in Next.js 16 Turbopack
- Scope:
  - removed `Inter` import/config from `src/app/layout.tsx`
  - switched `<body>` class to `font-sans` (system font stack path)
  - verified `/dashboard/overview -> /login` navigation in browser automation
- Status: completed
- Blocker: none for this fix; repository still has historical TypeScript errors unrelated to this change
- Next step: user can continue normal `npm run dev` flow; if custom branding font is required later, prefer `next/font/local` with checked-in font assets
- Last updated: `2026-03-27`
