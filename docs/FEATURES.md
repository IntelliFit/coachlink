# 功能 / 需求索引（点击即达“资料包”）

> 这是你要的“列表页”：把 **已完成（done）** 与 **未完成（work）** 的需求放在同一个入口，并为每个条目挂上对应的：需求/设计/分析/复盘/测试/规划文档。
>
> 约定：
> - **done**：当前可依赖的结论与实现口径（新人按它写不会踩坑）
> - **work**：进行中/新需求/方案（会变，允许不完美）
>
> **done 标准（你确认的口径）**：代码已上线或已合并到 `main` 即算 done。

---

## 已完成（done）

| 条目 | 资料包 |
|---|---|
| B1 订阅模型（按训练日 credits 消耗） | [查看](#done-b1-订阅模型按训练日-credits-消耗) |
| 训练执行系统自洽规范（允许跳过、未开始不显示日期） | [查看](#done-训练执行系统自洽规范) |
| 计划系统（模板-实例模式） | [查看](#done-计划系统模板-实例) |
| 自动算重量（1RM / RM / 百分比 + 自重处理） | [查看](#done-自动算重量) |
| 问卷系统（教练配置/发布/默认问卷/学员提交） | [查看](#done-问卷系统教练配置发布默认问卷学员提交) |
| 问卷字段口径（is_active/status/is_default） | [查看](#done-问卷字段口径) |
| 教练发现页（搜索/分页） | [查看](#done-教练发现页搜索分页) |
| 排行榜系统（提交/审核/榜单管理） | [查看](#done-排行榜系统提交审核榜单管理) |
| 聊天系统（会话/消息/未读/视频列表） | [查看](#done-聊天系统会话消息未读视频列表) |
| 好友系统（申请/通过/动态/记录） | [查看](#done-好友系统申请通过动态记录) |
| 分享与拉新（ShareId/追踪/公开页） | [查看](#done-分享与拉新shareid追踪公开页) |
| Web Push 系统通知 | [查看](#done-web-push-系统通知) |
| 会员权益与配额（懒重置） | [查看](#done-会员权益与配额) |
| 智能导入计划（AI 解析） | [查看](#done-智能导入计划) |
| 计划库（模板管理 / AI 导入 / 批量生成 / 学员计划库） | [查看](#done-计划库模板管理--ai-导入--批量生成--学员计划库) |
| 今日训练 & 训练执行（逐组记录/视频/PR/分享卡片） | [查看](#done-今日训练--训练执行逐组记录视频pr分享卡片) |
| PR 与 1RM 估算（e1RM/PR 记录/进步足迹） | [查看](#done-pr-与-1rm-估算e1rmpr-记录进步足迹) |
| 动作库（Action Library：教练/学员动作管理 + 示范视频） | [查看](#done-动作库action-library教练学员动作管理--示范视频) |
| 视频系统（上传 URL/收藏/视频库/教练审核点评） | [查看](#done-视频系统上传-url收藏视频库教练审核点评) |
| 教练后台（概览/学员管理/学员详情） | [查看](#done-教练后台概览学员管理学员详情) |
| 会员系统（状态/配额/订阅/邀请拉新） | [查看](#done-会员系统状态配额订阅邀请拉新) |
| 微信登录/绑定（wechat-auth + miniapp login） | [查看](#done-微信登录绑定wechat-auth--miniapp-login) |
| 管理后台（settings/payments/analytics retention） | [查看](#done-管理后台settingspaymentsanalytics-retention) |
| 学员自建计划管理（“收藏的计划”） | [查看](#done-学员自建计划管理收藏的计划) |
| 存储桶修复与资源清理（avatars / payment-qr-codes / 视频清理） | [查看](#done-存储桶修复与资源清理) |
| 支付移动端适配（alipay.trade.wap.pay） | [查看](#done-支付移动端适配) |
| 文档与工程规范（开发约定/检查清单） | [查看](#done-文档与工程规范) |

---

### done: B1 订阅模型（按训练日 credits 消耗）

- **业务口径/核心逻辑**：`./done/core-business/business-logic-b1-subscription-plan-execution.md`
- **典型线上坑复盘**：`./done/core-business/bugfix-notes-2026-01-20.md`
- **代码入口（指针）**：
  - `src/lib/subscriptionCredits.ts`
  - `src/lib/subscriptionCredits.test.ts`
  - `src/app/api/subscription/**`
  - `src/app/api/execution/**`

---

### done: 训练执行系统自洽规范

- **规范文档（产品拍板）**：`./done/core-business/training-execution-self-consistent-spec-v1.md`
- **相关复盘**：`./done/core-business/bugfix-notes-2026-01-20.md`
- **测试建议（入口）**：
  - `./done/testing/测试快速指南.md`
  - `./done/testing/测试策略深度解析.md`

---

### done: 计划系统（模板-实例）

- **设计文档**：`./done/core-business/coach_plan_system_design.md`
- **关联：B1 订阅模型**：`./done/core-business/business-logic-b1-subscription-plan-execution.md`

---

### done: 自动算重量

- **说明文档**：`./done/core-business/auto_weight_calculation.md`
- **代码入口（指针）**：
  - `src/lib/rmCaculator.ts`
  - `src/app/dashboard/plan-lib/components/ActionSetForm.tsx`

---

### done: 问卷系统（教练配置/发布/默认问卷/学员提交）

> 你提到的“问卷增强系统已做了”——从代码结构看，教练端问卷管理与学员端提交闭环已经存在：编辑/预览/发布/复制/默认问卷/媒体上传/历史。

- **教练端问卷页面**：
  - `src/app/dashboard/questionnaire/page.tsx`
  - `src/app/dashboard/questionnaire/components/QuestionnaireFlow.tsx`
  - `src/app/dashboard/questionnaire/components/QuestionPreviewDialog.tsx`
  - `src/app/dashboard/questionnaire/components/OptionQuestionManager.tsx`
  - `src/app/dashboard/questionnaire/components/AddQuestionOverlay.tsx`
- **学员侧问卷入口**：
  - `src/app/coach/profile/[id]/QuestionnaireForm.tsx`（订阅/入驻填写）
- **API（教练管理）**：
  - `src/app/api/coach/list-questionnaires/route.ts`
  - `src/app/api/coach/get-questionnaires/route.ts`
  - `src/app/api/coach/update-questionnaires/route.ts`
  - `src/app/api/coach/publish-questionnaire/route.ts`
  - `src/app/api/coach/duplicate-questionnaire/route.ts`
  - `src/app/api/coach/set-default-questionnaire/route.ts`
  - `src/app/api/coach/get-questionnaire-by-id/route.ts`
  - `src/app/api/coach/upload-question-media/route.ts`
- **API（学员提交/历史）**：
  - `src/app/api/questionnaire/submit/route.ts`
  - `src/app/api/questionnaire/history/route.ts`
  - `src/app/api/subscription/update-questionnaire/route.ts`

---

### done: 问卷字段口径

- **分析文档**：`./done/core-business/questionnaire_fields_analysis.md`
- **扩展/优化方案（work）**：`./work/plans/questionnaire_enhancement_plan.md`

---

### done: 教练发现页（搜索/分页）

- **页面入口**：`src/app/coach/discovery/page.tsx`
- **相关页面**：`src/app/coach/profile/[id]/page.tsx`（教练主页）
- **订阅组件**：`src/app/coach/profile/[id]/CoachSubscription.tsx`

---

### done: 排行榜系统（提交/审核/榜单管理）

- **学员侧页面**：
  - `src/app/ranking/page.tsx`
  - `src/app/ranking/[id]/page.tsx`
  - `src/app/ranking/[id]/SubmissionDialog.tsx`
- **管理员后台**：
  - `src/app/admin/rankings/page.tsx`
  - `src/app/admin/rankings/review/[id]/page.tsx`
- **API**：`src/app/api/ranking/**`
- **服务层**：`src/app/service/rankingService.ts`

---

### done: 聊天系统（会话/消息/未读/视频列表）

- **页面入口**：`src/app/messages/page.tsx`
- **API**：
  - `src/app/api/chat/list-chatrooms/route.ts`
  - `src/app/api/chat/get-chatroom/route.ts`
  - `src/app/api/chat/list-messages/route.ts`
  - `src/app/api/chat/send-message/route.ts`
  - `src/app/api/chat/mark-as-read/route.ts`
  - `src/app/api/chat/get-unread-count/route.ts`
  - `src/app/api/chat/list-student-videos/**`
  - `src/app/api/chat/unified-stream/route.ts`
- **服务层**：`src/app/service/chatService.ts`

---

### done: 好友系统（申请/通过/动态/记录）

- **页面入口**：
  - `src/app/friends/page.tsx`
  - `src/app/friends/activity/page.tsx`
- **API**：`src/app/api/user/friends/**`
- **服务层**：`src/app/service/friendService.ts`

---

### done: 分享与拉新（ShareId/追踪/公开页）

- **公开分享页**：`src/app/s/[shareId]/page.tsx`
- **API（增长追踪）**：`src/app/api/growth/share/**`
- **服务层**：`src/app/service/growthService.ts`

---

### done: Web Push 系统通知

- **设计文档**：`./done/system-design/push-notifications.md`
- **代码入口（指针）**：
  - `public/sw.js`
  - `src/lib/swRegistration.ts`
  - `src/lib/pushNotify.ts`
  - `src/app/api/push/subscribe/route.ts`

---

### done: 会员权益与配额

- **设计文档**：`./done/system-design/membership_entitlements_system.md`
- **成本/配额相关复盘**：`./done/implementation/lessons/storage_cost_analysis.md`

---

### done: 智能导入计划

- **分析报告**：`./done/product/智能导入计划功能分析报告.md`
- **演示用法（产品视角）**：`./done/product/给刘三乐演示用法.md`
- **相关 work 文档（历史归档）**：
  - `./work/roadmap/archive/[已完成]智能导入模板功能设计.md`
  - `./work/roadmap/archive/智能导入模板技术实现总结.md`

---

### done: 计划库（模板管理 / AI 导入 / 批量生成 / 学员计划库）

> 这块从代码看已经形成“教练模板库 + 学员计划库 + AI 导入/生成 + 执行关联”的闭环。

- **教练端（模板库/创建/编辑）**：
  - `src/app/dashboard/plan-lib/page.tsx`
  - `src/app/dashboard/plan-lib/create/page.tsx`
  - `src/app/dashboard/plan-lib/edit/[id]/page.tsx`
  - `src/app/dashboard/plan-lib/components/TemplateCard.tsx`
  - `src/app/dashboard/plan-lib/components/SmartImportDialog.tsx`（教练智能导入）
- **学员端（计划库/创建/编辑/历史）**：
  - `src/app/me/plan-lib/page.tsx`
  - `src/app/me/plan-lib/create/page.tsx`
  - `src/app/me/plan-lib/edit/[id]/page.tsx`
  - `src/app/me/plan-history/page.tsx`
  - `src/app/me/plan-history/[id]/page.tsx`
  - `src/app/me/plan-lib/components/StudentSmartImportDialog.tsx`（学员智能导入）
- **API（计划库/实例/执行聚合）**：
  - `src/app/api/plan-lib/get-instance/route.ts`
  - `src/app/api/plan-lib/get-today-training-instance/route.ts`
  - `src/app/api/plan-lib/get-with-executions/route.ts`
  - `src/app/api/plan-lib/bulk-create-ai-instances/route.ts`（批量 AI 生成）
  - `src/app/api/plan-lib/create-ai-instance/*`（AI 生成匹配/服务）
- **服务层**：
  - `src/app/service/planLibService.ts`
  - `src/app/service/studentPlanLibService.ts`

---

### done: 今日训练 & 训练执行（逐组记录/视频/PR/分享卡片）

- **学员侧页面**：
  - `src/app/today-training/page.tsx`
  - `src/app/training-execution/[instanceId]/page.tsx`
- **教练侧看板（计划 dashboard）**：
  - `src/app/coach/plans/page.tsx`
  - `src/app/coach/plans/dashboard/[id]/TodayTraining.tsx`
  - `src/app/coach/plans/dashboard/[id]/training-execution/page.tsx`
- **API（执行）**：`src/app/api/execution/**`
  - start/finish/complete-set/complete-item/skip/check-today/get/get-next-training-day
  - upload-set-video/add-set-video-link
  - share-info/share-card-info
- **分享卡片组件**：`src/components/share/ShareCardGenerator.tsx`

---

### done: PR 与 1RM 估算（e1RM/PR 记录/进步足迹）

- **API（估算/PR）**：
  - `src/app/api/execution/calculate-e1rm/route.ts`
  - `src/app/api/execution/create-pr/route.ts`
  - `src/app/api/execution/get-pr-records/route.ts`
  - `src/app/api/execution/delete-pr-record/route.ts`
  - `src/app/api/student/get-e1rm-history/route.ts`
  - `src/app/api/student/get-current-1rm/route.ts`
- **进步足迹（组件）**：
  - `src/components/student/profile/ProgressTimeline.tsx`
  - `src/components/student/profile/CoachViewProgressTimeline.tsx`

---

### done: 动作库（Action Library：教练/学员动作管理 + 示范视频）

> 注意：`work` 里有“动作库重构/实现计划”，那属于下一阶段；但从代码看“动作库基础管理能力”已存在（MVP done）。

- **教练端动作库**：
  - `src/app/dashboard/action-lib/ActionEditDialog.tsx`
- **学员端动作库**：
  - `src/app/me/action-lib/StudentActionEditDialog.tsx`
- **API（动作库）**：
  - `src/app/api/action-lib/update-action/route.ts`
  - `src/app/api/action-lib/delete-action/route.ts`
  - `src/app/api/action-lib/upload-demo-video/route.ts`
- **服务层**：`src/app/service/actionLibService.ts`

---

### done: 视频系统（上传 URL/收藏/视频库/教练审核点评）

- **视频库页面**：`src/app/dashboard/videos/page.tsx`
- **教练审核点评（视频）**：
  - `src/app/api/coach/video/review/route.ts`
- **上传/预签名 URL（用户侧）**：
  - `src/app/api/user/create-video-upload-url/route.ts`
  - `src/app/api/user/upload-video/route.ts`
  - `src/app/api/user/submit-video-url/route.ts`
  - `src/app/api/user/add-video-to-collection/route.ts`
- **聊天相关视频列表**：`src/app/api/chat/list-student-videos/route.ts`
- **服务层**：`src/app/service/videoService.ts`

---

### done: 教练后台（概览/学员管理/学员详情）

- **页面入口**：
  - `src/app/dashboard/overview/page.tsx`
  - `src/app/dashboard/students/page.tsx`
  - `src/app/dashboard/students/StudentDetailDialog.tsx`
  - `src/app/dashboard/students/plan/[id]/page.tsx`
- **API**：
  - `src/app/api/coach/list-students/route.ts`
  - `src/app/api/coach/get-student/route.ts`
  - `src/app/api/coach/get-overview-data/route.ts`
  - `src/app/api/user/get-student-profile/route.ts`

---

### done: 会员系统（状态/配额/订阅/邀请拉新）

- **页面入口**：
  - `src/app/me/membership/page.tsx`
  - `src/app/me/membership/subscribe/page.tsx`
  - `src/app/me/membership/referral/page.tsx`
- **API（会员状态/配额/消耗）**：
  - `src/app/api/membership/get-status/route.ts`
  - `src/app/api/membership/get-quota/route.ts`
  - `src/app/api/membership/consume-ai-quota/route.ts`
  - `src/app/api/membership/create-order/route.ts`
- **API（邀请拉新）**：
  - `src/app/api/membership/referral/create-invite/route.ts`
  - `src/app/api/membership/referral/stats/route.ts`
- **服务层**：
  - `src/app/service/studentMembershipService.ts`
  - `src/app/service/fulfillmentService.ts`

---

### done: 微信登录/绑定（wechat-auth + miniapp login）

- **页面入口**：
  - `src/app/wechat-auth/login-bridge/page.tsx`
  - `src/app/wechat-auth/bridge/page.tsx`
  - `src/app/wechat-auth/bind/page.tsx`
  - `src/app/wechat-auth/bind-bridge/page.tsx`
- **API（网页登录/绑定）**：
  - `src/app/api/wechat/login/start/route.ts`
  - `src/app/api/wechat/login/finish/route.ts`
  - `src/app/api/wechat/bind/start/route.ts`
  - `src/app/api/wechat/bind/callback/route.ts`
- **API（小程序登录）**：`src/app/api/miniapp/wechat-login/route.ts`
- **解绑**：`src/app/api/user/unbind-contact/route.ts`

---

### done: 管理后台（settings/payments/analytics retention）

- **页面入口**：
  - `src/app/admin/settings/page.tsx`
  - `src/app/admin/payments/coach-settings/page.tsx`
  - `src/app/admin/analytics/page.tsx`
- **API**：
  - `src/app/api/admin/analytics/retention/route.ts`
  - `src/app/api/admin/analytics/dashboard/route.ts`

---

### done: 学员自建计划管理（“收藏的计划”）

- **变更记录（完成标准：已合并 main）**：`./work/roadmap/CHANGELOG.md#2026-01-04`
- **相关资料（实现总结/历史）**：
  - `./work/roadmap/archive/学员自建计划体系技术总结.md`

---

### done: 存储桶修复与资源清理

- **变更记录（完成标准：已合并 main）**：`./work/roadmap/CHANGELOG.md#2026-01-04`
- **相关资料（成本/实现笔记）**：
  - `./done/implementation/lessons/storage_cost_analysis.md`
  - `./done/implementation/lessons/quota_storage_implementation_notes.md`

---

### done: 支付移动端适配

- **变更记录（完成标准：已合并 main）**：`./work/roadmap/CHANGELOG.md#2026-01-04`
- **相关资料（如果需要补全“支付系统 dossier”，建议从这里开始）**：
  - `src/app/api/payment/alipay/**`
  - `src/app/service/alipayService.ts`
  - `src/components/payment/paymentDialog.tsx`

---

### done: 文档与工程规范

- **前端/工程约定**：`./done/engineering/PROMPT.md`
- **代码检查清单**：`./done/engineering/代码检查清单.md`
- **代码示例对比**：`./done/engineering/代码示例对比.md`

---

## 未完成（work）

| 条目 | 资料包 |
|---|---|
| Action Library（动作库重构/实现） | [查看](#work-action-library动作库) |
| Chat 提及（@mentions） | [查看](#work-chat-提及mentions) |
| Knowledge Base（知识库） | [查看](#work-knowledge-base知识库) |
| Payments（支付：提现/退款） | [查看](#work-payments支付提现退款) |
| Plan System（通用计划体系扩展） | [查看](#work-plan-system通用计划体系扩展) |
| Social（好友/动态/分享） | [查看](#work-social社交系统) |
| Student App（学员端优化） | [查看](#work-student-app学员端优化) |
| Coach Dashboard（教练端优化） | [查看](#work-coach-dashboard教练端优化) |
| Growth（增长：提醒/签到/分享） | [查看](#work-growth增长) |
| Ecosystem（共建生态：动作/计划） | [查看](#work-ecosystem共建生态动作计划) |
| PWA Push（重点推送） | [查看](#work-pwa-push重点推送) |
| Private Domain（健身房私域模式） | [查看](#work-private-domain健身房私域模式) |
| 新手引导系统 | [查看](#work-新手引导系统) |

---

### work: Action Library（动作库）

- **实现计划/现状**：
  - `./work/roadmap/action_library_implementation.md`
  - `./work/roadmap/action_library_redesign.md`

---

### work: Chat 提及（mentions）

- **需求**：`./work/roadmap/features/chat/requirements-mentions.md`
- **实现思路**：`./work/roadmap/features/chat/implementation-mentions.md`

---

### work: Knowledge Base（知识库）

- **规划**：`./work/roadmap/features/knowledge-base/planning-kb.md`
- **需求**：`./work/roadmap/features/knowledge-base/知识库-20260127.md`

---

### work: Payments（支付：提现/退款）

- **需求**：`./work/roadmap/features/payments/支付系统提现退款-20260127.md`

---

### work: Plan System（通用计划体系扩展）

- **策略/实现计划**：
  - `./work/roadmap/features/plans/implementation-plan.md`
  - `./work/roadmap/features/plans/universal_extension_progress.md`
- **需求**：
  - `./work/roadmap/features/plans/requirements-universal-extension.md`
  - `./work/roadmap/features/plans/requirements-multicycle.md`
- **1RM 策略（关联）**：`./work/roadmap/features/plans/1rm_handling_strategy.md`

---

### work: Social（社交系统）

- **需求**：`./work/roadmap/features/social/requirements-social.md`
- **规划/设计**：
  - `./work/roadmap/features/social/planning-system.md`
  - `./work/roadmap/features/social/design-friends.md`
  - `./work/roadmap/features/social/design-share-cards.md`
- **实现 MVP**：`./work/roadmap/features/social/implementation-mvp.md`

---

### work: Student App（学员端优化）

- **需求**：
  - `./work/roadmap/features/student/训练页优化-20260127.md`
  - `./work/roadmap/features/student/discover-coaches-optimization-20260127.md`
  - `./work/roadmap/features/student/自建动作库计划便捷性-20260127.md`
  - `./work/roadmap/features/student/女性小白友好体验-20260127.md`

---

### work: Coach Dashboard（教练端优化）

- **需求**：
  - `./work/roadmap/features/coach/questionnaire-optimization-20260127.md`
  - `./work/roadmap/features/coach/动作库优化-20260127.md`
  - `./work/roadmap/features/coach/模板库优化-20260127.md`
  - `./work/roadmap/features/coach/student-execution-system-optimization-20260127.md`
  - `./work/roadmap/features/coach/inactivity-auto-close-20260127.md`

---

### work: Growth（增长）

- **需求**：
  - `./work/roadmap/features/growth/提醒签到鼓励活跃度-20260127.md`
  - `./work/roadmap/features/growth/sharing-upgrade-20260127.md`

---

### work: Ecosystem（共建生态：动作/计划）

- **需求**：`./work/roadmap/features/ecosystem/动作库计划共建生态-20260127.md`

---

### work: PWA Push（重点推送）

- **需求**：`./work/roadmap/features/pwa/PWA重点推送-20260127.md`

---

### work: Private Domain（健身房私域模式）

- **需求**：`./work/roadmap/features/private-domain/教练健身房私域模式-20260127.md`

---

### work: 新手引导系统

- **需求文档**：`./work/roadmap/新手引导系统需求文档.md`

