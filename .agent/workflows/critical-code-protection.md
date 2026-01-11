---
description: 记录关键代码逻辑，防止被 AI 误改
---

# 🛡️ 关键代码保护清单

本文档记录了项目中容易被 AI
误改的关键代码逻辑。在进行代码修改时，**必须保留以下逻辑**。

---

## 1. 力量进步曲线 (E1RM Progress Chart)

### 关键文件

| 文件路径                                               | 关键逻辑                                        |
| ------------------------------------------------------ | ----------------------------------------------- |
| `src/app/service/e1rmService.ts`                       | 必须包含 `getHistory()` 方法                    |
| `src/app/api/student/get-available-actions/route.ts`   | 必须包含 `source_coach_id` 过滤和 fallback 逻辑 |
| `src/components/student/profile/E1RMProgressChart.tsx` | 必须接受 `coachId` 参数                         |

### 必须保留的逻辑

#### e1rmService.ts

```typescript
// ⚠️ 不要删除这个方法！组件依赖它
async getHistory(params: GetE1RMHistoryDto): Promise<GetE1RMHistoryResponseDto | null> {
    return studentService.getE1RMHistory(params);
}
```

#### get-available-actions/route.ts

```typescript
// ⚠️ 关键：必须支持 coachId 过滤 + fallback
// 1. 从请求体获取 coachId
const { coachId } = body;

// 2. 如果有 coachId，按 source_coach_id 过滤
if (coachId) {
    queryBuilder = queryBuilder.eq("source_coach_id", coachId);
}

// 3. ⚠️ FALLBACK 逻辑 - 处理旧数据没有 source_coach_id 的情况
if (!prError && (!prActions || prActions.length === 0) && coachId) {
    // 退化查询：不按 coach 过滤
}
```

### 调用关系

```
StudentDetailDialog / StudentProfilePage
    ↓ 传入 studentId + coachId
E1RMProgressChart
    ↓ 调用 API
get-available-actions (获取动作列表)
    ↓ 返回动作
e1rmService.getHistory() → get-e1rm-history (获取历史数据)
```

---

## 2. 学员详情对话框 ID 传递

### 必须使用正确的 ID

| 位置                      | 正确用法                         | 错误用法                    |
| ------------------------- | -------------------------------- | --------------------------- |
| `StudentDetailDialog.tsx` | `student.student_id` (用户ID)    | ❌ `student.id` (订阅ID)    |
| `E1RMProgressChart` props | `studentId={student.student_id}` | ❌ `studentId={student.id}` |

---

## 3. 学员个人资料头像上传功能

### 关键文件

| 文件路径                                                 | 关键逻辑                                               |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `src/components/student/profile/PersonalInfoSection.tsx` | 必须包含完整的头像上传 UI 和 `handleUploadAvatar` 函数 |

### 必须保留的逻辑

#### PersonalInfoSection.tsx - 头像上传函数

```typescript
// ⚠️ 不要删除这个函数！头像上传功能依赖它
const handleUploadAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload/avatar", {
            method: "POST",
            body: form,
        });
        const data = await res.json();
        if (data?.success && data?.data?.url) {
            setFormData({ ...formData, avatar_url: data.data.url });
            showToast({
                severity: "success",
                summary: "上传成功",
                detail: "头像已更新",
            });
        } else {
            showToast({
                severity: "error",
                summary: "上传失败",
                detail: data?.message || "请稍后再试",
            });
        }
    } catch (err) {
        showToast({
            severity: "error",
            summary: "上传失败",
            detail: "网络异常",
        });
    } finally {
        setUploading(false);
    }
};
```

#### PersonalInfoSection.tsx - 头像上传 UI

```tsx
// ⚠️ 头像编辑区域必须包含以下完整 UI：
// 1. URL 输入框
// 2. 头像预览
// 3. "选择本地图片" 按钮 (调用 handleUploadAvatar)
// 4. "清空" 按钮
// 5. 上传中状态提示
// 6. 文件格式提示

<div className="flex flex-col gap-2">
    <label>头像</label>
    <div className="flex items-center gap-3">
        <InputText placeholder="粘贴图片URL" />
        {/* 头像预览 */}
    </div>
    <div className="flex items-center gap-2">
        <label>
            <input type="file" accept="image/*" onChange={...handleUploadAvatar} />
            选择本地图片
        </label>
        <Button label="清空" />
        {uploading && <span>上传中...</span>}
    </div>
    <p>支持 PNG/JPG/WEBP，≤2MB。</p>
</div>
```

### 易错场景

- **重写整个组件时**：容易只保留 URL 输入框，遗漏本地上传按钮
- **简化 UI 时**：容易删除"选择本地图片"按钮
- **删除 `uploading` 状态**：会导致上传时无反馈

---

## 4. 添加新条目指南

当发现新的易被误改逻辑时：

1. 在本文件添加新章节
2. 说明关键文件和必须保留的逻辑
3. 提供代码片段示例
4. 说明调用关系

---

## 5. 新用户档案(Onboarding Modal) + 顶部昵称/引导系统的联动保护

### 背景问题（曾经出现过）

- **填完“完善档案/注册问卷”后弹窗无法关闭**：用户点击关闭/完成后，弹窗仍会被立刻再次拉起。
- **提交后昵称不刷新**：页面右上角仍显示默认“学员”，头像字母显示
  `U`，但个人档案页下方已显示正确昵称。
- **提交后路由闪烁**：曾出现“瞬间跳到注册页又回到今日训练”的错觉。
- **引导干扰填写问卷**：Onboarding 弹窗打开时，driver.js 引导仍会弹出遮挡输入。

### 关键文件

| 文件路径                                                   | 关键逻辑                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/components/NavigationStudent.tsx`                     | 自动弹出 Onboarding 的触发条件；右上角昵称/头像字母完全依赖 `session.profile`   |
| `src/components/auth/OnboardingModal.tsx`                  | 提交档案后必须刷新 NextAuth session，并避免不必要的 `router.refresh()` 造成闪烁 |
| `src/components/auth/OnboardingModalContext.tsx`           | 必须支持“抑制自动弹窗直到 session 真正完成”的 suppress 机制                     |
| `src/components/guide/GuideManager.tsx`                    | Onboarding 打开时必须暂停/关闭引导；避免在 `/today-training` 触发执行引导       |
| `src/stores/useGuideStore.tsx` + `src/lib/guide-driver.ts` | 必须能强制关闭当前 driver.js 实例（stopActiveGuide）                            |

### 必须保留的逻辑（不要误删/简化）

#### 5.1 NavigationStudent：自动弹窗依赖 session.profile

```typescript
// ⚠️ 关键：自动弹出 Onboarding 只看 session.profile.onboarding_completed
// session 不会因为 profile 更新而自动刷新，所以需要 suppress 机制兜底
if (profile?.onboarding_completed === true) {
    clearOnboardingSuppression();
    return;
}
if (profile?.onboarding_completed !== true) {
    openOnboardingModal();
}
```

#### 5.2 OnboardingModal：提交成功后必须 updateSession()

```typescript
// ⚠️ 关键：提交成功后必须主动刷新 NextAuth session
// 否则顶部昵称/头像与 onboarding_completed 会长时间停留在旧值
await updateSession();

// ⚠️ 避免 router.refresh() 导致的路由/页面闪烁
if (pathname !== "/today-training") {
    router.replace("/today-training");
}
```

#### 5.3 OnboardingModalContext：suppress 必须“持续有效直到清除”

```typescript
// ⚠️ 关键：不能只 suppress 一次
// 要持续 suppress，直到 session.profile.onboarding_completed 真的变为 true 才 clear
const [suppressedUntilCleared, setSuppressedUntilCleared] = useState(false);
```

#### 5.4 GuideManager：Onboarding 打开时必须停掉 guide

```typescript
// ⚠️ 关键：问卷弹窗打开时，必须 stopActiveGuide()，避免遮挡输入
if (shouldPauseGuides && isGuideActive) {
    stopActiveGuide();
}
```

#### 5.5 引导触发位置：避免在 /today-training 触发 EXECUTION_GUIDE

```typescript
// ⚠️ 关键：EXECUTION_GUIDE 只应在真正执行页触发
if (pathname.includes("/training-execution")) {
    startGuide("EXECUTION_GUIDE");
}
```

### 调用关系

```
OnboardingModal(提交 updateProfile)
    ↓ (必须) updateSession() 刷新 session.profile
NavigationStudent(读取 session.profile)
    ↓ 决定是否自动 openOnboardingModal + 显示昵称/头像字母
GuideManager(读取 session.profile + Onboarding 打开状态)
    ↓ 决定是否触发/停止 driver.js 引导
```

---

_最后更新: 2026-01-12_

---

## 6. 计划导入进度回填逻辑 (Plan Progress Backfill)

### 背景问题（曾经出现过）

- **导入过去开始的计划显示 0% 进度**：选择"从第8周第1天开始"，但进度显示 0/44
- **进度计算错误 (102/44)**：因计算逻辑混淆导致完成数超过总数
- **回填失败但无报错**：因字段名错误导致数据库插入失败

### 关键文件

| 文件路径                                                                    | 关键逻辑                            |
| --------------------------------------------------------------------------- | ----------------------------------- |
| `src/app/api/plan-lib/create-instance/route.ts`                             | 创建计划实例后回填过去的执行记录    |
| `src/app/dashboard/students/plan/[id]/page.tsx`                             | 计算 `customStartDate` 并传递给 API |
| `src/app/dashboard/students/plan/[id]/components/PlanStartConfigDialog.tsx` | 用户选择起始周/天                   |

### 必须保留的逻辑（不要误删/简化）

#### 6.1 create-instance/route.ts：回填执行记录

```typescript
// ⚠️ 关键数据结构理解：
// - training_days 数组包含所有日历日（包括休息日），length 约 105（15周×7天）
// - dayIndex 是日历日索引（1-105），不是训练日序号（1-44）
// - 需要过滤出 type === 'training' 的天才是真正的训练日

// ⚠️ 关键：日期偏移计算
// dayIndex 已经是日历日位置，offset 直接用 dayIndex - 1
const offset = dayIndex - 1; // ✅ 正确

// ❌ 错误写法（曾经导致 9/44 而不是 21/44）：
// const offset = Math.floor((dayIndex - 1) * daysPerTrainingDay);

// ⚠️ 关键：plan_instance_executions 表字段
// 该表没有 coach_id 字段！插入时不要包含 coach_id
pastExecutions.push({
    instance_id: instance.id,
    student_id: instance.student_id,
    // ❌ coach_id: instance.coach_id, // 不存在此字段，会导致插入失败
    day_index: dayIndex,
    status: "completed",
    started_at: dDate.toISOString(),
    completed_at: dDate.toISOString(),
    action_executions: [], // 必需字段
});
```

#### 6.2 page.tsx：传递 startDate

```typescript
// ⚠️ 关键：customStartDate 必须正确传递到 API
const res = await planLibService.createInstance({
    // ... 其他字段
    startDate: customStartDate ? customStartDate.toISOString() : undefined,
});
```

#### 6.3 handleConfirmPlanStart：计算回推日期

```typescript
// ⚠️ 关键：根据用户选择回推开始日期
const daysToSubtract = (config.startWeek - 1) * 7 + (config.startDay - 1);
if (daysToSubtract > 0) {
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToSubtract);
    setCustomStartDate(startDate);
}
```

### 数据结构对照表

| 字段/概念                            | 含义                   | 示例值            |
| ------------------------------------ | ---------------------- | ----------------- |
| `trainingDays.length`                | 日历日总数（含休息日） | 105 (15周×7天)    |
| `trainingOnlyDays.length`            | 训练日总数             | 44 (约每周3天)    |
| `dayIndex`                           | 日历日索引             | 1, 3, 5, 8, 10... |
| `plan_instance_executions.day_index` | 对应的训练日日历索引   | 与 dayIndex 相同  |

### 调用关系

```
PlanStartConfigDialog（用户选择第X周第Y天）
    ↓
handleConfirmPlanStart（计算 customStartDate = 今天 - 跳过的天数）
    ↓
handleSave → createInstance API（传递 startDate + trainingDays）
    ↓
create-instance/route.ts（回填 dayIndex <= 跳过天数 的训练日）
    ↓
plan_instance_executions 表（插入 "completed" 状态记录）
    ↓
list-students API（从 executions 表统计完成数）
```

### 易错场景

- **混淆 dayIndex 含义**：把 dayIndex 当训练日序号(1-44)而非日历日索引(1-105)
- **插入不存在的字段**：plan_instance_executions 表没有 coach_id
- **忘记过滤休息日**：必须 `filter(d => d.type === 'training' || !d.type)`
- **忘记传递 startDate**：前端 state 可能因刷新丢失

---

_最后更新: 2026-01-12_
