# [需求] 商家入驻与实体商品销售系统

## 1. 文档概述

- **文档版本**：V1.0
- **创建时间**：2026-02-04
- **文档目的**：支持第三方商家（运动装备、运动补剂等）在平台开设店铺，销售实体商品，与现有教练服务形成生态互补。

> 本需求参考现有「教练入驻」流程进行设计，保持系统一致性。

---

## 2. 背景与价值

### 2.1 业务背景

- 平台现有「服务商品」全部为教练个人计划（虚拟服务）
- 用户购买运动装备、补剂的需求强烈，但需跳转外部电商
- 合作伙伴（运动装备商、补剂商）希望借助平台精准用户群进行销售

### 2.2 预期价值

| 价值点 | 说明 |
|--------|------|
| 生态完善 | 从训练服务延伸到实体商品，构建完整健身生态 |
| 收入增长 | 平台可按交易抽佣获取收入 |
| 用户粘性 | 一站式满足用户训练+装备需求 |
| 商家引流 | 帮助合作商家触达精准健身人群 |

---

## 3. 目标与非目标

### 3.1 目标（Scope）

| 优先级 | 目标描述 |
|--------|----------|
| **P0** | 商家入驻申请流程：表单填写 → 管理员审核 → 入驻成功 |
| **P0** | 商家后台基础：商品管理（上架/下架/编辑）、订单管理 |
| **P0** | 管理员审核后台：商家申请审核页面 |
| **P0** | 商品展示：在服务商品页面增加「实体商品」分类入口 |
| **P1** | 商家收入看板：查看销售额、订单数、已结算/待结算金额 |
| **P1** | 购物车功能：支持混合购买（教练服务+实体商品） |
| **P1** | 商品评价系统：用户对购买的商品进行评价 |

### 3.2 非目标（Out of Scope - V1）

- 不做库存同步（V1 假设商家自行管理库存）
- 不做物流跟踪（V1 仅展示商家提供的物流单号）
- 不做复杂的分销/佣金体系
- 不做自动分账（V1 先手动结算）
- 不做商家间互相引流/推荐

---

## 4. 角色与权限模型

### 4.1 角色定义

| 角色 | 说明 |
|------|------|
| **商家（Merchant）** | 通过审核的入驻商家，可发布和管理商品 |
| **平台管理员（Admin）** | 审核商家申请，监管商品内容，处理投诉 |
| **普通用户（User/Student）** | 浏览和购买商品 |

### 4.2 权限边界

```
┌─────────────────────────────────────────────────────────┐
│                    平台管理员                            │
│  - 审核商家入驻申请                                       │
│  - 下架违规商品                                          │
│  - 查看全平台商家/商品数据                                │
│  - 处理用户投诉                                          │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ 审核
┌─────────────────────────────────────────────────────────┐
│                      商家                                │
│  - 管理自己店铺的商品（增删改查）                          │
│  - 查看自己的订单和收入                                   │
│  - 更新店铺信息                                          │
│  - 【不能】查看其他商家数据                               │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ 购买
┌─────────────────────────────────────────────────────────┐
│                    普通用户                              │
│  - 浏览商品列表/详情                                     │
│  - 购买商品                                             │
│  - 评价已购商品                                          │
│  - 申请退款                                             │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 功能需求列表（Feature List）

### 5.1 商家入驻申请（P0）

#### 5.1.1 申请入口

- 位置：「我的」页面 → 「申请成为商家」（与「申请成为教练」平级）
- 触发条件：
  - 用户已登录
  - 用户当前不是已入驻商家

#### 5.1.2 申请表单字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| 店铺名称 | text | ✅ | 展示在商品列表和店铺主页 |
| 店铺Logo | image | ✅ | 建议 200x200 px |
| 商家类型 | select | ✅ | 运动装备 / 营养补剂 / 健身器材 / 其他 |
| 主营类目 | multi-select | ✅ | 如：蛋白粉、护具、握力器等 |
| 店铺简介 | textarea | ✅ | 100-500字 |
| 联系人姓名 | text | ✅ | |
| 联系电话 | phone | ✅ | |
| 联系邮箱 | email | ❌ | |
| 营业执照 | file | ✅ | 图片/PDF |
| 相关资质证明 | files | ❌ | 如保健品备案等 |
| 店铺地址 | address | ❌ | 发货地址 |
| 其他说明 | textarea | ❌ | 补充信息 |

#### 5.1.3 申请状态流转

```
[用户提交] → pending → [管理员审核]
                            ├── approved → 商家入驻成功
                            └── rejected → 驳回（附驳回原因）
                                          └── 用户可重新申请
```

#### 5.1.4 数据结构（参考）

```sql
-- 商家申请表
CREATE TABLE merchant_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- 基础信息
    shop_name TEXT NOT NULL,
    shop_logo_url TEXT,
    merchant_type TEXT NOT NULL,      -- equipment/supplements/gear/other
    main_categories TEXT[],           -- 主营类目
    shop_description TEXT NOT NULL,
    
    -- 联系信息
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT,
    shop_address JSONB,               -- { province, city, district, detail }
    
    -- 资质文件
    business_license_url TEXT NOT NULL,
    certificates JSONB,               -- [{ name, url }]
    extra_notes TEXT,
    
    -- 审核信息
    status TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected
    review_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    -- 时间戳
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 商家表（审核通过后创建）
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    application_id UUID REFERENCES merchant_applications(id),
    
    -- 店铺信息（从申请同步）
    shop_name TEXT NOT NULL,
    shop_logo_url TEXT,
    merchant_type TEXT NOT NULL,
    main_categories TEXT[],
    shop_description TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    shop_address JSONB,
    
    -- 运营状态
    status TEXT NOT NULL DEFAULT 'active',  -- active/suspended/closed
    
    -- 统计（冗余，定期同步）
    total_products INT DEFAULT 0,
    total_orders INT DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5.2 管理员审核后台（P0）

#### 5.2.1 审核列表页

- 路由：`/admin/merchant-applications`
- 功能：
  - 列表展示所有商家申请
  - 筛选：状态（待审核/已通过/已驳回）、申请时间
  - 搜索：店铺名称、联系电话
  - 排序：申请时间（默认倒序）

#### 5.2.2 审核详情弹窗

- 展示申请表单全部信息
- 预览营业执照和资质证明
- 操作按钮：
  - **通过**：创建商家账号，发送通知
  - **驳回**：填写驳回原因，发送通知

#### 5.2.3 商家管理

- 路由：`/admin/merchants`
- 功能：
  - 查看所有已入驻商家
  - 暂停/恢复商家经营
  - 查看商家商品和订单

---

### 5.3 商家后台（P0）

#### 5.3.1 商家后台入口

- 入口位置：导航栏或「我的」页面显示「商家中心」入口
- 仅对已入驻商家可见

#### 5.3.2 商家后台页面结构

```
/merchant
├── overview        # 概览：销售数据、待处理订单
├── products        # 商品管理
│   ├── list        # 商品列表
│   ├── create      # 创建商品
│   └── edit/[id]   # 编辑商品
├── orders          # 订单管理
│   └── [id]        # 订单详情
├── revenue         # 收入管理
│   └── history     # 收入明细
└── settings        # 店铺设置
```

#### 5.3.3 概览页（Overview）

| 数据卡片 | 说明 |
|----------|------|
| 今日销售额 | 今日已完成订单金额 |
| 待发货订单 | 需要处理的订单数量 |
| 累计收入 | 总销售额（已结算+待结算） |
| 商品数量 | 上架中商品总数 |

#### 5.3.4 商品管理字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| 商品名称 | text | ✅ | |
| 商品图片 | images | ✅ | 最多9张 |
| 商品类目 | select | ✅ | 从商家主营类目选择 |
| 商品价格 | number | ✅ | 单位：元 |
| 原价 | number | ❌ | 用于展示划线价 |
| 库存 | number | ✅ | |
| 商品描述 | richtext | ✅ | 支持图文 |
| 规格（SKU） | array | ❌ | 如颜色、尺码 |
| 运费 | number | ✅ | 0 = 包邮 |
| 上架状态 | boolean | ✅ | 默认上架 |

---

### 5.4 商品展示与购买（P0）

#### 5.4.1 商品入口

- **服务商品页面**：增加 Tab 切换「教练服务 / 实体商品」
- **商品列表**：
  - 筛选：类目、价格区间
  - 排序：销量、价格、上新时间
  - 卡片展示：商品图、名称、价格、店铺名

#### 5.4.2 商品详情页

- 商品图片轮播
- 商品信息：名称、价格、描述
- 规格选择（如有）
- 店铺信息（可点击进入店铺主页）
- 购买按钮 / 加入购物车

#### 5.4.3 购买流程

```
选择规格 → 确认收货地址 → 选择支付方式 → 支付 → 订单生成
                                              ↓
                          商家发货（填写物流单号）
                                              ↓
                          用户确认收货 → 订单完成
```

---

### 5.5 订单系统（P0）

#### 5.5.1 订单状态

| 状态 | 说明 |
|------|------|
| `pending_payment` | 待支付（用户下单未付款） |
| `paid` | 已支付（等待商家发货） |
| `shipped` | 已发货（商家填写物流单号） |
| `completed` | 已完成（用户确认收货或自动确认） |
| `cancelled` | 已取消 |
| `refunding` | 退款中 |
| `refunded` | 已退款 |

#### 5.5.2 订单数据结构（参考）

```sql
CREATE TABLE merchant_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no TEXT NOT NULL UNIQUE,        -- 订单号
    
    -- 关联
    user_id UUID NOT NULL REFERENCES auth.users(id),
    merchant_id UUID NOT NULL REFERENCES merchants(id),
    product_id UUID NOT NULL REFERENCES merchant_products(id),
    
    -- 商品快照
    product_snapshot JSONB NOT NULL,      -- 购买时商品信息快照
    sku_info JSONB,                       -- 选择的规格
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    shipping_fee DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- 收货信息
    shipping_address JSONB NOT NULL,
    
    -- 物流信息
    shipping_company TEXT,
    tracking_number TEXT,
    shipped_at TIMESTAMPTZ,
    
    -- 订单状态
    status TEXT NOT NULL DEFAULT 'pending_payment',
    
    -- 支付信息
    payment_method TEXT,
    paid_at TIMESTAMPTZ,
    
    -- 完成信息
    completed_at TIMESTAMPTZ,
    auto_complete_at TIMESTAMPTZ,         -- 自动确认收货时间
    
    -- 时间戳
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5.6 商家收入系统（P1）

#### 5.6.1 收入计算

| 项目 | 说明 |
|------|------|
| 订单金额 | 用户支付总额 |
| 平台服务费 | 按比例抽佣（如 10%） |
| 商家实际收入 | 订单金额 - 平台服务费 |

#### 5.6.2 结算规则（V1 简化方案）

- 订单完成后，收入进入「待结算」状态
- 7天售后期后，收入变为「可提现」
- 商家申请提现 → 管理员审核 → 手动转账

#### 5.6.3 收入看板

| 数据项 | 说明 |
|--------|------|
| 累计收入 | 历史总收入 |
| 待结算 | 订单完成但未过售后期 |
| 可提现 | 已过售后期可申请提现 |
| 已提现 | 历史提现总额 |

---

## 6. 页面/路由规划

### 6.1 用户端

| 路由 | 页面说明 |
|------|----------|
| `/me/merchant-application` | 商家入驻申请页 |
| `/me/merchant-application/status` | 申请状态查看页 |
| `/shop/products` | 商品列表页 |
| `/shop/products/[id]` | 商品详情页 |
| `/shop/[merchantId]` | 店铺主页 |
| `/shop/cart` | 购物车页面 |
| `/shop/checkout` | 结算页面 |
| `/me/orders/products` | 我的商品订单列表 |
| `/me/orders/products/[id]` | 商品订单详情 |

### 6.2 商家端

| 路由 | 页面说明 |
|------|----------|
| `/merchant/overview` | 商家概览 |
| `/merchant/products` | 商品管理列表 |
| `/merchant/products/create` | 创建商品 |
| `/merchant/products/edit/[id]` | 编辑商品 |
| `/merchant/orders` | 订单管理 |
| `/merchant/orders/[id]` | 订单详情 |
| `/merchant/revenue` | 收入概览 |
| `/merchant/revenue/history` | 收入明细 |
| `/merchant/settings` | 店铺设置 |

### 6.3 管理员端

| 路由 | 页面说明 |
|------|----------|
| `/admin/merchant-applications` | 商家申请审核 |
| `/admin/merchants` | 商家管理 |
| `/admin/merchant-products` | 商品监管 |
| `/admin/merchant-orders` | 订单监管 |

---

## 7. API 规划

### 7.1 商家申请 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/merchant/create-application` | POST | 提交商家申请 |
| `/api/merchant/get-application` | GET | 获取用户的申请状态 |
| `/api/admin/list-merchant-applications` | GET | 管理员获取申请列表 |
| `/api/admin/review-merchant-application` | POST | 审核商家申请 |

### 7.2 商家管理 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/merchant/get-profile` | GET | 获取商家信息 |
| `/api/merchant/update-profile` | POST | 更新商家信息 |
| `/api/merchant/get-overview` | GET | 获取商家概览数据 |

### 7.3 商品管理 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/merchant/products/list` | GET | 获取商家商品列表 |
| `/api/merchant/products/create` | POST | 创建商品 |
| `/api/merchant/products/update` | POST | 更新商品 |
| `/api/merchant/products/delete` | POST | 删除商品 |
| `/api/merchant/products/toggle-status` | POST | 上架/下架商品 |

### 7.4 商品展示 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/shop/products/list` | GET | 获取商品列表（公开） |
| `/api/shop/products/[id]` | GET | 获取商品详情（公开） |
| `/api/shop/merchants/[id]` | GET | 获取店铺信息（公开） |

### 7.5 订单 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/shop/orders/create` | POST | 创建订单 |
| `/api/shop/orders/list` | GET | 获取用户订单列表 |
| `/api/shop/orders/[id]` | GET | 获取订单详情 |
| `/api/shop/orders/cancel` | POST | 取消订单 |
| `/api/shop/orders/confirm` | POST | 确认收货 |
| `/api/merchant/orders/list` | GET | 商家获取订单列表 |
| `/api/merchant/orders/ship` | POST | 商家发货 |

### 7.6 收入 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/merchant/revenue/overview` | GET | 获取收入概览 |
| `/api/merchant/revenue/history` | GET | 获取收入明细 |
| `/api/merchant/revenue/withdraw` | POST | 申请提现 |

---

## 8. 与现有系统的关系

### 8.1 与教练系统的区别

| 维度 | 教练系统 | 商家系统 |
|------|----------|----------|
| 产品类型 | 虚拟服务（训练计划） | 实体商品 |
| 交付方式 | 线上服务 | 物流配送 |
| 核心能力 | 教练指导、计划制定 | 商品管理、订单履约 |
| 收入模式 | 订阅服务费 | 商品销售 |

### 8.2 复用模块

| 模块 | 复用方式 |
|------|----------|
| 用户认证 | 完全复用现有登录系统 |
| 支付系统 | 复用微信/支付宝支付接口 |
| 管理员权限 | 复用现有 Admin 权限校验 |
| 通知系统 | 复用消息通知基础设施 |
| 文件上传 | 复用 Supabase Storage |

### 8.3 独立模块

- 商家申请/审核流程
- 商家后台全部功能
- 商品管理系统
- 实体商品订单系统（区别于服务订阅）
- 物流信息管理

---

## 9. 验收标准（Acceptance Criteria）

### 9.1 P0 必须完成

- [ ] 用户可提交商家入驻申请
- [ ] 管理员可审核商家申请（通过/驳回）
- [ ] 审核通过后，用户成为商家，可进入商家后台
- [ ] 商家可创建/编辑/上架/下架商品
- [ ] 用户可浏览商品列表和商品详情
- [ ] 用户可购买商品并完成支付
- [ ] 商家可查看订单并发货
- [ ] 用户可确认收货，订单完成

### 9.2 P1 加分项

- [ ] 商家收入看板和提现申请
- [ ] 购物车功能
- [ ] 商品评价系统
- [ ] 商品分类筛选和搜索

---

## 10. 开放问题（待确认）

1. **平台抽佣比例**：建议 8%-15%，具体数字需确定
2. **商家类型限制**：是否限制可入驻的商家类型？
3. **商品审核**：商品上架是否需要平台审核？
4. **物流对接**：是否需要对接物流 API 查询物流信息？还是仅展示商家填写的单号？
5. **退款流程**：用户申请退款后的处理流程是怎样的？
6. **商品与教练关联**：是否支持教练推荐商品获得分佣？

---

## 11. 实施建议

### 11.1 分阶段实施

| 阶段 | 范围 | 预估周期 |
|------|------|----------|
| Phase 1 | 商家入驻申请 + 管理员审核 | 1-2 周 |
| Phase 2 | 商家后台 + 商品管理 | 2-3 周 |
| Phase 3 | 商品展示 + 购买流程 | 2-3 周 |
| Phase 4 | 订单管理 + 发货确认 | 1-2 周 |
| Phase 5 | 收入系统 + 评价系统 | 2 周 |

### 11.2 技术栈

- 前端：Next.js（与现有一致）
- 后端：Next.js API Routes
- 数据库：Supabase (PostgreSQL)
- 存储：Supabase Storage
- 支付：复用现有微信/支付宝接口

---

_文档编写：AI Assistant_
_文档版本：v1.0_
_最后更新：2026-02-04_
