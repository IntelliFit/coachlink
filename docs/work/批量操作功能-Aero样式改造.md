# 批量操作功能 - Aero 样式改造

## 改造概述

仿照 `/streetlifting-index` 的 UI 样式，将智能批量操作对话框改造为符合「轻盈生产力 (Aero-Productivity)」设计规范的现代化界面。

## 改造日期

- **初版**：2026-02-04
- **更新**：2026-02-04（取消透明背景，优化说明文字，强化品牌）

---

## 🎨 最新改动（2026-02-04 更新）

### 1. **对话框背景改为不透明**

**变更原因**：提升可读性，避免背景内容干扰

#### 样式对比

| 项目 | 旧版（毛玻璃） | 新版（纯色） |
|------|---------------|-------------|
| 背景色 | `rgba(255, 255, 255, 0.92)` | `#ffffff` |
| 毛玻璃 | `backdrop-filter: blur(18px)` | 无 |
| 深色模式 | `rgba(15, 23, 42, 0.9)` | `#0f172a` |
| CSS 类 | `.aero-dialog` | `.batch-operation-dialog` |

#### CSS 实现 (`globals.css`)

```css
/* 新增：批量操作对话框 - 不透明版本 */
.batch-operation-dialog.p-dialog {
    background: #ffffff !important;
    border: 1px solid rgba(15, 23, 42, 0.08) !important;
    border-radius: 24px !important;
    box-shadow:
        0 10px 25px rgba(15, 23, 42, 0.08),
        0 24px 60px rgba(15, 23, 42, 0.12) !important;
    overflow: hidden;
}

.dark .batch-operation-dialog.p-dialog {
    background: #0f172a !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
}
```

### 2. **标题强化品牌标识**

**变更原因**：强调"教链"品牌，提升品牌认知度

#### 实现代码

```tsx
header={
    <div className="flex items-center gap-2">
        <span>智能批量操作</span>
        <span className="text-xs font-black tracking-wider text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
            教链
        </span>
    </div>
}
```

#### 设计特点

- 🏷️ **品牌徽章**：圆角胶囊样式 `rounded-full`
- 🎨 **主题色高亮**：`text-primary-600` + `bg-primary-50`
- 💪 **粗体字重**：`font-black` 增强视觉冲击
- 📏 **字间距加宽**：`tracking-wider` 提升识别度
- 📐 **尺寸控制**：`text-xs` 不抢主标题风头

### 3. **说明文字改为 ChatGPT 风格**

**变更原因**：去除冗余视觉元素，聚焦核心信息

#### 设计对比

<table>
<tr>
<th>旧版（卡片式）</th>
<th>新版（边框式）</th>
</tr>
<tr>
<td>

```tsx
<Card className="rounded-2xl border 
  border-primary-100 bg-primary-50/30">
  <div className="p-4 flex items-start gap-3">
    <div className="shrink-0 w-8 h-8 
      rounded-xl bg-primary-100 
      text-primary-700 flex items-center 
      justify-center">
      <i className="pi pi-info-circle"></i>
    </div>
    <div className="min-w-0 text-sm">
      <div className="font-bold mb-1">
        智能识别与预览
      </div>
      <div className="text-surface-600">
        使用自然语言描述批量操作...
      </div>
    </div>
  </div>
</Card>
```

</td>
<td>

```tsx
<div className="text-sm text-surface-600 
  leading-relaxed border-l-2 
  border-primary-500 pl-4 py-1">
  使用自然语言描述批量操作，
  系统会自动识别并预览修改内容，
  确认后再应用到训练计划
</div>
```

</td>
</tr>
</table>

#### 新版特点

✅ **极简设计**
- 无背景色
- 无图标
- 无标题层级

✅ **视觉引导**
- 左侧 2px 主题色边框 `border-l-2 border-primary-500`
- 左内边距 `pl-4` 拉开距离

✅ **排版优化**
- 灰色文字 `text-surface-600` 低调不抢眼
- 宽松行高 `leading-relaxed` 提升可读性
- 小字号 `text-sm` 作为辅助信息

✅ **符合规范**
- 遵循 ChatGPT 的简洁信息提示风格
- 符合 Aero-Productivity "呼吸感边界"原则
- 实现"色彩克制"，仅用边框点缀

---

## 📋 主要改动（初版）

### 1. 对话框整体样式 (`BatchOperationDialog.tsx`)

#### 标题更新
- ❌ 旧: "AI 批量操作"
- ✅ 新: "智能批量操作"（遵循 ui-spec.md 禁止使用 "AI" 字眼的原则）

#### 对话框样式
- 应用 `aero-dialog` 类名
- 支持毛玻璃效果、大圆角（24px）、精致投影
- 响应式设计，移动端自适应

### 2. 说明提示区域

#### 旧设计
```tsx
<Message
    severity="info"
    text="使用自然语言描述批量操作，AI 会分析并预览修改内容，确认后再应用到训练计划"
/>
```

#### 新设计
```tsx
<Card className="rounded-2xl border border-primary-100 bg-primary-50/30">
    <div className="p-4 flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
            <i className="pi pi-info-circle text-sm"></i>
        </div>
        <div className="min-w-0 text-sm text-surface-700">
            <div className="font-bold mb-1">智能识别与预览</div>
            <div className="text-surface-600 leading-relaxed">
                使用自然语言描述批量操作，系统会自动识别并预览修改内容，确认后再应用到训练计划
            </div>
        </div>
    </div>
</Card>
```

**改进点：**
- 采用 Card 组件替代 Message 组件
- 使用 rounded-2xl 大圆角
- 添加图标容器，带有圆角背景
- 层次化的文本结构（标题 + 描述）
- 低饱和度配色（primary-50/30 背景）

### 3. 指令输入区域

#### 样式改进
- Label: `font-bold` 替代 `font-medium`
- Input: `rounded-2xl` 大圆角
- 边框: `border-surface-200` 极浅灰色
- 焦点: `focus:border-primary-300` 主题色高亮

### 4. 日志显示区域

#### 旧设计
```tsx
<div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
```

#### 新设计
```tsx
<Card className="rounded-2xl border border-surface-100 bg-surface-50">
    <div className="p-4 max-h-64 overflow-y-auto">
```

**改进点：**
- 使用 Card 组件增强层次感
- rounded-2xl 大圆角
- surface-* 色系替代固定的 gray-*
- 支持主题系统自动切换

#### 日志颜色系统优化

| 日志类型 | 旧颜色 | 新颜色 | 说明 |
|---------|--------|--------|------|
| progress | text-blue-600 | text-surface-700 | 中性色，不抢眼 |
| action_plan | text-indigo-700 | text-surface-900 font-bold | 加粗强调 |
| modification | text-orange-600 | text-primary-700 font-semibold | 主题色点缀 |
| stats | text-gray-500 | text-surface-500 | 统一中性色 |
| success | text-green-700 | text-green-700 font-bold | 保持绿色，加粗 |
| error | text-red-600 | text-red-600 font-semibold | 保持红色，加粗 |

### 5. 修改预览区域

#### 标题部分改进
```tsx
<div className="flex items-center gap-2">
    <div className="w-8 h-8 rounded-xl bg-surface-100 text-surface-700 flex items-center justify-center">
        <i className="pi pi-list text-sm"></i>
    </div>
    <div>
        <h3 className="text-sm font-bold text-surface-900">修改预览</h3>
        <p className="text-xs text-surface-500">
            共识别到 {previewData.modifications.length} 处修改
        </p>
    </div>
</div>
```

**改进点：**
- 添加图标容器（圆角背景 + 列表图标）
- 层次化标题结构
- 移除 Emoji，使用图标

#### DataTable 样式改进
- 添加 `aero-datatable` 类名
- 表格头部：bg-surface-50、小写字母、加粗、tracking-wide
- 行 hover 效果：bg-surface-50/50
- 单元格内容自定义渲染：
  - 训练日：font-bold
  - 动作名：font-semibold
  - 修改项：text-xs
  - 旧值：line-through + text-xs（删除线）
  - 新值：text-primary-700 + font-bold（主题色高亮）

### 6. 操作按钮

#### 按钮样式统一
所有按钮都应用了：
- `rounded-2xl` 大圆角
- `active:scale-[0.98]` 物理按压缩放
- `transition-all` 平滑过渡

#### 具体按钮样式

**重新分析按钮**
```tsx
className="rounded-2xl text-surface-600 hover:text-surface-900 hover:bg-surface-50 active:scale-[0.98] transition-all"
```

**取消按钮**
```tsx
className="rounded-2xl px-5 text-surface-700 hover:bg-surface-50 active:scale-[0.98] transition-all"
```

**开始分析按钮**
```tsx
className="rounded-2xl px-5 bg-surface-900 border-none text-surface-0 font-bold hover:bg-surface-800 active:scale-[0.98] transition-all shadow-sm"
```

**确认应用按钮**
```tsx
className="rounded-2xl px-5 bg-primary-600 border-none text-white font-bold hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm shadow-primary-200"
```

**按钮层次：**
1. 主要操作（开始分析、确认应用）：实心、粗体、带阴影
2. 次要操作（取消、重新分析）：文本按钮、悬停背景

### 7. 全局样式文件 (`globals.css`)

#### 新增 Aero DataTable 样式
```css
/* Aero DataTable Styles */
.aero-datatable .p-datatable-thead > tr > th {
    @apply bg-surface-50 text-surface-700 text-xs font-bold uppercase tracking-wide;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08) !important;
    padding: 12px 16px !important;
}

.aero-datatable .p-datatable-tbody > tr {
    @apply transition-colors;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06) !important;
}

.aero-datatable .p-datatable-tbody > tr:hover {
    @apply bg-surface-50/50;
}

.aero-datatable .p-datatable-tbody > tr > td {
    @apply text-surface-800;
    padding: 14px 16px !important;
    border: none !important;
}

/* Dark mode support */
.dark .aero-datatable .p-datatable-thead > tr > th {
    @apply bg-surface-800 text-surface-300;
    border-bottom-color: rgba(255, 255, 255, 0.08) !important;
}

.dark .aero-datatable .p-datatable-tbody > tr {
    border-bottom-color: rgba(255, 255, 255, 0.06) !important;
}

.dark .aero-datatable .p-datatable-tbody > tr:hover {
    @apply bg-surface-800/50;
}

.dark .aero-datatable .p-datatable-tbody > tr > td {
    @apply text-surface-200;
}
```

## 设计规范遵循

### ✅ 已遵循的规范

1. **连续曲率大圆角**
   - 全局使用 `rounded-2xl` (16px) 和 `rounded-3xl` (24px)
   - 对话框、卡片、按钮、输入框均采用大圆角

2. **呼吸感边界**
   - 使用 1px 极浅灰色边框 (`border-surface-100`)
   - 避免深色分割线
   - 基于 surface-* 变量实现主题自动切换

3. **物理光影逻辑**
   - 静态状态：平面化或极微弱投影
   - hover 状态：阴影向下扩散（Card 组件自带）
   - 按钮：`shadow-sm` 微弱投影

4. **色彩哲学：点睛之笔**
   - 主题色克制：仅在确认应用按钮使用 primary-600
   - 中性色底座：90% 区域使用 surface-* 系列
   - 低饱和提示音：信息提示使用 primary-50/30 低饱和度背景

5. **智能交互反馈**
   - 物理按压缩放：所有按钮 `active:scale-[0.98]`
   - 禁止特定术语：移除 "AI" 字眼，改为"智能识别"

6. **排版与内容权重**
   - 紧凑型字间距：标题使用 `font-bold` 和 `tracking-tight`
   - 数据中心化：关键数值加粗、放大字号
   - 辅助文字降低字号和颜色深度

### 📋 待进一步优化

1. **加载同步哲学**
   - 当前使用 PrimeReact 的 loading spinner
   - 未来可考虑使用 Skeleton 骨架屏占位

2. **紧凑型字间距**
   - 可对标题添加 `tracking-tight` (-0.025em)

## 效果对比

### 旧版本
- 传统 PrimeReact 默认样式
- 小圆角 (8px)
- 固定颜色值 (gray-200, blue-600)
- 简单的按钮样式
- 使用 "AI" 字眼

### 新版本
- Aero-Productivity 设计风格
- 大圆角 (16px/24px)
- 主题系统色彩 (surface-*)
- 物理交互反馈
- 层次化信息架构
- 中性色为主，主题色点缀
- 使用"智能"替代"AI"

## 相关文件

- `src/components/BatchOperationDialog.tsx` - 主组件
- `src/assets/globals.css` - 全局样式
- `docs/done/product/ui-spec.md` - 设计规范
- `src/components/streetlifting-index/aero.ts` - Aero 样式常量

## 测试建议

1. **视觉测试**
   - 检查对话框打开动画
   - 验证大圆角显示正常
   - 测试 hover 和 active 状态

2. **功能测试**
   - 输入指令并分析
   - 查看日志输出样式
   - 预览修改表格
   - 确认应用修改

3. **响应式测试**
   - 测试移动端对话框大小
   - 验证表格滚动
   - 检查按钮布局

4. **主题测试**
   - 切换深色模式
   - 验证所有 surface-* 颜色自动切换
   - 检查对比度

## 总结

本次改造成功将批量操作对话框从传统 UI 升级为符合 Aero-Productivity 设计规范的现代化界面，显著提升了视觉一致性和用户体验。所有改动都遵循了 `ui-spec.md` 的指导原则，并与 `streetlifting-index` 模块保持了风格统一。
