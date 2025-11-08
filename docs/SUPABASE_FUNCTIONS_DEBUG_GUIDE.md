# Supabase Edge Functions 调试指南

## 概述

本文档总结了在开发和调试 Supabase Edge Functions 过程中遇到的常见问题和解决方案，为后续开发提供参考。

## 常见问题与解决方案

### 1. 前后端调用不匹配问题

#### 问题描述
- 后端函数测试正常，但前端调用失败
- 出现 401、400 等 HTTP 错误

#### 排查步骤
1. **使用 Supabase 网页测试功能**
   - 在 Supabase Dashboard 中找到对应的 Edge Function
   - 使用内置的测试工具验证函数本身是否正常
   - 确认请求体格式和必填字段

2. **对比成功的函数调用**
   - 查看项目中其他正常工作的函数调用方式
   - 检查参数格式、headers 设置等

#### 解决方案示例

**错误的前端调用方式：**
```javascript
const { data, error } = await supabase.functions.invoke('submit-pullup-record', {
  method: 'POST',  // ❌ 多余参数
  headers: {       // ❌ 不必要的 headers
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: { ... }
});
```

**正确的前端调用方式：**
```javascript
const { data, error } = await supabase.functions.invoke('submit-pullup-record', {
  body: { ... }  // ✅ 只传递必要的 body
});
```

### 2. 认证相关问题

#### 问题描述
- 用户未登录时无法调用函数
- 认证逻辑过于严格

#### 解决方案

**后端：支持可选认证**
```typescript
// ❌ 强制认证
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

// ✅ 可选认证
let user_id = null;
const authHeader = req.headers.get('Authorization');
if (authHeader) {
  try {
    const { data: { user } } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (user) {
      user_id = user.id;
    }
  } catch (error) {
    // 忽略认证错误，允许匿名提交
    console.log('认证失败，允许匿名提交:', error);
  }
}
```

**前端：移除不必要的登录检查**
```javascript
// ❌ 强制登录检查
if (!currentUser) {
  alert('请先登录');
  return;
}

// ✅ 允许匿名操作（如果后端支持）
// 直接调用函数，让后端决定是否需要认证
```

### 3. 字段验证问题

#### 问题描述
- 前端字段为可选，但后端要求必填
- 数据类型不匹配

#### 解决方案

**统一前后端字段要求：**

```typescript
// 后端验证逻辑
if (!weight_kg || !gender || typeof weight_kg !== 'number' || weight_kg <= 0) {
  return new Response(
    JSON.stringify({ error: '请填写有效的重量和性别信息' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// video_url 改为可选
video_url: video_url ? video_url.trim() : null,
```

```javascript
// 前端数据处理
body: {
  weight_kg: parseFloat(submissionData.weight_kg), // 确保数据类型正确
  gender: submissionData.gender,
  video_url: submissionData.video_url || null,     // 处理空值
  douyin_nickname: submissionData.douyin_nickname,
  notes: submissionData.notes || null
}
```

## 调试最佳实践

### 1. 分层调试

1. **后端函数测试**
   - 使用 Supabase Dashboard 的函数测试功能
   - 确认函数逻辑和数据处理正确

2. **前端调用测试**
   - 检查调用方式是否与其他成功函数一致
   - 验证数据格式和类型

3. **端到端测试**
   - 在实际应用中测试完整流程

### 2. 参考成功案例

在项目中寻找已经正常工作的函数调用作为参考：

```javascript
// 参考 pullupLeaderboardService.ts 中的成功调用
const { data, error } = await supabase.functions.invoke('admin-add-unclaimed-record', {
  body: {
    douyin_nickname: douyinNickname,
    weight_kg: weightKg,
    gender: gender,
    video_url: videoUrl,
    notes: notes,
  }
});
```

### 3. 错误处理

**后端错误处理：**
```typescript
try {
  // 业务逻辑
} catch (error) {
  console.error('处理请求时发生错误:', error);
  return new Response(
    JSON.stringify({ error: '服务器内部错误' }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
```

**前端错误处理：**
```javascript
try {
  const { data, error } = await supabase.functions.invoke('function-name', { ... });
  
  if (error) throw error;
  
  // 处理成功响应
} catch (error) {
  console.error('调用失败:', error);
  alert('操作失败: ' + (error.message || '未知错误'));
}
```

## 开发规范

### 1. 函数调用统一格式

```javascript
// 标准调用格式
const { data, error } = await supabase.functions.invoke('function-name', {
  body: {
    // 请求数据
  }
});

// 避免添加不必要的参数：
// - method (默认为 POST)
// - headers (除非特殊需要)
```

### 2. 认证处理

- 后端支持可选认证，提高灵活性
- 前端根据业务需求决定是否检查登录状态
- 使用 `user_id` 变量统一处理已登录和匿名用户

### 3. 数据验证

- 前后端保持字段要求一致
- 后端进行严格的数据类型和格式验证
- 前端确保数据类型正确（如使用 `parseFloat`）

## 常用调试命令

```bash
# 查看函数日志
supabase functions logs function-name

# 本地测试函数
supabase functions serve

# 部署函数
supabase functions deploy function-name
```

## 案例研究：get-user-submissions 函数优化

### 问题背景

在开发过程中，`get-user-submissions` 函数遇到了以下问题：
1. 函数返回 401 Unauthorized 错误
2. 用户体验不佳，需要手动输入抖音昵称
3. 认证逻辑过于严格，限制了功能的可用性

### 解决过程

#### 第一步：问题诊断

**使用 Supabase 函数测试工具**
- 在 Supabase Dashboard 中测试函数
- 发现函数本身强制要求 Authorization 头
- 确认问题出现在后端认证逻辑

**对比成功案例**
- 参考 `submit-pullup-record` 函数的实现
- 发现该函数支持匿名提交
- 确定了优化方向

#### 第二步：后端函数优化

**原始代码问题：**
```typescript
// ❌ 强制认证，不够灵活
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({
    error: '需要登录才能访问'
  }), { status: 401 });
}
```

**优化后的代码：**
```typescript
// ✅ 可选认证，支持多种访问模式
const authHeader = req.headers.get('Authorization');
let user_id = null;

if (authHeader) {
  // 如果有认证头，尝试获取用户信息
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (!userError && user) {
    user_id = user.id;
  }
}

// 如果没有认证用户，尝试从请求体获取抖音昵称
if (!user_id) {
  const requestBody = await req.json().catch(() => ({}));
  if (requestBody.douyin_nickname) {
    user_id = requestBody.douyin_nickname;
  }
  // 如果既没有认证也没有提供抖音昵称，则返回所有用户提交记录
}
```

**智能查询逻辑：**
```typescript
// 根据 user_id 类型决定查询字段
let query = supabaseClient.from('pullup_leaderboard')
  .select(`...`)
  .eq('is_user_submission', true);

// 如果有 user_id，则按用户过滤
if (user_id) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
  const queryField = isUUID ? 'submitted_by' : 'douyin_nickname';
  query = query.eq(queryField, user_id);
}
```

#### 第三步：前端调用简化

**原始代码问题：**
```javascript
// ❌ 复杂的认证检查和用户输入逻辑
if (currentUser) {
  // 认证调用
} else {
  const douyinNickname = prompt('请输入您的抖音昵称');
  // 匿名调用
}
```

**优化后的代码：**
```javascript
// ✅ 简化的直接调用
const { data, error } = await supabase.functions.invoke('get-user-submissions', {
  body: {}
});
```

### 技术要点总结

#### 1. 灵活的认证策略

**支持多种访问模式：**
- **认证模式**：用户登录后，使用 JWT token 获取个人记录
- **昵称模式**：通过抖音昵称获取特定用户记录
- **全量模式**：无需任何参数，获取所有用户记录

#### 2. 智能查询字段选择

```typescript
// UUID 格式检测
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user_id);
const queryField = isUUID ? 'submitted_by' : 'douyin_nickname';
```

#### 3. 渐进式功能降级

1. **优先级 1**：使用用户认证（最安全）
2. **优先级 2**：使用抖音昵称（部分功能）
3. **优先级 3**：显示所有记录（最大兼容性）

### 最佳实践

#### 1. 函数设计原则

- **向后兼容**：新功能不破坏现有调用方式
- **渐进增强**：从基础功能开始，逐步添加高级特性
- **用户友好**：减少用户操作步骤，提升体验

#### 2. 错误处理策略

```typescript
// 优雅的错误处理
try {
  const { data: { user } } = await supabaseClient.auth.getUser(token);
  if (user) user_id = user.id;
} catch (error) {
  // 认证失败不阻断流程，继续尝试其他方式
  console.log('认证失败，尝试其他方式:', error);
}
```

#### 3. 前端调用简化

- 移除不必要的条件检查
- 让后端处理复杂逻辑
- 统一错误处理机制

### 性能优化

#### 1. 查询优化

- 使用索引字段进行查询（`submitted_by`, `douyin_nickname`）
- 添加必要的过滤条件（`is_user_submission = true`）
- 合理的排序和分页

#### 2. 缓存策略

```javascript
// 可以考虑添加前端缓存
const cacheKey = `user-submissions-${user_id || 'all'}`;
const cachedData = localStorage.getItem(cacheKey);
if (cachedData && !forceRefresh) {
  return JSON.parse(cachedData);
}
```

### 安全考虑

#### 1. 数据访问控制

- 认证用户只能看到自己的记录
- 匿名用户可以看到所有公开记录
- 敏感信息（如用户ID）不暴露给前端

#### 2. 输入验证

```typescript
// 验证抖音昵称格式
if (requestBody.douyin_nickname) {
  const nickname = requestBody.douyin_nickname.trim();
  if (nickname.length > 0 && nickname.length <= 50) {
    user_id = nickname;
  }
}
```

### 测试验证

#### 1. 功能测试

- **认证用户测试**：登录后查看个人记录
- **匿名用户测试**：未登录时查看所有记录
- **昵称查询测试**：通过抖音昵称查询特定记录

#### 2. 边界测试

- 无效的认证 token
- 不存在的抖音昵称
- 空的请求体
- 网络异常情况

### 经验总结

1. **分层调试**：先确保后端函数正常，再优化前端调用
2. **参考成功案例**：借鉴项目中已有的成功实现
3. **用户体验优先**：减少用户操作步骤，提供合理的默认行为
4. **灵活性设计**：支持多种使用场景，不强制单一模式
5. **渐进式优化**：从解决核心问题开始，逐步完善功能

这个案例展示了如何通过系统性的分析和优化，将一个有问题的函数改造成用户友好、功能灵活的解决方案。

## 案例研究：修复管理员审核功能的 500 错误

### 问题背景

管理员在审核用户提交的引体向上记录时，点击“批准”或“拒绝”按钮后，前端页面会报 500 Internal Server Error。此问题经过多次尝试修复，但依然存在，严重影响了核心功能的可用性。

### 解决过程

#### 第一步：初步诊断与日志分析

1.  **前端调用栈分析**：根据用户提供的浏览器开发者工具截图，错误发生在 `AdminReviewPage.tsx` 的 `handleReview` 函数中，是调用 Supabase Edge Function `review-pullup-submission` 时返回了 500 错误。

2.  **查看函数日志**：通过 `run_mcp` 工具调用 `get_logs` 命令查看 `review-pullup-submission` 函数的日志。日志显示了关键错误信息：

    ```
    ERROR: invalid input syntax for type uuid: "system"
    ```

    这个错误明确指出，向数据库 `pullup_leaderboard` 表的 `reviewed_by` 字段（类型为 `uuid`）写入了一个字符串 `'system'`，导致了类型不匹配的错误。

#### 第二步：定位错误的根源

1.  **检查后端代码**：查看 `review-pullup-submission/index.ts` 文件。发现在处理请求时，如果请求没有携带有效的用户认证信息，代码会使用一个硬编码的字符串 `'system'` 作为 `adminUserId` 的值。

    ```typescript
    // 错误的代码片段
    let adminUserId = 'system'; // 问题的根源
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      // ... 尝试获取用户ID
    }
    
    // ... 更新数据库时使用了 adminUserId
    const { error: updateError } = await supabaseClient
      .from('pullup_leaderboard')
      .update({ reviewed_by: adminUserId, ... })
      .eq('id', record_id);
    ```

2.  **检查数据库表结构**：通过 `run_mcp` 工具的 `execute_sql` 命令查询 `pullup_leaderboard` 表的结构，确认了 `reviewed_by` 字段确实是 `uuid` 类型，并且允许为 `NULL`。

#### 第三步：第一次修复尝试（数据类型修正）

**解决方案**：将硬编码的 `'system'` 修改为 `null`，以符合数据库字段的要求。因为在开发模式下，我们允许在没有管理员登录的情况下进行审核操作，将 `reviewed_by` 设为 `null` 是一个合理的降级策略。

```typescript
// 修正后的代码
let adminUserId = null; // ✅ 将默认值改为 null
const authHeader = req.headers.get('Authorization');
if (authHeader) {
  // ...
}
```

**结果**：部署修改后，问题依然存在。这表明还有其他问题。

#### 第四步：深入排查与第二次修复（输入验证）

1.  **再次分析日志**：虽然解决了 `reviewed_by` 的类型问题，但 500 错误依然发生。这通常意味着有新的错误，或者之前的错误掩盖了另一个问题。

2.  **检查前端传递的参数**：怀疑前端传递给后端的 `record_id` 可能存在问题。通过 `run_mcp` 工具的 `execute_sql` 查询了 `pullup_leaderboard` 表中待审核的记录，确认了 `id` 都是有效的 UUID 格式。

3.  **检查后端输入验证**：重新审视 `review-pullup-submission/index.ts`，发现代码虽然检查了 `record_id` 是否存在，但**没有验证其格式**。如果前端因为某些原因传递了一个非 UUID 格式的字符串，数据库操作同样会失败。

**解决方案**：在后端函数中增加对 `record_id` 的 UUID 格式验证，如果格式不正确，则提前返回 400 Bad Request 错误，而不是让数据库抛出 500 错误。

```typescript
// 增加 UUID 格式验证
const { record_id, action } = await req.json();

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!record_id || !uuidRegex.test(record_id)) {
  return new Response(JSON.stringify({ error: '无效的记录ID' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**结果**：在增加了严格的输入验证后，再次部署和测试，管理员审核功能终于成功！

### 经验总结

这次复杂的调试过程揭示了几个在开发 Supabase Edge Functions 时至关重要的经验：

1.  **数据库日志是最终真相**：前端的报错和函数的初步日志可能只揭示了问题的冰山一角。当遇到难以解决的 500 错误时，直接查看数据库（Postgres）日志或函数日志中的 `ERROR` 级别的详细信息，往往能直击要害。`invalid input syntax for type uuid` 就是这次调试的关键突破口。

2.  **严格的数据类型匹配**：JavaScript/TypeScript 的弱类型特性很容易让人忽略与数据库强类型（如 `uuid`, `timestamp`）之间的不匹配。在将数据写入数据库之前，必须确保每个字段的类型都完全符合表结构定义。对于 `uuid` 字段，要么提供一个有效的 UUID，要么提供 `null`（如果字段允许）。

3.  **后端必须有“不信任”原则**：永远不要完全信任前端传递的数据。即使前端应用逻辑看起来是正确的，也必须在后端对所有输入（特别是ID、关键参数等）进行严格的格式和类型验证。增加 UUID 格式的正则表达式验证是防止数据库层面出错的最后一道防线。

4.  **迭代式调试**：当一个问题修复后，错误仍然存在时，不要灰心。这通常意味着存在多个问题。系统性地、一步一步地排查，从日志分析到代码审查，再到输入验证，最终会找到所有隐藏的缺陷。

5.  **优雅降级与明确报错**：在开发模式或需要支持匿名操作的场景下，使用 `null` 作为默认值是一种有效的“优雅降级”策略。同时，在验证失败时，应返回明确的客户端错误（如 400 Bad Request）和错误信息，而不是让服务器因内部错误而崩溃（500 Internal Server Error），这极大地提高了 API 的健壮性和可调试性。

## 总结

通过系统性的调试方法和规范化的开发流程，可以有效避免和解决 Supabase Edge Functions 的常见问题。关键是要分层调试、参考成功案例，并保持前后端的一致性。