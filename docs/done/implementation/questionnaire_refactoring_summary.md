# 问卷字段重构总结

## 重构目标

统一使用新字段 `status` 和 `is_default`，逐步废弃 `is_active` 和 `coaches.profile.default_questionnaire_id`，同时保持向后兼容，不破坏现有数据。

## 字段关系

### 1. `is_active` vs `status` - 已同步维护

- **`is_active`** (boolean): 历史遗留字段，标记"是否已发布/上线"
- **`status`** (text): 新字段，标记状态（'active'/'archived'），更灵活

**同步规则**：
- `is_active=true` ↔ `status='active'`
- `is_active=false` ↔ `status='archived'`

**查询策略**：优先使用 `status`，兼容旧数据用 `is_active`

### 2. `is_default` vs `default_questionnaire_id` - 已统一

- **`is_default`** (boolean): 数据库字段，有唯一索引约束（每个教练只能有一个 `is_default=true`）
- **`default_questionnaire_id`** (string): 存储在 `coaches.profile` JSON 中（向后兼容）

**同步规则**：
- `set-default-questionnaire` API 会同时更新 `is_default` 和 `default_questionnaire_id`
- `list-questionnaires` API 优先使用 `is_default`，如果不存在则从 `default_questionnaire_id` 恢复并同步

## 已修改的文件

### 后端 API

1. **`src/app/api/coach/list-questionnaires/route.ts`**
   - ✅ 查询时包含 `status`, `name`, `is_default` 字段
   - ✅ 优先使用 `is_default` 而不是 `default_questionnaire_id`
   - ✅ 如果 `is_default` 不存在，从 `default_questionnaire_id` 恢复并同步
   - ✅ 识别线上/灰度版本时优先使用 `status`

2. **`src/app/api/coach/get-questionnaires/route.ts`**
   - ✅ 查询线上问卷时兼容 `status='active'` 和 `is_active=true`
   - ✅ 查询时包含 `status` 字段

3. **`src/app/api/coach/get-questionnaire-by-id/route.ts`**
   - ✅ 查询时包含 `status` 字段
   - ✅ 返回时兼容旧数据（从 `is_active` 推导 `status`）

4. **`src/app/api/coach/update-questionnaires/route.ts`**
   - ✅ 更新时同步 `status` 和 `is_active`
   - ✅ 新建时默认创建为灰度版本（`is_active=false`, `status='archived'`）

5. **`src/app/api/coach/publish-questionnaire/route.ts`**
   - ✅ 发布时同步更新 `status='active'` 和 `is_active=true`
   - ✅ 下线旧版本时同步更新 `status='archived'` 和 `is_active=false`
   - ✅ 查询时兼容 `status` 和 `is_active`

6. **`src/app/api/coach/duplicate-questionnaire/route.ts`**
   - ✅ 复制时设置 `status='archived'` 和 `is_active=false`
   - ✅ 查找灰度版本时兼容 `status='archived'` 和 `is_active=false`

7. **`src/app/api/coach/set-default-questionnaire/route.ts`**
   - ✅ 同时更新 `is_default` 和 `default_questionnaire_id`（保持同步）
   - ✅ 清除其他问卷的 `is_default` 标记

8. **`src/app/api/questionnaire/submit/route.ts`**
   - ✅ 查询线上问卷时兼容 `status='active'` 和 `is_active=true`

### 数据迁移工具

9. **`src/lib/questionnaireMigration.ts`** (新建)
   - ✅ `migrateCoachQuestionnaires()`: 迁移单个教练的问卷数据
   - ✅ `migrateAllQuestionnaires()`: 迁移所有教练的问卷数据
   - ✅ 确保 `status` 和 `is_active` 同步
   - ✅ 确保 `is_default` 正确设置（每个教练只有一个）

## 向后兼容策略

### 查询兼容

所有查询都使用 `OR` 条件同时检查新旧字段：

```typescript
.or("status.eq.active,is_active.eq.true")  // 查询线上版本
.or("status.eq.archived,is_active.eq.false")  // 查询灰度版本
```

### 写入同步

所有写入操作都同时更新新旧字段：

```typescript
update({
  status: 'active',
  is_active: true,  // 同步
})
```

### 数据恢复

如果新字段不存在，从旧字段推导并同步：

```typescript
const status = data.status || (data.is_active ? 'active' : 'archived');
const isActive = status === 'active';
```

## 前端代码

前端代码**无需修改**，因为：
- 前端只使用 `is_active` 字段来判断线上/灰度版本
- 后端 API 已经兼容，返回的数据中 `is_active` 字段始终正确
- `defaultTemplateId` 从 API 的 `defaultId` 获取，后端已优先使用 `is_default`

## 数据迁移

### 自动迁移

以下 API 在查询时会自动迁移数据：

- `list-questionnaires`: 如果发现 `is_default` 不存在，会从 `default_questionnaire_id` 恢复并同步

### 手动迁移

如果需要批量迁移所有数据，可以调用：

```typescript
import { migrateAllQuestionnaires } from '@/lib/questionnaireMigration';

// 迁移所有教练的问卷数据
const result = await migrateAllQuestionnaires();
console.log(`更新了 ${result.totalUpdated} 条记录`);
if (result.errors.length > 0) {
  console.error('错误:', result.errors);
}
```

## 测试建议

1. **测试旧数据兼容性**：
   - 使用只有 `is_active` 没有 `status` 的旧数据
   - 验证所有 API 都能正常工作

2. **测试新数据**：
   - 使用有 `status` 和 `is_default` 的新数据
   - 验证所有 API 都能正常工作

3. **测试数据同步**：
   - 修改 `status`，验证 `is_active` 是否同步
   - 修改 `is_active`，验证 `status` 是否同步
   - 设置 `is_default`，验证 `default_questionnaire_id` 是否同步

4. **测试默认问卷**：
   - 验证每个教练只能有一个 `is_default=true` 的问卷
   - 验证 `list-questionnaires` 返回的 `defaultId` 正确

## 未来计划

### 长期目标（可选）

1. **废弃 `is_active`**：
   - 所有代码统一使用 `status`
   - 删除 `is_active` 字段（需要数据迁移）

2. **废弃 `default_questionnaire_id`**：
   - 所有代码统一使用 `is_default`
   - 删除 `coaches.profile.default_questionnaire_id`（需要数据迁移）

### 注意事项

- 在废弃旧字段之前，需要确保所有环境（开发、测试、生产）都已迁移
- 建议在废弃前运行数据迁移工具，确保所有数据都有新字段
- 废弃后需要更新数据库类型定义（`database.types.ts`）
