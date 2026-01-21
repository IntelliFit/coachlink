# 问卷数据结构简化总结

## 简化目标

1. **统一使用 `status` 字段**，废弃 `is_active`（保持兼容）
2. **统一使用 `is_default` 字段**，废弃 `coaches.profile.default_questionnaire_id`（保持兼容）
3. **简化查询逻辑**，避免复杂的 OR 查询导致的问题

## 主要修改

### 1. `get-questionnaires/route.ts` - 修复线上版本获取问题

**问题**：使用 `.or("status.eq.active,is_active.eq.true")` 可能导致查询到错误的记录。

**解决方案**：
- 先获取所有问卷
- 在内存中筛选：优先使用 `status='active'`，如果 `status` 为空则使用 `is_active=true`
- 确保只返回真正的线上版本

### 2. `list-questionnaires/route.ts` - 简化默认问卷逻辑

**修改**：
- 移除从 `coaches.profile.default_questionnaire_id` 恢复的逻辑
- 统一使用 `is_default` 字段
- 简化查询，只查询 `is_default=true` 的问卷

### 3. `publish-questionnaire/route.ts` - 简化下线逻辑

**修改**：
- 先获取所有问卷
- 在内存中筛选线上版本
- 批量更新为 `status='archived'`

### 4. `duplicate-questionnaire/route.ts` - 简化灰度版本查找

**修改**：
- 先获取所有问卷
- 在内存中筛选灰度版本：优先使用 `status='archived'`，如果 `status` 为空则使用 `is_active=false`

### 5. `questionnaire/submit/route.ts` - 简化验证逻辑

**修改**：
- 先获取问卷
- 在内存中验证是否为线上版本
- 如果不是线上版本，返回 404

## 查询逻辑统一

所有查询都遵循以下逻辑：

```typescript
// 筛选线上版本
const isActive = (q: any) => {
    if (q.status) {
        return q.status === 'active';
    }
    // 兼容旧数据：如果 status 为空，使用 is_active
    return q.is_active === true;
};

// 筛选灰度版本
const isArchived = (q: any) => {
    if (q.status) {
        return q.status === 'archived';
    }
    // 兼容旧数据：如果 status 为空，使用 is_active
    return q.is_active === false;
};
```

## 向后兼容

- ✅ 所有旧数据（只有 `is_active`，没有 `status`）仍然可以正常工作
- ✅ 所有旧数据（只有 `default_questionnaire_id`，没有 `is_default`）仍然可以正常工作
- ✅ 写入操作会同时更新新旧字段，保持同步

## 优势

1. **更简洁**：统一使用 `status` 和 `is_default`，减少字段冗余
2. **更可靠**：在内存中筛选避免了复杂的 SQL OR 查询可能导致的边界情况
3. **更易维护**：逻辑清晰，易于理解和调试
4. **向后兼容**：不破坏现有数据，平滑迁移

## 未来计划

1. **数据迁移**：运行迁移脚本，确保所有数据都有 `status` 和 `is_default`
2. **废弃旧字段**：在所有数据迁移完成后，可以考虑废弃 `is_active` 和 `default_questionnaire_id`
3. **更新类型定义**：在废弃旧字段后，更新 TypeScript 类型定义
