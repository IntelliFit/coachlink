# Design QA — 工具箱常用工具两列宫格

- source visual truth path: `apps/wechat/artifacts/ui-verification/toolbox-option-3-grid-final-full-local.png`
- implementation screenshot path: `apps/wechat/artifacts/ui-verification/toolbox-practical-grid-final-local.png`
- combined comparison: `apps/wechat/artifacts/ui-verification/toolbox-practical-grid-design-qa-comparison.png`
- viewport: WeChat DevTools simulator, 363 × 785 px capture
- source pixels: 371 × 802; normalized to 363 × 785 for comparison
- implementation pixels: 363 × 785; CSS simulator width approximately 363 px; capture density 1×
- state: `/toolbox/index`, light theme, page top

**Findings**

- No actionable P0/P1/P2 mismatch. The practical-tool section now reuses the same two-column cover-card structure, 16rpx grid gap, 24rpx corner radius, bottom title overlay, image crop, and section rhythm as the game grid.
- Typography: titles use the same weight, size, line height, white foreground, and shadow treatment as the game cards; section hierarchy and Chinese copy remain readable.
- Spacing and layout: six practical cards render as a balanced 2 × 3 grid; runtime selectors report 6 practical cards and 4 unchanged game cards.
- Colors and tokens: warm neutral page, white section spacing, dark cover scrim, and brand-orange kicker remain consistent with the existing toolbox design.
- Image quality: all six practical cards use real 640 × 480 WebP covers with `aspectFill`; the generated coming-soon image has an intentional covered training station and no fake CSS/emoji placeholder.
- Copy/content: the fifth active-tool count remains `常用工具 · 5`, total active tools remain 9, and the sixth visible title is exactly `亟待开放`.

**Interaction evidence**

- Clicking `亟待开放` kept the page at `/toolbox/index`; handler shows `敬请期待` and does not navigate.
- Clicking `功率视频分析` navigated to `/toolbox/power-analysis/index`, then returned successfully.
- WeChat DevTools error log: 0 entries.

**Comparison history**

- Pass 1: side-by-side comparison found no actionable P0/P1/P2 differences. No visual fix iteration was required.

**Implementation Checklist**

- [x] Five practical tools converted to two-column cover cards.
- [x] Sixth `亟待开放` card added with a real cover.
- [x] Mini-game images, order, routes, and grid preserved.
- [x] Placeholder and normal navigation interactions verified.
- [x] Local WeChat build and runtime error logs checked.

**Follow-up Polish**

- None required for this scoped change.

final result: passed