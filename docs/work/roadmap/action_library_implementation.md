# 动作库重构实现方案

> **关联设计文档**: [action_library_redesign.md](./action_library_redesign.md)\
> **预计工时**: 4-5 天

---

## 一、当前表结构

### coach_actions（教练动作库）

```sql
id uuid PRIMARY KEY
coach_id uuid NOT NULL
name text NOT NULL
detail text
positions text[]
attrs text[]
url text
"enableAutoWeightCompute" boolean DEFAULT false  -- ✅ 已有
"includesBodyWeight" boolean DEFAULT false       -- ✅ 已有
created_at / updated_at
```

### student_actions（学员动作库）

```sql
id uuid PRIMARY KEY
user_id uuid NOT NULL
name text NOT NULL
detail text
positions text[]
attrs text[]
url text
-- ⚠️ 缺少：enableAutoWeightCompute, includesBodyWeight
created_at / updated_at
```

---

## 二、数据库改动

### 2.1 新建公共动作库表

```sql
-- 文件：supabase/migrations/20260109_canonical_actions.sql

CREATE TABLE canonical_actions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canonical_actions_name ON canonical_actions USING GIN (to_tsvector('simple', name));
CREATE INDEX idx_canonical_actions_aliases ON canonical_actions USING GIN (aliases);
```

### 2.2 现有表新增字段

```sql
-- 文件：supabase/migrations/20260109_action_lib_upgrade.sql

-- 1. 教练动作库加公共关联
ALTER TABLE coach_actions 
ADD COLUMN canonical_action_id TEXT REFERENCES canonical_actions(id);

-- 2. 学员动作库加公共关联 + 补齐缺失字段
ALTER TABLE student_actions 
ADD COLUMN canonical_action_id TEXT REFERENCES canonical_actions(id);

ALTER TABLE student_actions 
ADD COLUMN "enableAutoWeightCompute" BOOLEAN DEFAULT false;

ALTER TABLE student_actions 
ADD COLUMN "includesBodyWeight" BOOLEAN DEFAULT false;

-- 3. PR 表加来源标记
ALTER TABLE personal_records_history 
ADD COLUMN source_type TEXT DEFAULT 'coach';

ALTER TABLE personal_records_history 
ADD COLUMN source_coach_id UUID REFERENCES coaches(id);

-- 索引
CREATE INDEX idx_coach_actions_canonical ON coach_actions(canonical_action_id);
CREATE INDEX idx_student_actions_canonical ON student_actions(canonical_action_id);
CREATE INDEX idx_prh_source ON personal_records_history(source_type, source_coach_id);
```

### 2.3 种子数据

```sql
INSERT INTO canonical_actions (id, name, aliases, category) VALUES
('squat_low_bar', '低杠深蹲', ARRAY['竞技深蹲', 'Low Bar Squat'], '下肢'),
('squat_high_bar', '高杠深蹲', ARRAY['健美深蹲', 'High Bar Squat'], '下肢'),
('bench_press', '卧推', ARRAY['平板卧推', 'Bench Press'], '推'),
('deadlift', '硬拉', ARRAY['传统硬拉', 'Deadlift'], '拉'),
('pullup_weighted', '负重引体', ARRAY['加重引体', 'Weighted Pull-up'], '拉');
```

---

## 三、新功能：学员自建计划自动重量计算

### 3.1 需求

学员导入/创建计划后：

1. 系统识别哪些动作 `enableAutoWeightCompute = true`
2. 在计划上方显示这些动作的 **1RM 输入区域**
3. 学员输入/修改 1RM 值后，计划中对应动作的重量**自动重新计算**

### 3.2 UI 示例

```
┌─────────────────────────────────────────────────┐
│ 📊 极限数据（用于自动计算训练重量）              │
├─────────────────────────────────────────────────┤
│  深蹲 1RM：[  120  ] kg    ← 可编辑             │
│  卧推 1RM：[   85  ] kg                         │
│  硬拉 1RM：[  140  ] kg                         │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 今日训练                                        │
├─────────────────────────────────────────────────┤
│  深蹲 5x5 @ 80% = 96kg  ← 自动计算              │
│  卧推 4x8 @ 70% = 60kg                          │
└─────────────────────────────────────────────────┘
```

### 3.3 实现要点

1. **计划创建/导入时**：扫描动作，筛选 `enableAutoWeightCompute = true`
2. **存储 1RM**：保存到 `student_plan_favorites.metadata` 或单独字段
3. **实时计算**：修改 1RM 时，前端即时更新计划预览中的重量

---

## 四、后端 API

| 路径                             | 方法 | 说明                           |
| -------------------------------- | ---- | ------------------------------ |
| `/api/canonical-actions/list`    | GET  | 公共动作列表                   |
| `/api/action-lib/link-canonical` | POST | 关联公共动作                   |
| `/api/student/available-actions` | GET  | 学员可用动作（教练+自己+公共） |

---

## 五、前端改动

### 5.1 教练端

- [ ] 动作编辑：增加"关联公共动作"选择器
- [ ] 动作列表：显示关联状态

### 5.2 学员端

- [ ] 动作编辑：增加 `enableAutoWeightCompute`、`includesBodyWeight` 开关
- [ ] 创建计划：可选教练动作
- [ ] 计划详情：显示 1RM 输入区 + 自动计算重量
- [ ] 进步曲线：按教练分组

---

## 六、类型更新

```typescript
// student.ts
export interface StudentActionRow {
    // ... 现有
    enableAutoWeightCompute?: boolean; // 新增
    includesBodyWeight?: boolean; // 新增
    canonical_action_id?: string | null;
}

// canonical.ts（新建）
export interface CanonicalAction {
    id: string;
    name: string;
    aliases: string[];
    category: string | null;
}
```

---

## 七、验证清单

- [ ] 迁移脚本执行成功
- [ ] 教练可关联/取消关联公共动作
- [ ] 学员动作支持 `enableAutoWeightCompute`
- [ ] 学员自建计划显示 1RM 输入区
- [ ] 修改 1RM 后计划重量自动更新
- [ ] 进步曲线按教练分组
