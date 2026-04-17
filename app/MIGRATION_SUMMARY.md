# 学员端页面迁移总结

## 已完成页面列表

### ✅ 已完成迁移的页面（共 15 个）

1. **会员相关**（3个）
   - `pages/me/membership/index` - 我的会员
   - `pages/me/membership/subscribe/index` - 会员订阅
   - `pages/me/membership/referral/index` - 邀请好友

2. **计划库相关**（3个）
   - `pages/me/plan-lib/index` - 我的计划库
   - `pages/me/plan-lib/create/index` - 创建计划（占位页，提示使用网页端）
   - `pages/me/plan-lib/edit/index` - 编辑计划（占位页，提示使用网页端）

3. **训练历史**（2个）
   - `pages/me/plan-history/index` - 训练历史列表
   - `pages/me/plan-history/detail/index` - 训练历史详情

4. **购物相关**（2个）
   - `pages/me/cart/index` - 购物车
   - `pages/me/purchase-history/index` - 购买记录

5. **其他功能**（5个）
   - `pages/me/toolbox/index` - 工具箱
   - `pages/me/settings/index` - 账户设置
   - `pages/friends/index` - 我的好友
   - `pages/friends/activity/index` - 好友动态
   - `pages/messages/index` - 消息中心
   - `pages/coach/plans/index` - 当前计划（新增）

## 页面功能说明

### 会员相关页面
- **我的会员**：显示当前会员等级、配额使用情况（AI导入次数、云存储空间）
- **会员订阅**：显示可订阅的会员套餐和加油包（提示在网页端完成支付）
- **邀请好友**：显示邀请码、邀请奖励说明和邀请统计

### 计划库相关页面
- **我的计划库**：显示收藏的训练计划模板，支持应用和删除
- **创建/编辑计划**：占位页面，提示用户在网页端使用完整功能

### 训练历史页面
- **训练历史列表**：显示所有历史计划，支持按来源筛选（全部/教练指派/我的计划）
- **训练历史详情**：显示计划的基本信息和完成度

### 购物相关页面
- **购物车**：显示待订阅的服务，支持删除和订阅操作（订阅跳转到网页端）
- **购买记录**：显示历史购买记录，支持分页加载

### 其他功能页面
- **工具箱**：显示可用工具列表（力量计算器、单杠位置、社区数据）
- **账户设置**：修改密码、查看账户绑定状态、退出登录
- **我的好友**：搜索用户、添加好友、处理好友请求
- **好友动态**：查看好友的训练动态和成就
- **消息中心**：显示会话列表，支持搜索（完整聊天功能在网页端）

## 技术实现要点

### 1. 路由参数处理
小程序不支持动态路由 `[id]`，使用查询参数传递：
```typescript
// 跳转时传递参数
Taro.navigateTo({ url: `/pages/me/plan-lib/edit/index?id=${planId}` })

// 获取参数
const router = useRouter()
const planId = router.params?.id
```

### 2. API 调用
所有页面使用统一的 `request` 工具函数：
```typescript
import { request } from '@/utils/request'

const res = await request<ResponseType>({
  url: '/api/endpoint',
  method: 'POST',
  data: { ... }
})
```

### 3. 样式规范
- 使用 `rpx` 作为响应式单位
- 统一的卡片样式和间距
- 统一的颜色主题（主色：#f97316）

### 4. 状态管理
- 使用 React Hooks（useState, useEffect, useCallback）
- 页面显示时自动刷新数据（useDidShow）
- 支持下拉刷新（usePullDownRefresh）
- 支持上拉加载更多（useReachBottom）

## 注意事项

### 功能限制
1. **支付功能**：小程序端不支持支付，订阅和购买需在网页端完成
2. **复杂编辑**：计划创建/编辑等复杂功能建议在网页端使用
3. **聊天功能**：小程序端仅显示会话列表，完整聊天功能在网页端

### 待完善功能
1. **训练执行页面**：需要实现完整的训练记录功能（逐组记录、视频上传、PR标记）
2. **教练主页/订阅**：需要完善问卷填写功能
3. **个人档案**：需要完善数据展示和编辑功能
4. **动作库**：需要完善动作详情和编辑功能
5. **知识库**：需要实现知识库的浏览和搜索功能

## 文件结构

```
coachlink-wechat-app/src/pages/
├── me/
│   ├── membership/
│   │   ├── index.tsx          # 我的会员
│   │   ├── subscribe/
│   │   │   └── index.tsx      # 会员订阅
│   │   └── referral/
│   │       └── index.tsx      # 邀请好友
│   ├── plan-lib/
│   │   ├── index.tsx          # 我的计划库
│   │   ├── create/
│   │   │   └── index.tsx      # 创建计划
│   │   └── edit/
│   │       └── index.tsx      # 编辑计划
│   ├── plan-history/
│   │   ├── index.tsx          # 训练历史列表
│   │   └── detail/
│   │       └── index.tsx      # 训练历史详情
│   ├── cart/
│   │   └── index.tsx          # 购物车
│   ├── purchase-history/
│   │   └── index.tsx          # 购买记录
│   ├── toolbox/
│   │   └── index.tsx          # 工具箱
│   └── settings/
│       └── index.tsx          # 账户设置
├── friends/
│   ├── index.tsx              # 我的好友
│   └── activity/
│       └── index.tsx          # 好友动态
├── messages/
│   └── index.tsx              # 消息中心
└── coach/
    └── plans/
        └── index.tsx          # 当前计划
```

## 下一步工作建议

1. **完善进行中的页面**
   - 训练执行页面：实现完整的训练记录功能
   - 教练主页：完善问卷填写和订阅流程
   - 个人档案：完善数据展示和编辑
   - 动作库：完善动作详情和编辑
   - 知识库：实现浏览和搜索功能

2. **优化用户体验**
   - 统一错误处理和提示
   - 优化加载状态显示
   - 添加空状态提示
   - 优化页面切换动画

3. **性能优化**
   - 图片懒加载
   - 列表虚拟滚动（如果数据量大）
   - API 请求缓存
   - 减少不必要的重新渲染

4. **测试和调试**
   - 测试所有页面的基本功能
   - 测试边界情况（空数据、错误处理）
   - 测试不同屏幕尺寸的适配
   - 测试网络异常情况

## 更新日期

2026-02-11：完成学员端主要页面的迁移工作
