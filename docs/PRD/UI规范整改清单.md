# CoachLink 小程序 UI 规范整改 PRD
> 生成时间：2026-04-18
> 规范：① 按钮禁止渐变色（纯色 `#CF6D4E`）；② 布局间距遵循 8 栅格理论
> 状态：已修复文件已从本表中移除，剩余为待整改项

---

## 一、按钮渐变色违规（剩余 46 处 / 27 个文件）

| # | 文件 | 选择器 | 行号 | 当前代码 | 修复建议 |
|---|------|--------|------|----------|----------|
| 1 | `auth/student-onboarding/index.scss` | `.footer-btn-primary` | 245 | `background: linear-gradient(90deg, #cf6d4e 0%, #fb923c 100%);` | `background: #cf6d4e;` |
| 2 | `coach/plan-lib/create/index.scss` | `.add-btn` | 90 | `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);` | `background: #3b82f6;` |
| 3 | `coach/plan-lib/create/index.scss` | `.save-btn` | 525 | `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);` | `background: #3b82f6;` |
| 4 | `coach/plan-lib/edit/index.scss` | `.add-btn` | 108 | `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);` | `background: #3b82f6;` |
| 5 | `coach/plan-lib/edit/index.scss` | `.save-btn` | 546 | `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);` | `background: #3b82f6;` |
| 6 | `coach/questionnaire/edit/index.scss` | `.publish-btn` | 103 | `background: linear-gradient(135deg, #10b981 0%, #059669 100%);` | `background: #10b981;` |
| 7 | `coach/questionnaire/edit/index.scss` | `.select-actions-btn` | 365 | `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);` | `background: #667eea;` |
| 8 | `coach/questionnaire/edit/index.scss` | `.add-question-btn` | 461 | `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);` | `background: #667eea;` |
| 9 | `coach/questionnaire/edit/index.scss` | `.save-btn` | 549 | `background: linear-gradient(135deg, #10b981 0%, #059669 100%);` | `background: #10b981;` |
| 10 | `coach/questionnaire/edit/index.scss` | `.confirm-btn` | 728 | `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);` | `background: #667eea;` |
| 11 | `coach/students/assign-plan/index.scss` | `.btn-primary` | 182 | `background: linear-gradient(135deg, #ff9f4a, #ff7b2c);` | `background: #ff9f4a;` |
| 12 | `coach/students/plan/index.scss` | `.add-action-btn` | 752 | `background: linear-gradient(135deg, #34c759 0%, #248a3d 100%);` | `background: #34c759;` |
| 13 | `coach/students/plan/index.scss` | `.create-plan-btn` | 1213 | `background: linear-gradient(135deg, #007aff 0%, #0056d2 100%);` | `background: #007aff;` |
| 14 | `coach/students/plan/index.scss` | `.contact-btn` | 1226 | `background: linear-gradient(135deg, #34c759 0%, #248a3d 100%);` | `background: #34c759;` |
| 15 | `coach/students/plan/index.scss` | `.save-btn` | 1484 | `background: linear-gradient(135deg, #007aff 0%, #0056d2 100%);` | `background: #007aff;` |
| 16 | `coach/videos/index.scss` | `.review-btn` | 81 | `background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);` | `background: #3b82f6;` |
| 17 | `coach/videos/index.scss` | `&.reviewed-btn` | 94 | `background: linear-gradient(135deg, #10b981 0%, #059669 100%);` | `background: #10b981;` |
| 18 | `components/ResetPasswordForm/index.scss` | `.submit-button` | 109 | `background: linear-gradient(135deg, #CF6D4E 0%, #FBB924 100%);` | `background: #CF6D4E;` |
| 19 | `components/ResetPasswordForm/index.scss` | `.nut-button--primary` | 152 | `background: linear-gradient(135deg, #CF6D4E 0%, #FBB924 100%) !important;` | `background: #CF6D4E;` |
| 20 | `content/public/training/index.scss` | `.share-btn` | 313 | `background: linear-gradient(135deg, #38bdf8, #0ea5e9);` | `background: #38bdf8;` |
| 21 | `discovery/coach-profile/index.scss` | `.generate-plan-btn` | 85 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 22 | `discovery/coach-profile/index.scss` | `.fixed-cta-btn` | 123 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 23 | `discovery/coach-profile/components/CoachIntro.scss` | `.btn-primary` | 213 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 24 | `discovery/market/index.scss` | `.result-cart-btn` | 94 | `background: linear-gradient(135deg, #F28631 0%, #FFAC6B 100%);` | `background: #F28631;` |
| 25 | `discovery/market/index.scss` | `.duration-btn-primary` | 346 | `background: linear-gradient(135deg, #F28631 0%, #FFAC6B 100%);` | `background: #F28631;` |
| 26 | `discovery/market/index.scss` | `.empty-btn` | 384 | `background: linear-gradient(135deg, #F28631 0%, #FFAC6B 100%);` | `background: #F28631;` |
| 27 | `me/cart/index.scss` | `.empty-btn` | 232 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 28 | `me/friends/index.scss` | `.add-btn` | 95 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 29 | `me/membership/subscribe/index.scss` | `.subscribe-btn` | 145 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 30 | `me/messages/chat/index.scss` | `.send-btn` | 92 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 31 | `me/my-coaches/components/CoachCard.scss` | `.btn-detail` | 232 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 32 | `me/payment/webview/index.scss` | `.fallback-btn-primary` | 57 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 33 | `me/plan-lib/create/index.scss` | `.add-week-btn` | 354 | `background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);` | `background: #f8fafc;` |
| 34 | `me/plan-lib/create/index.scss` | `.add-action-btn` | 521 | `background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);` | `background: #fffbeb;` |
| 35 | `me/plan-lib/create/index.scss` | `.primary-btn` | 585 | `background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);` | `background: #f59e0b;` |
| 36 | `me/plan-lib/edit/index.scss` | `.add-week-btn` | 354 | `background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);` | `background: #f8fafc;` |
| 37 | `me/plan-lib/edit/index.scss` | `.add-action-btn` | 521 | `background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);` | `background: #fffbeb;` |
| 38 | `me/plan-lib/edit/index.scss` | `.primary-btn` | 585 | `background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);` | `background: #f59e0b;` |
| 39 | `me/profile/detail/components/ProgressTimeline.scss` | `.add-pr-btn` | 57 | `background: linear-gradient(135deg, #FFF5EB 0%, #FFE8D1 100%);` | `background: #FFF5EB;` |
| 40 | `me/toolbox/scenario/index.scss` | `.current-step-btn` | 90 | `background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);` | `background: #f97316;` |
| 41 | `training/action-edit/index.scss` | `.btn-submit` | 87 | `background: linear-gradient(135deg, #cf6d4e 0%, #fb923c 100%);` | `background: #cf6d4e;` |
| 42 | `training/copy-from-coach/index.scss` | `.btn-copy` | 87 | `background: linear-gradient(135deg, #cf6d4e 0%, #fb923c 100%);` | `background: #cf6d4e;` |
| 43 | `training/copy-from-coach/index.scss` | `.retry-btn` | 126 | `background: linear-gradient(135deg, #cf6d4e 0%, #fb923c 100%);` | `background: #cf6d4e;` |
| 44 | `training/today-training/index.scss` | `.inline-action-btn` | 996 | `background: linear-gradient(135deg, #cf6d4e 0%, #e59b7d 100%);` | `background: #cf6d4e;` |
| 45 | `training/today-training/components/BrowseSection.scss` | `.detail-btn` | 242 | `background: linear-gradient(135deg, #CF6D4E 0%, #E59B7D 100%);` | `background: #CF6D4E;` |
| 46 | `training/training-execution/index.scss` | `.finish-btn` | 709 | `background: linear-gradient(90deg, #53c96b 0%, #75df88 100%);` | `background: #53c96b;` |

**小计：46 处按钮渐变色待修复**

---

## 二、8 栅格理论违规（剩余约 1100 处 / 55 个文件）

> 规则：`margin` / `padding` / `gap` / `width` / `height` / `border-radius` 必须为 8rpx 整数倍
> `9999rpx`（pill 形状）、`1rpx`（divider 线/divider border）除外

### 1. `app.scss`（3 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 61 | `padding-bottom` | `180rpx` | `176rpx` | `padding-bottom: 180rpx;` |
| 103 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 124 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 2. `auth/onboarding/index.scss`（2 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 52 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 53 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 3. `auth/register/index.scss`（11 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 72 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 76 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 12rpx 12rpx 28rpx;` |
| 76 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 12rpx 12rpx 28rpx;` |
| 76 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 12rpx 12rpx 28rpx;` |
| 76 | `padding` | `28rpx` | `32rpx` | `padding: 12rpx 12rpx 12rpx 28rpx;` |
| 107 | `padding` | `28rpx` | `32rpx` | `padding: 0 28rpx;` |
| 108 | `height` | `76rpx` | `80rpx` | `height: 76rpx;` |
| 139 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 157 | `height` | `108rpx` | `112rpx` | `height: 108rpx;` |
| 182 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 211 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |

### 4. `auth/wechat-auth/index.scss`（1 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 34 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 5. `coach/overview/index.scss`（18 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 10 | `padding` | `180rpx` | `176rpx` | `padding: 24rpx 24rpx 180rpx;` |
| 19 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 29 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 42 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 50 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 54 | `width` | `52rpx` | `48rpx` | `width: 52rpx;` |
| 55 | `height` | `52rpx` | `48rpx` | `height: 52rpx;` |
| 72 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 87 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 92 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 93 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 93 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 103 | `border-radius` | `14rpx` | `16rpx` | `border-radius: 14rpx;` |
| 136 | `margin-top` | `2rpx` | `0rpx` | `margin-top: 2rpx;` |
| 154 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 10rpx;` |
| 154 | `padding` | `10rpx` | `8rpx` | `padding: 4rpx 10rpx;` |
| 188 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 193 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |

### 6. `coach/plan-lib/index.scss`（20 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 10 | `padding` | `180rpx` | `176rpx` | `padding: 24rpx 24rpx 180rpx;` |
| 24 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 25 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 28 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 58 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 64 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 24rpx;` |
| 69 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 72 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 77 | `min-height` | `84rpx` | `80rpx` | `min-height: 84rpx;` |
| 78 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 81 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 91 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 98 | `margin-top` | `4rpx` | `0rpx` | `margin-top: -4rpx;` |
| 103 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 20rpx;` |
| 103 | `padding` | `20rpx` | `16rpx` | `padding: 14rpx 20rpx;` |
| 134 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 140 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 148 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 153 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 153 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |

### 7. `coach/students/assign-plan/index.scss`（44 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 6 | `padding-bottom` | `220rpx` | `224rpx` | `padding-bottom: 220rpx;` |
| 23 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 24 | `padding` | `26rpx` | `24rpx` | `padding: 26rpx;` |
| 25 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 33 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 33 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 34 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 52 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 61 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 62 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 75 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 83 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 83 | `padding` | `18rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 137 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 137 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 158 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 162 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 168 | `min-height` | `84rpx` | `80rpx` | `min-height: 84rpx;` |
| 169 | `padding` | `22rpx` | `24rpx` | `padding: 0 22rpx;` |
| 171 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 181 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 188 | `min-width` | `132rpx` | `128rpx` | `min-width: 132rpx;` |
| 189 | `min-height` | `84rpx` | `80rpx` | `min-height: 84rpx;` |
| 190 | `padding` | `26rpx` | `24rpx` | `padding: 0 26rpx;` |
| 198 | `gap` | `18rpx` | `16rpx` | `gap: 18rpx;` |
| 220 | `margin-top` | `22rpx` | `24rpx` | `margin-top: 22rpx;` |
| 227 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 229 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 251 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 252 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 256 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx;` |
| 286 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 294 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 298 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 303 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx;` |
| 327 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 328 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx;` |
| 343 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 349 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 357 | `padding` | `20rpx` | `16rpx` | `padding: 16rpx 20rpx;` |
| 385 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx calc(env(safe-area-inset-bottom) + 20rp` |
| 385 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx calc(env(safe-area-inset-bottom) + 20rp` |
| 407 | `min-height` | `92rpx` | `96rpx` | `min-height: 92rpx;` |
| 408 | `padding` | `28rpx` | `32rpx` | `padding: 0 28rpx;` |

### 8. `coach/students/detail/index.scss`（26 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 20 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 35 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 45 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 46 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 56 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 57 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 69 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 69 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 70 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 85 | `height` | `1rpx` | `0rpx` | `height: 1rpx;` |
| 87 | `margin` | `20rpx` | `16rpx` | `margin: 20rpx 0;` |
| 141 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 147 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 194 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 194 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 219 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 238 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 283 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 298 | `padding` | `2rpx` | `0rpx` | `padding: 2rpx 8rpx;` |
| 299 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |
| 341 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 347 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0;` |
| 375 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 394 | `height` | `28rpx` | `32rpx` | `height: 28rpx;` |
| 398 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |
| 408 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |

### 9. `coach/students/plan/index.scss`（110 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 33 | `width` | `100rpx` | `96rpx` | `width: 100rpx;` |
| 34 | `height` | `100rpx` | `96rpx` | `height: 100rpx;` |
| 77 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 107 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 130 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 138 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 139 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 155 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 183 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 184 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 213 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 228 | `height` | `12rpx` | `16rpx` | `height: 12rpx;` |
| 230 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 232 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 238 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 254 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 255 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 308 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 308 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 309 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 340 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 342 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 352 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 370 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 391 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 392 | `padding-top` | `12rpx` | `16rpx` | `padding-top: 12rpx;` |
| 409 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 411 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 415 | `padding` | `18rpx` | `16rpx` | `padding: 8rpx 18rpx;` |
| 416 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 465 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 473 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 474 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 485 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 487 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 559 | `border-radius` | `10rpx` | `8rpx` | `border-radius: 10rpx;` |
| 560 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 575 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 580 | `padding` | `18rpx` | `16rpx` | `padding: 8rpx 18rpx;` |
| 581 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 601 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 606 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 608 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 632 | `height` | `100rpx` | `96rpx` | `height: 100rpx;` |
| 634 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 662 | `width` | `12rpx` | `16rpx` | `width: 12rpx;` |
| 663 | `height` | `12rpx` | `16rpx` | `height: 12rpx;` |
| 677 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 705 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 721 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 729 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 730 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 751 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 763 | `border-radius` | `22rpx` | `24rpx` | `border-radius: 22rpx;` |
| 764 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 789 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 797 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 803 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 849 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 865 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 865 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 935 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 16rpx;` |
| 936 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 958 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 980 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 989 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 1004 | `height` | `68rpx` | `64rpx` | `height: 68rpx;` |
| 1016 | `min-height` | `68rpx` | `64rpx` | `min-height: 68rpx;` |
| 1019 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 16rpx;` |
| 1034 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 1036 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 1044 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 1061 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 1066 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 1092 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 1117 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 1118 | `padding-top` | `14rpx` | `16rpx` | `padding-top: 14rpx;` |
| 1126 | `border-radius` | `14rpx` | `16rpx` | `border-radius: 14rpx;` |
| 1127 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx;` |
| 1132 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 1144 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 1151 | `padding` | `10rpx` | `8rpx` | `padding: 16rpx 10rpx 8rpx;` |
| 1173 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 1190 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx 32rpx;` |
| 1200 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 1212 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 48rpx;` |
| 1314 | `border-radius` | `10rpx` | `8rpx` | `border-radius: 10rpx;` |
| 1315 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 1324 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx 24rpx;` |
| 1343 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 12rpx 24rpx;` |
| 1343 | `padding` | `12rpx` | `16rpx` | `padding: 18rpx 12rpx 24rpx;` |
| 1367 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 1413 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 1414 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 1426 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 1443 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 10rpx;` |
| 1443 | `padding` | `10rpx` | `8rpx` | `padding: 4rpx 10rpx;` |
| 1485 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 1513 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 1514 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 1516 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 1546 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 1547 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 1555 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 1571 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 1579 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 18rpx;` |
| 1579 | `padding` | `18rpx` | `16rpx` | `padding: 14rpx 18rpx;` |
| 1580 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 1606 | `border-radius` | `14rpx` | `16rpx` | `border-radius: 14rpx;` |
| 1608 | `padding` | `18rpx` | `16rpx` | `padding: 0 18rpx;` |

### 10. `components/ActionSelectModal/index.scss`（5 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 22 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 39 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx 0;` |
| 67 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 67 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 69 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |

### 11. `components/PlanCompactWeekCalendar/index.scss`（14 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 2 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 17 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 27 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 33 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 62 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 62 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 63 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 80 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 86 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 92 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 97 | `gap` | `6rpx` | `8rpx` | `gap: 6rpx;` |
| 129 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 133 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 136 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |

### 12. `components/PlanEditorWorkbench/index.scss`（73 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 11 | `padding` | `260rpx` | `256rpx` | `padding: 24rpx 24rpx 260rpx;` |
| 20 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 25 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 26 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 45 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 53 | `margin-bottom` | `18rpx` | `16rpx` | `margin-bottom: 18rpx;` |
| 56 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 77 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 84 | `margin-bottom` | `18rpx` | `16rpx` | `margin-bottom: 18rpx;` |
| 91 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 95 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 101 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 112 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 118 | `min-height` | `78rpx` | `80rpx` | `min-height: 78rpx;` |
| 119 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 125 | `min-height` | `70rpx` | `72rpx` | `min-height: 70rpx;` |
| 133 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 133 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 138 | `min-height` | `84rpx` | `80rpx` | `min-height: 84rpx;` |
| 139 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 18rpx;` |
| 139 | `padding` | `18rpx` | `16rpx` | `padding: 14rpx 18rpx;` |
| 147 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 151 | `min-height` | `68rpx` | `64rpx` | `min-height: 68rpx;` |
| 152 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 168 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 174 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 179 | `min-height` | `68rpx` | `64rpx` | `min-height: 68rpx;` |
| 180 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 199 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 218 | `margin-left` | `12rpx` | `16rpx` | `margin-left: 12rpx;` |
| 227 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 234 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 234 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 235 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 251 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 261 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 268 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 269 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 301 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 310 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 316 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 337 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 342 | `gap` | `6rpx` | `8rpx` | `gap: 6rpx;` |
| 355 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 16rpx;` |
| 374 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 400 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 407 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 420 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 452 | `gap` | `6rpx` | `8rpx` | `gap: 6rpx;` |
| 474 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 487 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 510 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 511 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 512 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 560 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 566 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 570 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 16rpx;` |
| 571 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 591 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 598 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 599 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 606 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 617 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx calc(env(safe-area-inset-bottom) + 20rp` |
| 617 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx calc(env(safe-area-inset-bottom) + 20rp` |
| 625 | `bottom` | `100rpx` | `96rpx` | `bottom: 100rpx;` |
| 632 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 661 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 674 | `margin-bottom` | `18rpx` | `16rpx` | `margin-bottom: 18rpx;` |
| 690 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 692 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 702 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0;` |
| 714 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 726 | `height` | `20rpx` | `16rpx` | `height: 20rpx;` |

### 13. `components/PlanReferenceOneRMPanel/index.scss`（18 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 2 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 25 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 41 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 46 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 46 | `padding` | `18rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 47 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 71 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 80 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 81 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 92 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 104 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 10rpx;` |
| 104 | `padding` | `10rpx` | `8rpx` | `padding: 4rpx 10rpx;` |
| 105 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 115 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 118 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 144 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 145 | `min-height` | `78rpx` | `80rpx` | `min-height: 78rpx;` |
| 146 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |

### 14. `content/public/training/index.scss`（21 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 32 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 62 | `width` | `140rpx` | `144rpx` | `width: 140rpx;` |
| 63 | `height` | `140rpx` | `144rpx` | `height: 140rpx;` |
| 64 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 66 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx;` |
| 74 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 108 | `margin-left` | `6rpx` | `8rpx` | `margin-left: 6rpx;` |
| 121 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 148 | `margin-left` | `4rpx` | `0rpx` | `margin-left: 4rpx;` |
| 167 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 8rpx;` |
| 176 | `padding` | `12rpx` | `16rpx` | `padding: 16rpx 12rpx;` |
| 215 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 219 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx 16rpx;` |
| 220 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 243 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 24rpx;` |
| 254 | `width` | `180rpx` | `176rpx` | `width: 180rpx;` |
| 255 | `height` | `180rpx` | `176rpx` | `height: 180rpx;` |
| 257 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 288 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 0;` |
| 289 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 314 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |

### 15. `discovery/coach-profile/index.scss`（4 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 88 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 89 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 100 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 101 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |

### 16. `discovery/generate-plan/assessment.scss`（9 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 9 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx;` |
| 51 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 63 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 69 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 81 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 99 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 109 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 111 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 143 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |

### 17. `discovery/generate-plan/index.scss`（5 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 21 | `padding` | `60rpx` | `64rpx` | `.loading-wrap { padding: 60rpx; text-align: center; color: #` |
| 21 | `padding` | `28rpx` | `32rpx` | `.loading-wrap { padding: 60rpx; text-align: center; color: #` |
| 47 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 71 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 116 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |

### 18. `discovery/generate-plan/waiting/index.scss`（9 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 13 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx 40rpx;` |
| 49 | `width` | `60rpx` | `64rpx` | `width: 60rpx;` |
| 50 | `height` | `60rpx` | `64rpx` | `height: 60rpx;` |
| 80 | `height` | `12rpx` | `16rpx` | `height: 12rpx;` |
| 82 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 84 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 89 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 103 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 107 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 19. `discovery/market/index.scss`（37 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 4 | `padding-bottom` | `180rpx` | `176rpx` | `padding-bottom: 180rpx;` |
| 24 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 50 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 58 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 24rpx;` |
| 75 | `margin` | `20rpx` | `16rpx` | `margin: 20rpx 24rpx 0;` |
| 76 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 77 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 92 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 102 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 105 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 110 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 132 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 163 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 164 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 177 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 10rpx;` |
| 177 | `padding` | `10rpx` | `8rpx` | `padding: 4rpx 10rpx;` |
| 197 | `padding` | `14rpx` | `16rpx` | `padding: 8rpx 14rpx;` |
| 198 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 222 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 243 | `margin-top` | `6rpx` | `8rpx` | `margin-top: 6rpx;` |
| 264 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 278 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 282 | `padding` | `14rpx` | `16rpx` | `padding: 8rpx 14rpx;` |
| 295 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 299 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 299 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 311 | `gap` | `4rpx` | `0rpx` | `gap: 4rpx;` |
| 330 | `margin-top` | `2rpx` | `0rpx` | `margin-top: 2rpx;` |
| 335 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 339 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 22rpx;` |
| 339 | `padding` | `22rpx` | `24rpx` | `padding: 14rpx 22rpx;` |
| 361 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 380 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 28rpx;` |
| 380 | `padding` | `28rpx` | `32rpx` | `padding: 18rpx 28rpx;` |
| 396 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 401 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 423 | `height` | `20rpx` | `16rpx` | `height: 20rpx;` |

### 20. `discovery/share/index.scss`（1 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 112 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 0;` |

### 21. `me/about/index.scss`（2 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 37 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 58 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 22. `me/action-lib/index.scss`（65 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 7 | `padding-bottom` | `140rpx` | `144rpx` | `padding-bottom: 140rpx;` |
| 31 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 48 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 65 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 93 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 99 | `padding` | `28rpx` | `32rpx` | `padding: 0 28rpx;` |
| 100 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 115 | `right` | `132rpx` | `128rpx` | `right: 132rpx;` |
| 129 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 130 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 141 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 158 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 165 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 16rpx;` |
| 189 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 190 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 22rpx;` |
| 190 | `padding` | `22rpx` | `24rpx` | `padding: 20rpx 22rpx;` |
| 191 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 199 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 205 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 209 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 209 | `padding` | `18rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 210 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 234 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 235 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx 24rpx;` |
| 236 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 274 | `margin-right` | `20rpx` | `16rpx` | `margin-right: 20rpx;` |
| 308 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 308 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 321 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 331 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 335 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 335 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 336 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 351 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 396 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 402 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 410 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 431 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx 10rpx;` |
| 431 | `padding` | `10rpx` | `8rpx` | `padding: 6rpx 10rpx;` |
| 432 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 451 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 457 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 458 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 465 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 466 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx 12rpx;` |
| 466 | `padding` | `12rpx` | `16rpx` | `padding: 6rpx 12rpx;` |
| 482 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 484 | `padding-top` | `18rpx` | `16rpx` | `padding-top: 18rpx;` |
| 490 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 538 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 558 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |
| 569 | `min-height` | `220rpx` | `224rpx` | `min-height: 220rpx;` |
| 624 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 626 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 644 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 649 | `min-height` | `180rpx` | `176rpx` | `min-height: 180rpx;` |
| 650 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 652 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 660 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 664 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 664 | `padding` | `18rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 665 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 687 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 691 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0;` |
| 692 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 23. `me/action-lib/edit/index.scss`（9 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 7 | `padding-bottom` | `140rpx` | `144rpx` | `padding-bottom: 140rpx;` |
| 50 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 63 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 72 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 83 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 93 | `padding` | `20rpx` | `16rpx` | `padding: 16rpx 20rpx;` |
| 114 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 141 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 147 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 24. `me/contact/index.scss`（3 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 6 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 25 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 32 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 25. `me/feedback/index.scss`（4 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 79 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 92 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 94 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 108 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 26. `me/membership/index.scss`（3 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 7 | `padding-bottom` | `140rpx` | `144rpx` | `padding-bottom: 140rpx;` |
| 31 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 32rpx;` |
| 83 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |

### 27. `me/payment-waiting/index.scss`（3 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 25 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 137 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 138 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 32rpx;` |

### 28. `me/plan-lib/index.scss`（22 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 7 | `padding-bottom` | `140rpx` | `144rpx` | `padding-bottom: 140rpx;` |
| 31 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 42 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 79 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 90 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 40rpx;` |
| 91 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 111 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 141 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 163 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 164 | `margin-left` | `20rpx` | `16rpx` | `margin-left: 20rpx;` |
| 167 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 170 | `min-width` | `100rpx` | `96rpx` | `min-width: 100rpx;` |
| 216 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 223 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |
| 303 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 305 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 312 | `margin-right` | `20rpx` | `16rpx` | `margin-right: 20rpx;` |
| 318 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 321 | `width` | `140rpx` | `144rpx` | `width: 140rpx;` |
| 342 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 348 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0;` |
| 349 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 29. `me/plan-lib/create/index.scss`（51 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 37 | `width` | `150rpx` | `152rpx` | `width: 150rpx;` |
| 38 | `height` | `150rpx` | `152rpx` | `height: 150rpx;` |
| 55 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 65 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 83 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 87 | `width` | `6rpx` | `8rpx` | `width: 6rpx;` |
| 90 | `border-radius` | `3rpx` | `0rpx` | `border-radius: 3rpx;` |
| 108 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 112 | `width` | `6rpx` | `8rpx` | `width: 6rpx;` |
| 115 | `border-radius` | `3rpx` | `0rpx` | `border-radius: 3rpx;` |
| 122 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 131 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 137 | `margin-left` | `4rpx` | `0rpx` | `margin-left: 4rpx;` |
| 146 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 161 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 163 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 187 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 188 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 204 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 214 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 216 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 217 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 233 | `width` | `140rpx` | `144rpx` | `width: 140rpx;` |
| 256 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 284 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 328 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 353 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 378 | `padding-bottom` | `20rpx` | `16rpx` | `padding-bottom: 20rpx;` |
| 393 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 395 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx;` |
| 396 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 399 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 28rpx;` |
| 399 | `padding` | `28rpx` | `32rpx` | `padding: 12rpx 28rpx;` |
| 426 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx 0;` |
| 452 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 462 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 469 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |
| 476 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 491 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 505 | `padding` | `12rpx` | `16rpx` | `padding: 0 12rpx;` |
| 520 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 524 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 550 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 564 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 565 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 0 20rpx;` |
| 565 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 0 20rpx;` |
| 569 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 0;` |
| 624 | `padding` | `100rpx` | `96rpx` | `padding: 100rpx 0;` |
| 629 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 633 | `width` | `60rpx` | `64rpx` | `width: 60rpx;` |
| 634 | `height` | `60rpx` | `64rpx` | `height: 60rpx;` |

### 30. `me/plan-lib/edit/index.scss`（51 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 37 | `width` | `150rpx` | `152rpx` | `width: 150rpx;` |
| 38 | `height` | `150rpx` | `152rpx` | `height: 150rpx;` |
| 55 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 65 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 83 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 87 | `width` | `6rpx` | `8rpx` | `width: 6rpx;` |
| 90 | `border-radius` | `3rpx` | `0rpx` | `border-radius: 3rpx;` |
| 108 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 112 | `width` | `6rpx` | `8rpx` | `width: 6rpx;` |
| 115 | `border-radius` | `3rpx` | `0rpx` | `border-radius: 3rpx;` |
| 122 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 131 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 137 | `margin-left` | `4rpx` | `0rpx` | `margin-left: 4rpx;` |
| 146 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 161 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 163 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 187 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 188 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 204 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 214 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 216 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 217 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 233 | `width` | `140rpx` | `144rpx` | `width: 140rpx;` |
| 256 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 284 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 328 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 353 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 378 | `padding-bottom` | `20rpx` | `16rpx` | `padding-bottom: 20rpx;` |
| 393 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 395 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx;` |
| 396 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 399 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 28rpx;` |
| 399 | `padding` | `28rpx` | `32rpx` | `padding: 12rpx 28rpx;` |
| 426 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx 0;` |
| 452 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 462 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 469 | `border-radius` | `4rpx` | `0rpx` | `border-radius: 4rpx;` |
| 476 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 491 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 505 | `padding` | `12rpx` | `16rpx` | `padding: 0 12rpx;` |
| 520 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 524 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 550 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 564 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 565 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 0 20rpx;` |
| 565 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 0 20rpx;` |
| 569 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 0;` |
| 624 | `padding` | `100rpx` | `96rpx` | `padding: 100rpx 0;` |
| 629 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 633 | `width` | `60rpx` | `64rpx` | `width: 60rpx;` |
| 634 | `height` | `60rpx` | `64rpx` | `height: 60rpx;` |

### 31. `me/platform-agreement/index.scss`（1 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 54 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |

### 32. `me/profile/index.scss`（28 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 4 | `padding-bottom` | `180rpx` | `176rpx` | `padding-bottom: 180rpx;` |
| 24 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 41 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx;` |
| 95 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 95 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 110 | `width` | `28rpx` | `32rpx` | `width: 28rpx;` |
| 111 | `height` | `28rpx` | `32rpx` | `height: 28rpx;` |
| 138 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 139 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 147 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 149 | `padding` | `28rpx` | `32rpx` | `padding: 24rpx 28rpx;` |
| 176 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 177 | `min-height` | `250rpx` | `248rpx` | `min-height: 250rpx;` |
| 180 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 188 | `height` | `150rpx` | `152rpx` | `height: 150rpx;` |
| 190 | `padding-top` | `10rpx` | `8rpx` | `padding-top: 10rpx;` |
| 199 | `padding` | `10rpx` | `8rpx` | `padding: 0 10rpx;` |
| 200 | `height` | `150rpx` | `152rpx` | `height: 150rpx;` |
| 201 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 206 | `width` | `84rpx` | `80rpx` | `width: 84rpx;` |
| 207 | `height` | `84rpx` | `80rpx` | `height: 84rpx;` |
| 208 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 216 | `width` | `52rpx` | `48rpx` | `width: 52rpx;` |
| 217 | `height` | `52rpx` | `48rpx` | `height: 52rpx;` |
| 221 | `margin-top` | `10rpx` | `8rpx` | `margin-top: 10rpx;` |
| 231 | `right` | `10rpx` | `8rpx` | `right: 10rpx;` |
| 234 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 10rpx;` |
| 234 | `padding` | `10rpx` | `8rpx` | `padding: 4rpx 10rpx;` |

### 33. `me/profile/e1rm-chart/index.scss`（4 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 28 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0;` |
| 28 | `padding` | `1rpx` | `0rpx` | `padding: 20rpx 0; border-bottom: 1rpx solid #f0f0f0;` |
| 35 | `padding` | `12rpx` | `16rpx` | `.video-btn { padding: 12rpx 24rpx; background: #f0f7ff; bord` |
| 35 | `padding` | `26rpx` | `24rpx` | `.video-btn { padding: 12rpx 24rpx; background: #f0f7ff; bord` |

### 34. `me/protection-of-consumer/index.scss`（1 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 54 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |

### 35. `me/terms/index.scss`（1 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 54 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |

### 36. `me/training-history/index.scss`（13 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 16 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 31 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 34 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 81 | `padding` | `12rpx` | `16rpx` | `padding: 0 12rpx;` |
| 104 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 125 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 197 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 224 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 228 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 228 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 261 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 267 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 268 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |

### 37. `me/user/index.scss`（3 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 55 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 121 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 142 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0;` |

### 38. `pages/index/index.scss`（18 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 57 | `padding` | `36rpx` | `32rpx` | `padding: 16rpx 36rpx;` |
| 87 | `border-radius` | `36rpx` | `32rpx` | `border-radius: 36rpx;` |
| 97 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 103 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 119 | `width` | `100rpx` | `96rpx` | `width: 100rpx;` |
| 120 | `height` | `100rpx` | `96rpx` | `height: 100rpx;` |
| 174 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 175 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 0;` |
| 218 | `border-radius` | `36rpx` | `32rpx` | `border-radius: 36rpx;` |
| 219 | `padding` | `36rpx` | `32rpx` | `padding: 36rpx 32rpx;` |
| 235 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 245 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 36rpx;` |
| 245 | `padding` | `36rpx` | `32rpx` | `padding: 18rpx 36rpx;` |
| 281 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 289 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 290 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 32rpx;` |
| 300 | `width` | `84rpx` | `80rpx` | `width: 84rpx;` |
| 301 | `height` | `84rpx` | `80rpx` | `height: 84rpx;` |

### 39. `streetlifting/index.scss`（4 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 17 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 40 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 43 | `width` | `10rpx` | `8rpx` | `width: calc(50% - 10rpx);` |
| 46 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |

### 40. `streetlifting/index/calculator/index.scss`（7 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 24 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 35 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 41 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 114 | `padding` | `20rpx` | `16rpx` | `padding: 8rpx 20rpx;` |
| 117 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 170 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 175 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 41. `streetlifting/index/data/index.scss`（23 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 10 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 34 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 36 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 46 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 49 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 49 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 52 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 64 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 72 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx;` |
| 90 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 94 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 95 | `height` | `52rpx` | `48rpx` | `height: 52rpx;` |
| 98 | `border-radius` | `10rpx` | `8rpx` | `border-radius: 10rpx;` |
| 107 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 110 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 14rpx;` |
| 110 | `padding` | `14rpx` | `16rpx` | `padding: 4rpx 14rpx;` |
| 114 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 120 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 124 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx;` |
| 126 | `border-radius` | `10rpx` | `8rpx` | `border-radius: 10rpx;` |
| 136 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 172 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 181 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 42. `streetlifting/index/locations/index.scss`（68 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 14 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 25 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 32 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 33 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 36 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 36 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 37 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 47 | `min-width` | `180rpx` | `176rpx` | `min-width: 180rpx;` |
| 51 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 62 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 67 | `min-width` | `180rpx` | `176rpx` | `min-width: 180rpx;` |
| 71 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 85 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 90 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 91 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 98 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 109 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 113 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 0 10rpx;` |
| 113 | `padding` | `10rpx` | `8rpx` | `padding: 18rpx 0 10rpx;` |
| 119 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 120 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 121 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 144 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 145 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 167 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 178 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 186 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 192 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 220 | `height` | `12rpx` | `16rpx` | `height: 12rpx;` |
| 221 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 235 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 239 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 10rpx;` |
| 239 | `padding` | `10rpx` | `8rpx` | `padding: 14rpx 10rpx;` |
| 251 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 261 | `margin-top` | `4rpx` | `0rpx` | `margin-top: 4rpx;` |
| 262 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 274 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 275 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 283 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 289 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 309 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 320 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 320 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 321 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 333 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx;` |
| 342 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 350 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 366 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 375 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 388 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 423 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 435 | `min-width` | `92rpx` | `96rpx` | `min-width: 92rpx;` |
| 454 | `padding` | `18rpx` | `16rpx` | `padding: 16rpx 18rpx;` |
| 472 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 476 | `width` | `180rpx` | `176rpx` | `width: 180rpx;` |
| 482 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 509 | `padding` | `60rpx` | `64rpx` | `padding: 60rpx;` |
| 547 | `padding` | `14rpx` | `16rpx` | `padding: 8rpx 14rpx;` |
| 548 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 567 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 614 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 620 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 631 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 637 | `min-width` | `180rpx` | `176rpx` | `min-width: 180rpx;` |
| 643 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 662 | `width` | `140rpx` | `144rpx` | `width: 140rpx; height: 140rpx;` |
| 662 | `width` | `140rpx` | `144rpx` | `width: 140rpx; height: 140rpx;` |
| 664 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |

### 43. `streetlifting/index/locations-map/index.scss`（25 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 11 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 20 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 39 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 40 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 68 | `min-width` | `132rpx` | `128rpx` | `min-width: 132rpx;` |
| 69 | `padding` | `18rpx` | `16rpx` | `padding: 16rpx 18rpx;` |
| 70 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 81 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 107 | `left` | `20rpx` | `16rpx` | `left: 20rpx;` |
| 108 | `right` | `20rpx` | `16rpx` | `right: 20rpx;` |
| 109 | `top` | `20rpx` | `16rpx` | `top: 20rpx;` |
| 114 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 18rpx;` |
| 114 | `padding` | `18rpx` | `16rpx` | `padding: 14rpx 18rpx;` |
| 115 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 125 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 137 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 146 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 148 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 156 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 182 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 183 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 188 | `height` | `68rpx` | `64rpx` | `height: 68rpx;` |
| 207 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 207 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 208 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |

### 44. `streetlifting/index/methodology/index.scss`（2 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 2 | `margin-top` | `12rpx` | `16rpx` | `.link-btn { margin-top: 32rpx; padding: 24rpx; background: #` |
| 2 | `margin-top` | `30rpx` | `32rpx` | `.link-btn { margin-top: 32rpx; padding: 24rpx; background: #` |

### 45. `streetlifting/index/stories/index.scss`（2 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 2 | `margin-top` | `12rpx` | `16rpx` | `.link-btn { margin-top: 32rpx; padding: 24rpx; background: #` |
| 2 | `margin-top` | `30rpx` | `32rpx` | `.link-btn { margin-top: 32rpx; padding: 24rpx; background: #` |

### 46. `streetlifting/index/submit/index.scss`（2 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 2 | `margin-top` | `12rpx` | `16rpx` | `.link-btn { margin-top: 32rpx; padding: 24rpx; background: #` |
| 2 | `margin-top` | `30rpx` | `32rpx` | `.link-btn { margin-top: 32rpx; padding: 24rpx; background: #` |

### 47. `streetlifting/index/submit/success/index.scss`（2 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 14 | `padding` | `12rpx` | `16rpx` | `.btn { padding: 24rpx 48rpx; background: #1890ff; color: #ff` |
| 14 | `padding` | `30rpx` | `32rpx` | `.btn { padding: 24rpx 48rpx; background: #1890ff; color: #ff` |

### 48. `training/action-detail/index.scss`（15 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 9 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 10 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 19 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 27 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 29 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 33 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 41 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 54 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 61 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 62 | `padding` | `14rpx` | `16rpx` | `padding: 8rpx 14rpx;` |
| 74 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 76 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 77 | `padding` | `20rpx` | `16rpx` | `padding: 16rpx 20rpx;` |
| 87 | `margin-top` | `22rpx` | `24rpx` | `margin-top: 22rpx;` |
| 88 | `padding-top` | `20rpx` | `16rpx` | `padding-top: 20rpx;` |

### 49. `training/action-edit/index.scss`（7 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 12 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 27 | `margin-left` | `4rpx` | `0rpx` | `margin-left: 4rpx;` |
| 33 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 24rpx;` |
| 38 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 54 | `padding` | `28rpx` | `32rpx` | `padding: 16rpx 28rpx;` |
| 56 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 82 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |

### 50. `training/copy-from-coach/index.scss`（14 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 24 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 26 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 34 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 50 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 51 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 56 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx 16rpx;` |
| 83 | `padding` | `28rpx` | `32rpx` | `padding: 16rpx 28rpx;` |
| 88 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 122 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 48rpx;` |
| 127 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 132 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 134 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 138 | `height` | `28rpx` | `32rpx` | `height: 28rpx;` |
| 146 | `height` | `36rpx` | `32rpx` | `height: 36rpx;` |

### 51. `training/impromptu-training/index.scss`（11 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 11 | `padding` | `20rpx` | `16rpx` | `padding: 24rpx 24rpx 20rpx;` |
| 33 | `margin` | `20rpx` | `16rpx` | `margin: 20rpx 24rpx;` |
| 50 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 24rpx;` |
| 53 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 72 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 79 | `border-radius` | `12rpx` | `16rpx` | `border-radius: 12rpx;` |
| 108 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 0;` |
| 147 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 147 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 200 | `padding` | `30rpx` | `32rpx` | `padding: 30rpx;` |
| 204 | `padding` | `1rpx` | `0rpx` | `.picker-item { padding: 24rpx; border-bottom: 1rpx solid #f0` |

### 52. `training/today-training/index.scss`（109 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 8 | `padding-bottom` | `180rpx` | `176rpx` | `padding-bottom: 180rpx;` |
| 24 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 47 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 55 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 87 | `height` | `12rpx` | `16rpx` | `height: 12rpx;` |
| 91 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 117 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 177 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 178 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx;` |
| 181 | `gap` | `4rpx` | `0rpx` | `gap: 4rpx;` |
| 208 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 227 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 244 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 246 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 260 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 260 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 261 | `margin-right` | `12rpx` | `16rpx` | `margin-right: 12rpx;` |
| 280 | `padding` | `2rpx` | `0rpx` | `padding: 2rpx 10rpx;` |
| 280 | `padding` | `10rpx` | `8rpx` | `padding: 2rpx 10rpx;` |
| 291 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 292 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 292 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 293 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 299 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 305 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 316 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 316 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 353 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 369 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 376 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 388 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 414 | `padding` | `6rpx` | `8rpx` | `padding: 6rpx;` |
| 415 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 424 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 24rpx;` |
| 447 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 449 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 474 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 489 | `bottom` | `4rpx` | `0rpx` | `bottom: -4rpx;` |
| 490 | `right` | `4rpx` | `0rpx` | `right: -4rpx;` |
| 507 | `margin-bottom` | `6rpx` | `8rpx` | `margin-bottom: 6rpx;` |
| 510 | `padding` | `4rpx` | `0rpx` | `padding: 4rpx 12rpx;` |
| 510 | `padding` | `12rpx` | `16rpx` | `padding: 4rpx 12rpx;` |
| 517 | `border-radius` | `6rpx` | `8rpx` | `border-radius: 6rpx;` |
| 530 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 547 | `min-height` | `52rpx` | `48rpx` | `min-height: 52rpx;` |
| 548 | `padding` | `18rpx` | `16rpx` | `padding: 0 18rpx;` |
| 549 | `border-radius` | `14rpx` | `16rpx` | `border-radius: 14rpx;` |
| 580 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 591 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 612 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 612 | `padding` | `18rpx` | `16rpx` | `padding: 12rpx 18rpx;` |
| 646 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 658 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 661 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 661 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 670 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 670 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 680 | `gap` | `6rpx` | `8rpx` | `gap: 6rpx;` |
| 681 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 14rpx;` |
| 681 | `padding` | `14rpx` | `16rpx` | `padding: 10rpx 14rpx;` |
| 707 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 713 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 714 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 714 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 718 | `gap` | `4rpx` | `0rpx` | `gap: 4rpx;` |
| 761 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 762 | `padding` | `28rpx` | `32rpx` | `padding: 40rpx 28rpx;` |
| 765 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 776 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 782 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 790 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 790 | `padding` | `20rpx` | `16rpx` | `padding: 12rpx 20rpx;` |
| 802 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 803 | `padding` | `28rpx` | `32rpx` | `padding: 48rpx 28rpx;` |
| 810 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 845 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 852 | `margin-bottom` | `28rpx` | `32rpx` | `margin-bottom: 28rpx;` |
| 861 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 867 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 868 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx 32rpx;` |
| 910 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 911 | `padding` | `20rpx` | `16rpx` | `padding: 20rpx 22rpx;` |
| 911 | `padding` | `22rpx` | `24rpx` | `padding: 20rpx 22rpx;` |
| 912 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 923 | `margin-bottom` | `4rpx` | `0rpx` | `margin-bottom: 4rpx;` |
| 939 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 940 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 940 | `padding` | `20rpx` | `16rpx` | `padding: 18rpx 20rpx;` |
| 941 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 985 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 993 | `min-height` | `52rpx` | `48rpx` | `min-height: 52rpx;` |
| 994 | `padding` | `20rpx` | `16rpx` | `padding: 0 20rpx;` |
| 1011 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx;` |
| 1012 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 1020 | `margin-bottom` | `10rpx` | `8rpx` | `margin-bottom: 10rpx;` |
| 1040 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 1060 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx 28rpx 0 0;` |
| 1060 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx 28rpx 0 0;` |
| 1061 | `padding` | `22rpx` | `24rpx` | `padding: 24rpx 22rpx 28rpx;` |
| 1061 | `padding` | `28rpx` | `32rpx` | `padding: 24rpx 22rpx 28rpx;` |
| 1077 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 1078 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 1083 | `min-width` | `7rpx` | `8rpx` | `min-width: calc(50% - 7rpx);` |
| 1084 | `margin-bottom` | `14rpx` | `16rpx` | `margin-bottom: 14rpx;` |
| 1101 | `padding` | `18rpx` | `16rpx` | `padding: 16rpx 18rpx;` |
| 1108 | `min-height` | `52rpx` | `48rpx` | `min-height: 52rpx;` |
| 1120 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 1121 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 1126 | `min-height` | `52rpx` | `48rpx` | `min-height: 52rpx;` |

### 53. `training/training-execution/index.scss`（93 处）

| 行号 | 属性 | 当前值 | 建议值 | 代码片段 |
|------|------|--------|--------|----------|
| 15 | `padding` | `100rpx` | `96rpx` | `padding: 100rpx 40rpx;` |
| 26 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 24rpx 52rpx;` |
| 26 | `padding` | `52rpx` | `48rpx` | `padding: 28rpx 24rpx 52rpx;` |
| 31 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx;` |
| 32 | `border-radius` | `30rpx` | `32rpx` | `border-radius: 30rpx;` |
| 52 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 58 | `margin-bottom` | `22rpx` | `24rpx` | `margin-bottom: 22rpx;` |
| 65 | `padding` | `10rpx` | `8rpx` | `padding: 10rpx 18rpx;` |
| 65 | `padding` | `18rpx` | `16rpx` | `padding: 10rpx 18rpx;` |
| 66 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 83 | `gap` | `20rpx` | `16rpx` | `gap: 20rpx;` |
| 88 | `width` | `220rpx` | `224rpx` | `width: 220rpx;` |
| 90 | `padding` | `22rpx` | `24rpx` | `padding: 22rpx 18rpx;` |
| 90 | `padding` | `18rpx` | `16rpx` | `padding: 22rpx 18rpx;` |
| 110 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 133 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 145 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 164 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 169 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx 16rpx;` |
| 170 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 185 | `margin-top` | `10rpx` | `8rpx` | `margin-top: 10rpx;` |
| 193 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 198 | `height` | `12rpx` | `16rpx` | `height: 12rpx;` |
| 199 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 213 | `margin-top` | `10rpx` | `8rpx` | `margin-top: 10rpx;` |
| 222 | `gap` | `18rpx` | `16rpx` | `gap: 18rpx;` |
| 226 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 270 | `gap` | `18rpx` | `16rpx` | `gap: 18rpx;` |
| 276 | `width` | `58rpx` | `56rpx` | `width: 58rpx;` |
| 277 | `height` | `58rpx` | `56rpx` | `height: 58rpx;` |
| 278 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 304 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 314 | `border-radius` | `999rpx` | `1000rpx` | `border-radius: 999rpx;` |
| 327 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 348 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 349 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 356 | `border-radius` | `22rpx` | `24rpx` | `border-radius: 22rpx;` |
| 362 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 381 | `width` | `86rpx` | `88rpx` | `width: 86rpx;` |
| 382 | `min-height` | `92rpx` | `96rpx` | `min-height: 92rpx;` |
| 383 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 416 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 436 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 470 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 471 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 472 | `border-radius` | `20rpx` | `16rpx` | `border-radius: 20rpx;` |
| 479 | `gap` | `12rpx` | `16rpx` | `gap: 12rpx;` |
| 487 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 14rpx 12rpx;` |
| 487 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 14rpx 12rpx;` |
| 487 | `padding` | `12rpx` | `16rpx` | `padding: 14rpx 14rpx 12rpx;` |
| 488 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 506 | `min-height` | `52rpx` | `48rpx` | `min-height: 52rpx;` |
| 514 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 515 | `padding` | `14rpx` | `16rpx` | `padding: 14rpx 16rpx;` |
| 516 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 522 | `min-height` | `44rpx` | `48rpx` | `min-height: 44rpx;` |
| 528 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 564 | `margin-top` | `12rpx` | `16rpx` | `margin-top: 12rpx;` |
| 570 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 571 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 16rpx;` |
| 577 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 578 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 584 | `gap` | `14rpx` | `16rpx` | `gap: 14rpx;` |
| 591 | `gap` | `6rpx` | `8rpx` | `gap: 6rpx;` |
| 595 | `margin-top` | `14rpx` | `16rpx` | `margin-top: 14rpx;` |
| 616 | `margin-top` | `18rpx` | `16rpx` | `margin-top: 18rpx;` |
| 617 | `padding` | `18rpx` | `16rpx` | `padding: 18rpx;` |
| 624 | `gap` | `10rpx` | `8rpx` | `gap: 10rpx;` |
| 648 | `padding` | `28rpx` | `32rpx` | `padding: 28rpx 24rpx;` |
| 654 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx 28rpx 0 0;` |
| 654 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx 28rpx 0 0;` |
| 663 | `margin-bottom` | `18rpx` | `16rpx` | `margin-bottom: 18rpx;` |
| 668 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 671 | `padding` | `18rpx` | `16rpx` | `padding: 16rpx 18rpx;` |
| 675 | `max-height` | `460rpx` | `464rpx` | `max-height: 460rpx;` |
| 676 | `margin` | `14rpx` | `16rpx` | `margin: 14rpx 0 18rpx;` |
| 676 | `margin` | `18rpx` | `16rpx` | `margin: 14rpx 0 18rpx;` |
| 687 | `padding` | `36rpx` | `32rpx` | `padding: 36rpx 0;` |
| 693 | `margin-top` | `20rpx` | `16rpx` | `margin-top: 20rpx;` |
| 694 | `padding-bottom` | `28rpx` | `32rpx` | `padding-bottom: 28rpx;` |
| 699 | `margin-bottom` | `12rpx` | `16rpx` | `margin-bottom: 12rpx;` |
| 708 | `border-radius` | `22rpx` | `24rpx` | `border-radius: 22rpx;` |
| 720 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx 28rpx 0 0;` |
| 720 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx 28rpx 0 0;` |
| 724 | `margin-bottom` | `20rpx` | `16rpx` | `margin-bottom: 20rpx;` |
| 733 | `padding` | `12rpx` | `16rpx` | `padding: 12rpx 6rpx;` |
| 733 | `padding` | `6rpx` | `8rpx` | `padding: 12rpx 6rpx;` |
| 735 | `border-radius` | `18rpx` | `16rpx` | `border-radius: 18rpx;` |
| 769 | `max-width` | `540rpx` | `544rpx` | `max-width: 540rpx;` |
| 770 | `border-radius` | `28rpx` | `32rpx` | `border-radius: 28rpx;` |
| 772 | `padding` | `44rpx` | `48rpx` | `padding: 44rpx 34rpx;` |
| 772 | `padding` | `34rpx` | `32rpx` | `padding: 44rpx 34rpx;` |
| 801 | `margin-top` | `26rpx` | `24rpx` | `margin-top: 26rpx;` |

---

**总计：1097 处 8 栅格违规（53 个文件）**
