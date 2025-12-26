为了确保 UI 在开发过程中保持一致性，并能完美适配不同的屏幕尺寸，我为你整理了一份关于**“紧凑型聚合定价卡片”**的视觉与交互规范（Spec）。

---

## 订阅卡片 UI 设计规范 (Technical Spec)

### 1. 布局结构 (Layout Hierarchy)

* **容器 (Card)**: 采用垂直 Flex 布局 (`flex-col`)，确保内容区自动填充，操作区（价格方块）始终固定在底部。
* **价格组 (Pricing Grid)**: 使用 `grid-cols-3` 均匀分布。如果选项少于 3 个，依然保持等宽对齐。

### 2. 视觉规格 (Visual Metrics)

| 元素 | 规格说明 | Tailwind 类参考 |
| --- | --- | --- |
| **外层卡片** | 2xl 圆角，1px 浅灰边框，白色背景 | `rounded-2xl`, `border-surface-200` |
| **标题文字** | 18px / Bold / 紧凑字间距 | `text-lg font-bold tracking-tight` |
| **描述文字** | 12px / 灰度 500 / 最多显示 2 行 | `text-xs text-surface-500 line-clamp-2` |
| **价格方块** | xl 圆角，背景色 Surface 50/50 | `rounded-xl`, `bg-surface-50/50` |
| **价格数值** | 14px / Black (900) / 货币符号缩小 | `text-sm font-black` |

---

### 3. 状态与交互 (States & Interactivity)

#### **A. 悬停态 (Hover State)**

* **卡片整体**: 边框变更为 `primary-400`，并伴随柔和阴影 (`shadow-lg`)。
* **价格方块**:
* 背景切换为 `primary-50`。
* 边框切换为 `primary-300`。
* 内部文字颜色加深，体现可点击感。



#### **B. 推荐标识 (Recommendation Badge)**

* **位置**: 位于方块右上角（Absolute Positioning）。
* **动效**: 包含一个 `animate-ping` 的光圈，起到视觉引导作用，减少用户决策时间。

#### **C. 禁用态 (Disabled State)**

* 当 `subscribing` 为 true 时，方块透明度降至 50%，指针事件失效 (`pointer-events-none`)。

---

### 4. 响应式策略 (Responsive Strategy)

为了保证在不同设备上的可用性，建议遵循以下断点逻辑：

* **Desktop (≥ 1024px)**: 保持 `grid-cols-3` 布局，追求紧凑感。
* **Tablet (768px - 1023px)**: 若侧边栏占用空间较大，可动态调整卡片容器为 `grid-cols-2`。
* **Mobile (< 768px)**:
* **方案 A (保持方块)**: 减小内边距，文字缩小至 10px，维持横向三格。
* **方案 B (回退)**: 若价格位数过长（如 ¥10,000+），则回退到纵向长条列表。



---

### 5. 核心代码逻辑实现

```tsx
// 关键样式逻辑抽象
const STYLES = {
    card: "group/card bg-white border border-surface-200 rounded-2xl p-5 hover:border-primary-400 hover:shadow-xl transition-all duration-300",
    priceBlock: "flex flex-col items-center justify-center p-2 rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-primary-50 hover:border-primary-300 transition-all",
    badge: "absolute -top-2 -right-1 flex h-4 w-4",
};

// 价格单位格式化建议
const formatPrice = (price: number) => (
    <div className="flex items-baseline gap-0.5">
        <span className="text-[10px] font-medium text-surface-400">¥</span>
        <span className="text-sm font-black text-surface-800">{price}</span>
    </div>
);

```

---

### 下一步建议

这种紧凑布局在“对比”时非常有效。**您是否希望我在该组件中加入一个“节省金额”的标签（例如：相比单月订阅节省 20%），以进一步刺激用户转化？**