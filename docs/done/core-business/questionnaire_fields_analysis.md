# 问卷字段分析：is_active、status、is_default

## 字段关系图

```
is_active (boolean)          ← 历史遗留字段
    ↕ 同步关系
status (text: 'active'|'archived')  ← 新字段，更灵活

is_default (boolean)         ← 数据库层面标记
    ↕ 可能不同步
coaches.profile.default_questionnaire_id  ← 业务层面引用
```

## 详细分析

### 1. `is_active` vs `status` - **存在重复**

| 字段 | 类型 | 用途 | 问题 |
|------|------|------|------|
| `is_active` | boolean | 标记"是否已发布/上线" | 历史遗留，与 `status` 功能重复 |
| `status` | text | 标记问卷状态（'active'/'archived'） | 新字段，更灵活（未来可扩展为 'draft'/'published' 等） |

**当前关系**：
- `is_active=true` ↔ `status='active'`
- `is_active=false` ↔ `status='archived'`

**问题**：
- 两个字段表达同一概念，需要同步维护
- 代码中需要同时检查两个字段（向后兼容）
- 容易产生数据不一致

**建议**：
- **短期**：保持同步（当前做法）
- **长期**：逐步废弃 `is_active`，统一使用 `status`

---

### 2. `is_default` vs `coaches.profile.default_questionnaire_id` - **存在重复**

| 字段 | 位置 | 用途 | 问题 |
|------|------|------|------|
| `is_default` | `coach_questionnaires.is_default` | 数据库层面标记"默认问卷" | 与 `default_questionnaire_id` 功能重复 |
| `default_questionnaire_id` | `coaches.profile.default_questionnaire_id` | 业务层面引用"默认问卷ID" | 存储在 JSON 中，查询效率低 |

**当前关系**：
- `is_default=true` 的问卷不一定是 `coaches.profile.default_questionnaire_id` 指向的问卷
- 两者可能不同步！

**问题**：
- 两个字段表达同一概念，但存储位置不同
- `is_default` 有唯一索引约束（每个教练只能有一个 `is_default=true`）
- `default_questionnaire_id` 存储在 JSON 中，查询效率低
- 两者可能不一致，导致混乱

**建议**：
- **方案A（推荐）**：统一使用 `is_default`，删除 `coaches.profile.default_questionnaire_id`
  - 优点：数据库层面约束，查询效率高，数据一致性强
  - 缺点：需要更新 `set-default-questionnaire` API
- **方案B**：统一使用 `coaches.profile.default_questionnaire_id`，删除 `is_default`
  - 优点：保持现有业务逻辑
  - 缺点：JSON 查询效率低，无法用数据库约束保证唯一性

---

## 总结

### 重复情况

1. ✅ **`is_active` 和 `status`** - 功能重复，但 `status` 更灵活
2. ✅ **`is_default` 和 `default_questionnaire_id`** - 功能重复，且可能不同步

### 建议的简化方案

#### 方案1：保留新字段，逐步废弃旧字段

```sql
-- 1. 统一使用 status，废弃 is_active
-- 2. 统一使用 is_default，废弃 coaches.profile.default_questionnaire_id
```

**优点**：
- 数据库层面约束更强
- 查询效率更高
- 数据一致性更好

**缺点**：
- 需要更新所有相关代码
- 需要数据迁移

#### 方案2：保持现状，但加强同步

```typescript
// 所有写操作都同步更新
update({
  status: 'active',
  is_active: true,  // 同步
  is_default: true
})

// 同时更新 coaches.profile.default_questionnaire_id
```

**优点**：
- 向后兼容
- 不需要大规模重构

**缺点**：
- 需要维护多个字段的同步
- 容易出错

---

## 当前代码状态

- ✅ `list-questionnaires`: 查询 `status` 和 `is_default`，但兼容 `is_active`
- ✅ `get-questionnaires`: 查询时优先用 `status`，兼容 `is_active`
- ✅ `update-questionnaires`: 同步 `status` 和 `is_active`
- ✅ `publish-questionnaire`: 同步 `status` 和 `is_active`
- ⚠️ `set-default-questionnaire`: 只更新 `coaches.profile.default_questionnaire_id`，**没有同步 `is_default`**！

**问题**：`set-default-questionnaire` 没有同步 `is_default`，导致两者可能不一致。
