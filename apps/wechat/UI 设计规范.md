### **「轻盈生产力 (Aero-Productivity)」UI 设计规范**

这套风格的核心哲学在于：**通过极简的层级（Layering）代替沉重的线条，利用微妙的微交互（Micro-interactions）赋予静态页面生命力。**

---

## 技术栈说明

本项目采用以下技术栈：
- **UI 组件库**: NutUI React Taro (v2.6.14)
- **图标库**: Lucide React（默认使用）
- **样式方案**: Tailwind CSS + Sass/SCSS
- **开发框架**: Taro 4.x + React 18 + TypeScript
- **设计宽度**: 375px（移动端优先）

---

#### **1. 容器与深度 (Surfaces & Depth)**

* **非线性圆角:** 统一采用 `16px - 24px` 的大圆角，模拟物理硬件的顺滑感。
  - Tailwind CSS: 使用 `rounded-2xl` (16px) 或 `rounded-3xl` (24px)
  - Sass: 使用 `border-radius: 16px` 或 `24px`
  - NutUI 组件: 通过自定义样式覆盖，统一采用 `rounded-2xl` 作为圆角

* **呼吸感边框:** 弃用深色分割线，采用 `1px` 的极浅灰勾勒轮廓。背景色通常为纯白，底色为略带冷色调的灰白，形成极其微妙的视觉差。
  - Tailwind CSS: `border border-gray-100` 或 `border-gray-200`
  - Sass: `border: 1px solid rgba(0, 0, 0, 0.05)`

* **光影逻辑:** 静态时无阴影或使用 `Spread=0` 的微弱投影；交互时阴影向下方扩散，模拟物体"浮起"的质感。
  - 静态: `shadow-none` 或 `shadow-sm`
  - 交互: `shadow-md` 或 `shadow-lg`，配合 `transform: scale(0.98)`

#### **2. 内容排版 (Typography & Content)**

* **紧凑型字间距:** 标题使用 `tracking-tight` (-0.025em)，使文字块看起来更像一个精致的视觉符号而非松散的句子。
  - Tailwind CSS: `tracking-tight`
  - Sass: `letter-spacing: -0.025em`

* **数值中心化:** 核心指标使用粗体（Black/Bold）并增大字号，与其配套的辅助文字（Label）在字号和色值上形成鲜明对比。
  - 标题: `font-bold` 或 `font-black`，字号 `text-2xl` 或更大
  - 辅助文字: `font-normal` 或 `font-medium`，字号 `text-sm`，颜色 `text-gray-500` 或 `text-gray-600`

* **信息约束:** 强制执行 `line-clamp`（行数限制），通过牺牲部分细节来换取界面的高度整洁与呼吸感。
  - Tailwind CSS: `line-clamp-2`、`line-clamp-3` 等
  - Sass: 使用 `-webkit-line-clamp` 配合 `display: -webkit-box` 和 `-webkit-box-orient: vertical`

#### **3. 色彩语言 (Chromatic Language)**

* **低饱和功能色:** 不使用纯原色。所有提示色（红、黄、绿）均采用「50 级浅底 + 600 级深字」的组合，确保传达情绪的同时不破坏页面的清爽氛围。
  - 成功/绿色: 背景 `bg-green-50`，文字 `text-green-600`
  - 警告/黄色: 背景 `bg-yellow-50`，文字 `text-yellow-600`
  - 错误/红色: 背景 `bg-red-50`，文字 `text-red-600`
  - 信息/蓝色: 背景 `bg-blue-50`，文字 `text-blue-600`

* **强调色联动:** 品牌主色（Primary）仅在关键操作点（CTA）或选定状态下出现，作为视觉引导的"火花"。
  - 品牌主色: 橙色 `#F49227` (Tailwind: 自定义颜色或使用 `orange-500`)
  - NutUI 组件: 通过 `ConfigProvider` 配置主题色，或使用 `type="primary"` 属性

* **背景色规范:** 不使用纯 `white`，而是使用 `surface` 系列颜色，以便自动化完成主背景色切换（支持深色模式）。
  - 主背景: `bg-white` 或自定义 `bg-surface` (浅灰白 `#FAFAFA` 或 `#F5F5F5`)
  - 卡片背景: `bg-white`
  - 深色模式: 使用 `dark:` 前缀或 CSS 变量实现

#### **4. 状态动效 (Motion & Feedback)**

* **物理缩放:** 交互触发 `scale(0.98)` 的瞬间缩放，赋予 UI 按钮般的物理按键反馈。
  - CSS: `transform: scale(0.98); transition: transform 0.15s ease-out;`
  - 点击时: `active:scale-95` (Tailwind) 或 `&:active { transform: scale(0.95); }` (Sass)
  - NutUI 按钮: 已内置点击反馈，可通过自定义样式增强

* **呼吸引导:** 关键入口（如 Live 状态或推荐位）使用 `animate-ping` 等微弱的周期性动效，利用视觉本能引导注意力，而非强迫性弹窗。
  - Tailwind CSS: `animate-ping` 或自定义 `@keyframes` 动画
  - Sass: 使用 `@keyframes` 定义脉冲动画，配合 `animation: pulse 2s infinite;`

* **非对称过渡:** 进入状态快（Ease-out），退出状态慢（Ease-in），模拟真实世界的惯性。
  - 进入: `transition: all 0.2s ease-out;`
  - 退出: `transition: all 0.3s ease-in;`
  - Tailwind: `transition-all duration-200 ease-out` (进入) / `duration-300 ease-in` (退出)

#### **5. 骨架屏哲学 (Synchronous Loading)**

* **结构预留:** 加载状态不是"转圈圈"，而是 1:1 的布局预占位。这减少了数据回填时的"视觉跳跃"，让应用感知速度远快于实际物理加载速度。
  - 使用 NutUI 的 `Skeleton` 组件实现骨架屏
  - 骨架屏应与实际内容布局完全一致
  - 使用浅灰色背景 `bg-gray-100` 或 `bg-gray-200`，配合 `animate-pulse` 实现闪烁效果

---

## NutUI 组件使用规范

### 组件导入
```typescript
import { Button, Input, Toast, ConfigProvider } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
```

### 国际化配置
所有页面应使用 `ConfigProvider` 包裹，并设置中文语言包：
```tsx
<ConfigProvider locale={zhCN}>
  {/* 页面内容 */}
</ConfigProvider>
```

### 组件样式覆盖
- 优先使用 NutUI 组件的内置属性（如 `type`、`size`、`shape` 等）
- 需要自定义样式时，通过 `className` 传入自定义类名
- 使用 Sass 深度选择器覆盖 NutUI 内部样式：`.nut-button { /* 覆盖样式 */ }`
- 注意：NutUI 组件默认样式已做优化，避免过度覆盖

### 常用组件推荐
- **按钮**: `Button` - 使用 `type="primary"` 作为主要操作按钮
- **输入框**: `Input` - 配合自定义样式实现设计规范
- **提示**: `Toast` - 用于轻量级提示信息
- **加载**: `Loading` 或 `Skeleton` - 用于加载状态
- **弹窗**: `Dialog`、`Popup` - 用于模态交互

---

## 图标库使用规范

### 默认图标库：Lucide React

本项目默认使用 **Lucide React** 作为图标组件库。Lucide 提供了 1000+ 精美的开源图标，风格统一、设计现代。

### 安装与配置

图标库已安装并配置完成：
- **包名**: `lucide-react`
- **配置文件**: `src/constants/icons.ts`
- **组件封装**: `src/components/Icon.tsx`

### 使用方式

#### 方式一：使用 Icon 组件 + component 属性（推荐，支持按需导入）

```tsx
import { Icon } from '@/components/Icon'
import { Home, Search } from 'lucide-react'

// 基础使用（推荐，支持按需导入，减少包体积）
<Icon component={Home} size={24} color="#333" />

// 带样式类名
<Icon 
  component={Search} 
  size={20} 
  color="currentColor" 
  className="text-gray-500"
/>
```

#### 方式二：直接使用 Lucide 图标组件

```tsx
import { Home, Search, User } from 'lucide-react'
// 或从常量文件导入
import { Home, Search } from '@/constants/icons'

<Home size={24} color="#333" />
<Search size={20} />
```

#### 方式三：使用 Icon 组件 + name 属性（备选方案）

```tsx
import { Icon } from '@/components/Icon'

// 使用 name 方式（不推荐，会增加包体积）
<Icon name="Home" size={24} color="#333" />
<Icon name="Search" size={20} />
```

### 图标属性

- `component`: 图标组件（推荐使用），直接传入 Lucide 图标组件，支持按需导入
- `name`: 图标名称（备选方案），如 `"Home"`、`"Search"` 等，需要动态导入
- `size`: 图标大小，默认 `24`，支持数字或字符串（如 `"20px"`）
- `color`: 图标颜色，默认 `"currentColor"`（继承文字颜色）
- `strokeWidth`: 线条粗细，默认 `2`
- `className`: 自定义样式类名

> **注意**：优先使用 `component` 属性，这样可以实现按需导入，减少最终打包体积。`name` 方式需要动态导入所有图标，会增加包体积。

### 查找图标

1. 访问 [Lucide Icons 官网](https://lucide.dev/icons/)
2. 搜索需要的图标名称
3. 使用 PascalCase 格式的图标名称（如 `UserCircle`、`ArrowRight`）

### 小程序兼容性说明

- Taro 4.x 已启用 HTML 特性支持，Lucide 的 SVG 图标可以在小程序中使用
- 如果遇到兼容性问题，可以通过 `Icon` 组件进行降级处理
- 建议在小程序环境中充分测试图标显示效果

### 备选方案

如果 Lucide 图标无法满足需求，可以使用：
- **NutUI 图标**: `@nutui/icons-react-taro`（已安装）
- **SVG 文件**: 项目中的 `src/assets/icons/` 目录
- **Emoji**: 作为临时方案（不推荐长期使用）

### 最佳实践

1. **优先使用 component 方式**：通过 `component` 属性传入图标，支持按需导入，减少包体积
2. **统一使用 Icon 组件**：保持代码一致性，便于后续维护和统一样式控制
3. **按需导入图标**：只导入实际使用的图标，如 `import { Home, Search } from 'lucide-react'`
4. **保持尺寸一致**：同一场景下的图标使用相同尺寸，保持视觉统一
5. **颜色继承**：优先使用 `currentColor`，让图标自动继承文字颜色，便于主题切换
6. **避免使用 name 方式**：除非必须动态切换图标，否则不使用 `name` 属性

---

## Tailwind CSS 使用规范

### 类名使用原则
- **优先使用 Tailwind 工具类**，减少自定义 CSS
- **复杂样式使用 Sass**，Tailwind 作为补充
- **响应式设计**: 使用 `sm:`、`md:` 等前缀（小程序场景较少使用）

### 常用工具类映射
- 圆角: `rounded-2xl` (16px) / `rounded-3xl` (24px)
- 间距: `p-4` (16px) / `p-6` (24px) / `gap-4` (16px)
- 文字: `text-sm` / `text-base` / `text-lg` / `font-bold`
- 颜色: `text-gray-500` / `bg-gray-100` / `border-gray-200`
- 阴影: `shadow-sm` / `shadow-md` / `shadow-lg`
- 动画: `transition-all` / `duration-200` / `ease-out`

### 小程序注意事项
- Tailwind 的 `preflight` 已禁用（`corePlugins.preflight: false`）
- 某些 CSS 特性在小程序中可能不支持，需测试验证
- 使用 `weapp-tailwindcss` 插件确保 Tailwind 在小程序中正常工作

---

## Taro 小程序开发注意事项

### 组件使用
- 使用 `@tarojs/components` 中的组件（如 `View`、`Text`、`Image`、`ScrollView` 等）
- 避免使用原生 HTML 标签（如 `div`、`span`、`img` 等）

### 样式单位
- 使用 `px` 作为单位，Taro 会自动转换为 `rpx`（小程序单位）
- 设计稿基准宽度为 375px，配置在 `config/index.ts` 中

### 安全区域适配
- 使用 `env(safe-area-inset-bottom)` 等 CSS 变量适配刘海屏
- 底部导航栏等固定元素需要添加安全区域 padding

### 性能优化
- 使用 `ScrollView` 替代长列表的 `View`
- 图片使用 `lazy-load` 属性实现懒加载
- 避免过度使用动画，注意性能影响

---

## 代码示例

### 按钮组件（符合设计规范）
```tsx
<Button
  type="primary"
  size="large"
  className="rounded-2xl shadow-md active:scale-95 transition-all"
  onClick={handleClick}
>
  立即登录
</Button>
```

### 卡片容器（符合设计规范）
```tsx
<View className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
  {/* 卡片内容 */}
</View>
```

### 图标使用（符合设计规范）
```tsx
import { Icon } from '@/components/Icon'
import { Search, Home } from 'lucide-react'

// 在按钮中使用图标（推荐使用 component 方式）
<Button>
  <Icon component={Search} size={16} className="mr-2" />
  搜索
</Button>

// 在导航中使用图标
<View className="flex items-center">
  <Icon component={Home} size={20} color="#F49227" />
  <Text className="ml-2">首页</Text>
</View>
```

### 骨架屏（符合设计规范）
```tsx
<Skeleton
  rows={3}
  animated
  className="rounded-2xl"
/>
```

---

### 重要提示

1. **尽量使用中文进行说明和修饰**
2. **保持设计一致性**：所有页面和组件应遵循本规范
3. **渐进增强**：优先使用 NutUI 和 Tailwind 的能力，必要时再使用自定义样式
4. **测试验证**：在小程序环境中测试所有样式和交互效果
5. **性能优先**：避免过度使用动画和复杂样式，确保小程序流畅运行