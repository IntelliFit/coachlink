# plan-execution 分支合并冲突分析

> **状态**: 本次合并已取消，本文档用于记录冲突位置和解决方案  
> **创建时间**: 2026-01-22  
> **目标**: 为未来的合并提供清晰的冲突解决指南

---

## 冲突文件总览

本次合并共发现 **6 个冲突文件**：

1. `src/app/api/execution/complete-item/route.ts`
2. `src/app/api/execution/complete-set/route.ts`
3. `src/app/api/execution/finish/route.ts`
4. `src/app/api/plan-lib/get-instance/route.ts`
5. `src/app/today-training/page.tsx`
6. `tsconfig.tsbuildinfo`

---

## 详细冲突分析

### 1. `src/app/api/execution/complete-item/route.ts`

**冲突类型**: 内容冲突

**冲突原因**:
- `main` 分支：使用内联的 `updateEstimatedEndDate` 函数
- `plan-execution` 分支：引入外部模块 `updateEstimatedEndDateForInstance`，并添加了执行进度计算功能

**关键差异**:
1. **导入语句**:
   - `main`: 无特殊导入
   - `plan-execution`: 
     ```typescript
     import { computeExecutionProgress } from "@/lib/executionProgress";
     import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
     ```

2. **执行进度计算**:
   - `main`: 无此功能
   - `plan-execution`: 使用 `computeExecutionProgress` 计算完成项目数

3. **预计完成日期更新**:
   - `main`: 内联函数 `updateEstimatedEndDate`
   - `plan-execution`: 外部模块 `updateEstimatedEndDateForInstance`

**解决方案**:
- ✅ **采用 plan-execution 的方案**
- 原因：外部模块化更易维护，执行进度计算是新功能
- 步骤：
  1. 保留 `plan-execution` 的导入语句
  2. 保留 `computeExecutionProgress` 的使用
  3. 保留 `updateEstimatedEndDateForInstance` 的调用

---

### 2. `src/app/api/execution/complete-set/route.ts`

**冲突类型**: 内容冲突

**冲突原因**:
- `main` 分支：基础功能，无 e1RM 自动计算
- `plan-execution` 分支：添加了 e1RM 自动计算、PR 检测、执行进度计算

**关键差异**:
1. **e1RM 计算功能**:
   - `main`: 无
   - `plan-execution`: 完整的 `handleAutoE1RMCheck` 函数

2. **执行进度计算**:
   - `main`: 无
   - `plan-execution`: 使用 `computeExecutionProgress`

3. **预计完成日期更新**:
   - `main`: 内联函数
   - `plan-execution`: 外部模块

4. **响应数据**:
   - `main`: 基础响应
   - `plan-execution`: 包含 `autoE1RM` 结果

**解决方案**:
- ✅ **采用 plan-execution 的方案**
- 原因：包含重要的新功能（e1RM 自动计算），且架构更清晰
- 步骤：
  1. 保留完整的 `handleAutoE1RMCheck` 函数
  2. 保留 `computeExecutionProgress` 的使用
  3. 保留 `updateEstimatedEndDateForInstance` 的调用
  4. 保留响应中的 `autoE1RM` 字段

---

### 3. `src/app/api/execution/finish/route.ts`

**冲突类型**: 内容冲突

**冲突原因**:
- `main` 分支：使用内联的 `updateEstimatedEndDate` 函数
- `plan-execution` 分支：使用外部模块 `updateEstimatedEndDateForInstance`

**关键差异**:
1. **导入语句**:
   - `main`: 无特殊导入
   - `plan-execution`: 
     ```typescript
     import { updateEstimatedEndDateForInstance } from "../updateEstimatedEndDate";
     ```

2. **预计完成日期更新**:
   - `main`: 内联函数实现
   - `plan-execution`: 外部模块调用

**解决方案**:
- ✅ **采用 plan-execution 的方案**
- 原因：统一使用外部模块，保持代码一致性
- 步骤：
  1. 保留 `plan-execution` 的导入语句
  2. 替换内联函数为 `updateEstimatedEndDateForInstance` 调用

---

### 4. `src/app/api/plan-lib/get-instance/route.ts`

**冲突类型**: 内容冲突

**冲突原因**:
- `main` 分支：包含性能日志功能
- `plan-execution` 分支：添加了 `recommendedDayIndex` 和 `missingDays` 计算

**关键差异**:
1. **性能日志**:
   - `main`: 有性能日志记录
   - `plan-execution`: 无性能日志（或不同实现）

2. **新字段计算**:
   - `main`: 无 `recommendedDayIndex` 和 `missingDays`
   - `plan-execution`: 
     - `recommendedDayIndex`: 基于最大已解决训练日计算
     - `missingDays`: 推荐指针之前未解决的训练日
     - `resolvedDays`: 已解决（完成或放弃）的训练日列表

3. **响应数据**:
   - `main`: 包含 `nextDayIndex`
   - `plan-execution`: 包含 `nextDayIndex`、`recommendedDayIndex`、`missingDays`、`resolvedDays`

**解决方案**:
- ✅ **合并两者**
- 原因：性能日志是 `main` 的优化，新字段是 `plan-execution` 的核心功能
- 步骤：
  1. 保留 `main` 的性能日志代码
  2. 添加 `plan-execution` 的 `recommendedDayIndex` 计算逻辑
  3. 添加 `plan-execution` 的 `missingDays` 计算逻辑
  4. 添加 `plan-execution` 的 `resolvedDays` 计算逻辑
  5. 在响应中包含所有字段（向后兼容）

---

### 5. `src/app/today-training/page.tsx`

**冲突类型**: 内容冲突（最复杂）

**冲突原因**:
- `main` 分支：可能有不同的 UI 逻辑或数据加载方式
- `plan-execution` 分支：实现了完整的日历日计算、missingDays 提示等功能

**关键差异**:
1. **日历日计算** (`calendarDayIndex`):
   - `main`: 可能使用简单的计算方式
   - `plan-execution`: 基于完成日期的自然天数计算，包含完整的 fallback 逻辑

2. **数据加载**:
   - `main`: 可能使用不同的 API 或数据格式
   - `plan-execution`: 使用 `getTodayTrainingInstance` API，期望返回 `recommendedDayIndex` 和 `missingDays`

3. **UI 功能**:
   - `main`: 基础功能
   - `plan-execution`: 
     - MissingDays 警告提示
     - 日历日显示逻辑
     - 完成状态显示

4. **状态管理**:
   - `main`: 可能不同的状态变量
   - `plan-execution`: 包含 `missingDays`、`executionsByDayIndex` 等状态

**解决方案**:
- ✅ **严格采用 plan-execution 的方案**
- 原因：这是 `plan-execution` 分支的核心功能，必须保持一致性
- 步骤：
  1. 保留 `plan-execution` 的完整 `calendarDayIndex` 计算逻辑
  2. 保留 `plan-execution` 的数据加载逻辑（`getTodayTrainingInstance`）
  3. 保留 `plan-execution` 的 MissingDays 提示功能
  4. 保留 `plan-execution` 的所有状态管理
  5. **重要**: 确保 `get-today-training-instance` API 返回 `recommendedDayIndex` 和 `missingDays`

**特别注意**:
- 如果 `get-today-training-instance` API 没有返回 `recommendedDayIndex`，需要先修复该 API（参考冲突文件 4 的解决方案）

---

### 6. `tsconfig.tsbuildinfo`

**冲突类型**: 二进制文件冲突

**冲突原因**:
- TypeScript 编译缓存文件，两个分支的编译结果不同

**解决方案**:
- ✅ **采用 plan-execution 的版本**
- 原因：这是编译缓存文件，应该使用最新合并后的版本
- 步骤：
  1. 直接使用 `plan-execution` 的版本
  2. 或者删除该文件，让 TypeScript 重新生成

---

## 合并策略总结

### 总体原则

1. **功能优先**: `plan-execution` 分支包含新功能，优先保留
2. **架构统一**: 统一使用外部模块（如 `updateEstimatedEndDateForInstance`）
3. **向后兼容**: 保留 `main` 分支的性能优化和现有功能
4. **严格遵循**: `today-training` 页面必须严格按照 `plan-execution` 的逻辑

### 合并顺序建议

1. **第一步**: 修复 `get-instance` API（添加新字段，保留性能日志）
2. **第二步**: 修复 `get-today-training-instance` API（确保返回新字段）
3. **第三步**: 修复执行相关的 API（统一使用外部模块）
4. **第四步**: 修复 `today-training` 页面（严格采用 plan-execution 逻辑）
5. **第五步**: 处理编译缓存文件

### 关键依赖关系

```
get-instance API (新字段)
    ↓
get-today-training-instance API (返回新字段)
    ↓
today-training 页面 (使用新字段)
```

**重要**: 必须按照依赖顺序修复，否则会导致数据不一致。

---

## 验证检查清单

合并完成后，需要验证：

- [ ] `get-instance` API 返回 `recommendedDayIndex` 和 `missingDays`
- [ ] `get-today-training-instance` API 返回 `recommendedDayIndex` 和 `missingDays`
- [ ] `today-training` 页面正确显示训练日（不是第1天）
- [ ] 执行进度计算正常工作
- [ ] e1RM 自动计算正常工作
- [ ] 预计完成日期更新正常工作
- [ ] MissingDays 提示正确显示
- [ ] 日历日计算正确（基于完成日期）

---

## 参考文档

- `documents/business-logic-b1-subscription-plan-execution.md` - 业务逻辑说明
- `documents/training-execution-self-consistent-spec-v1.md` - 训练执行规范
- `documents/bugfix-notes-2026-01-20.md` - Bug 修复记录

---

## 注意事项

1. **不要混合使用**: 不要尝试混合两个分支的逻辑，会导致不一致
2. **完整测试**: 合并后必须完整测试所有功能
3. **数据一致性**: 确保 API 返回的数据格式与前端期望一致
4. **回滚准备**: 如果合并失败，可以随时回滚到合并前状态

---

**文档版本**: v1.0  
**最后更新**: 2026-01-22
