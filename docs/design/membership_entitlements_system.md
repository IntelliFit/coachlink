# 会员权益与配额系统设计方案

## 1. 设计目标

建立会员等级（Free/Basic/Premium）与具体权益（AI生成次数、存储空间）的绑定关系，并实现自动化的权益重置与鉴权逻辑。

## 2. 核心挑战

- **权益差异化**：不同等级拥有不同的每月配额。
- **周期性重置**："每月 10
  次"意味着需要在新的计费周期或自然月重置配额，而不是永久累加。
- **实施时机**：如何在用户使用功能时准确判断是否有权操作。

## 3. 系统架构设计

### 3.1 核心配置中心 (`MembershipConfig`)

在代码中集中定义各等级的权益，便于后续调整。

```typescript
export const MEMBER_BENEFITS = {
    free: {
        ai_limit_monthly: 2,
        storage_mb: 50,
        can_access_advanced_report: false,
    },
    basic: {
        ai_limit_monthly: 10,
        storage_mb: 1024, // 1GB
        can_access_advanced_report: false,
    },
    premium: {
        ai_limit_monthly: 999999, // 无限
        storage_mb: 5120, // 5GB
        can_access_advanced_report: true,
    },
};
```

### 3.2 数据库模式升级

现有的 `student_quotas` 表需要增加字段以支持周期性重置。

| 字段名                | 类型            | 说明                          |
| :-------------------- | :-------------- | :---------------------------- |
| `user_id`             | uuid            | 用户ID (PK)                   |
| `ai_import_balance`   | int             | 当前剩余AI次数                |
| `storage_total_mb`    | int             | 总存储空间                    |
| `storage_used_mb`     | float           | 已用存储空间                  |
| **`last_reset_date`** | **timestamptz** | **(新增) 上次重置配额的时间** |

### 3.3 "懒重置" (Lazy Reset) 策略

为了避免复杂的定时任务 (Cron
Job)，我们采用"懒重置"策略：**仅在用户尝试使用权益时检查并重置**。

**工作流程**：

1. 用户请求生成 AI 计划。
2. 调用 `StudentMembershipService.checkAndConsumeAiQuota(userId)`。
3. 系统检查 `last_reset_date`：
   - 如果 `last_reset_date` 是上个月（或更早）：
     - 读取用户当前会员等级（如 Basic）。
     - 将 `ai_import_balance` 重置为 `MEMBER_BENEFITS.basic.ai_limit_monthly`。
     - 更新 `last_reset_date` 为当前时间。
   - 如果还在当月，则跳过重置。
4. 检查 `ai_import_balance > 0`：
   - 是：扣除 1 次，允许操作。
   - 否：拦截请求，提示"配额不足，请购买加油包或升级"。

### 3.4 存储空间管控

存储空间通常是"总量限制"，不涉及每月重置，但在会员降级时需要处理。

- **上传时检查**：`storage_used_mb + new_file_size <= storage_total_mb`。
- **降级处理**：如果用户从 Premium 降级为
  Free，总量配额减少。已存储文件**不删除**（软限制），但禁止上传新文件，直到用量低于新配额。

## 4. 实施计划

1. **数据库迁移**：添加 `last_reset_date` 字段。
2. **服务层升级**：
   - 修改 `StudentMembershipService`，实现 `checkAndConsumeAiQuota`。
   - 引入 `MEMBER_BENEFITS` 配置。
3. **API 接入**：
   - 在 `create-ai-instance` (AI生成) 接口前调用 `checkAndConsumeAiQuota`。
   - 在 `upload-video` (视频上传) 接口前检查存储配额。

此方案无需后台常驻进程，逻辑清晰，且能通过加油包（Add-on
Pack）灵活扩展额外权益（加油包购买的次数可叠加在 Monthly Quota
之上，或单独字段存储，简单起见可直接叠加到 Balance
但需注意重置逻辑不要误清零加油包次数——_优化建议：将加油包次数单独存储为
`extra_ai_balance`，优先扣除 Monthly，再扣除 Extra，重置只重置 Monthly_）。
