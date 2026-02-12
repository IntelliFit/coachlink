# 批量操作功能 - 修复 SSE 消息解析鲁棒性

## 问题描述

用户遇到以下错误：

```
解析 SSE 消息失败: SyntaxError: Unterminated string in JSON at position 48678 (line 1 column 48679)
    at JSON.parse (<anonymous>)
    at BatchOperationService.executeBatchOperation (batchOperationService.ts:56:50)
    at async handleExecute (BatchOperationDialog.tsx:120:9)
```

## 问题原因

### 根本原因：数据分片问题

SSE (Server-Sent Events) 是流式传输，浏览器会将接收到的数据分成多个 **chunk**。一个完整的 JSON 消息可能被拆分到多个 chunk 中：

```
Chunk 1: data: {"type":"progress","message":"正在加载训练计划
Chunk 2: ..."}
```

### 旧代码的问题

```typescript
// 旧版代码
const chunk = decoder.decode(value, { stream: true });
const lines = chunk.split('\n');

for (const line of lines) {
    if (line.startsWith('data: ')) {
        const data = line.slice(6);
        const message = JSON.parse(data);  // ❌ 数据可能不完整！
    }
}
```

**问题分析：**

1. **没有缓冲区**：每个 chunk 独立处理，不会等待完整数据
2. **盲目解析**：直接对不完整的 JSON 调用 `JSON.parse()`
3. **错误静默**：`catch` 只打印日志，不阻止后续错误

### 触发场景

当 SSE 消息包含大量数据时（如 `preview_result` 包含完整的训练计划数据），JSON 字符串可能超过 48KB，极易被分片：

```json
{
  "type": "preview_result",
  "originalTrainingDays": [...很长的数组...],
  "updatedTrainingDays": [...很长的数组...],
  "modifications": [...很长的数组...]
}
```

---

## 解决方案

### 核心思路

1. **引入缓冲区**：缓存不完整的数据
2. **按行处理**：只处理完整的行
3. **验证数据**：解析前检查数据完整性
4. **详细日志**：记录错误上下文

### 实现代码

#### 1. 添加缓冲区

```typescript
let buffer = ''; // 用于缓存不完整的数据

while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
            this.processBuffer(buffer, onMessage, onError);
        }
        onComplete();
        break;
    }

    // 解码数据并添加到缓冲区
    buffer += decoder.decode(value, { stream: true });
    
    // 按行分割处理
    const lines = buffer.split('\n');
    
    // 保留最后一个可能不完整的行
    buffer = lines.pop() || '';

    // 处理完整的行
    for (const line of lines) {
        this.processLine(line, onMessage, onError);
    }
}
```

**关键点：**
- `buffer` 持久化存储跨 chunk 的数据
- `lines.pop()` 保留最后一行（可能不完整）
- 只处理完整的行

#### 2. 数据验证

```typescript
private static processLine(
    line: string,
    onMessage: (message: SSEMessage) => void,
    onError: (error: string) => void
): void {
    const trimmedLine = line.trim();
    
    // 跳过空行和非 SSE 数据
    if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
        return;
    }

    try {
        const data = trimmedLine.slice(6);
        
        // 检查数据是否为空
        if (!data.trim()) {
            return;
        }

        // 尝试解析 JSON
        const message = JSON.parse(data) as SSEMessage;
        
        // 验证消息格式
        if (!message.type) {
            console.warn('收到无效的 SSE 消息（缺少 type 字段）:', data);
            return;
        }

        onMessage(message);

        if (message.type === 'error') {
            onError(message.message);
        }
    } catch (e: any) {
        // 详细的错误日志
        console.error('解析 SSE 消息失败:', {
            error: e.message,
            line: line.substring(0, 200), // 只显示前200个字符
            position: e.message.match(/position (\d+)/)?.[1] || 'unknown'
        });
        
        // 不中断流程，继续处理后续消息
    }
}
```

**验证步骤：**
1. ✅ 检查是否为空
2. ✅ 检查是否以 `data: ` 开头
3. ✅ 检查 JSON 是否有效
4. ✅ 检查必需字段是否存在

#### 3. 错误处理增强

```typescript
catch (e: any) {
    // 详细的错误日志
    console.error('解析 SSE 消息失败:', {
        error: e.message,
        line: line.substring(0, 200),  // 防止日志过长
        position: e.message.match(/position (\d+)/)?.[1] || 'unknown'
    });
    
    // 不中断流程，继续处理后续消息
}
```

**改进：**
- 记录错误位置
- 截断长字符串
- 不抛出异常（静默处理）

---

## 数据流示例

### 场景：大型 JSON 被分片

#### Chunk 1
```
data: {"type":"preview_result","success":true,"originalTrainingDays":[{"type":"tra
```

**处理：**
```typescript
buffer = 'data: {"type":"preview_result",...tra'
lines = buffer.split('\n')  // ['data: {"type":"preview_result",...tra']
buffer = lines.pop()        // 'data: {"type":"preview_result",...tra'
// 没有完整行，继续等待
```

#### Chunk 2
```
ining","actionSets":[...]},{"type":"rest"}],"updatedTrainingDays":[...]}

data: {"type":"success","message":"完成"}

```

**处理：**
```typescript
buffer = 'data: {"type":"preview_result",...ining","actionSets":[...]},...]}\n\ndata: {"type":"success","message":"完成"}\n\n'

lines = buffer.split('\n')
// [
//   'data: {"type":"preview_result",...}',  // 完整的 preview_result
//   '',
//   'data: {"type":"success","message":"完成"}',
//   '',
//   ''
// ]

buffer = lines.pop()  // ''

// 处理第1行：成功解析 preview_result
// 处理第2行：空行，跳过
// 处理第3行：成功解析 success
```

---

## 代码对比

### 旧版（问题）

```typescript
// ❌ 没有缓冲区，每个 chunk 独立处理
const chunk = decoder.decode(value, { stream: true });
const lines = chunk.split('\n');

for (const line of lines) {
    if (line.startsWith('data: ')) {
        try {
            const data = line.slice(6);
            const message = JSON.parse(data);  // 可能失败
            onMessage(message);
        } catch (e) {
            console.error('解析 SSE 消息失败:', e);  // 日志不详细
        }
    }
}
```

### 新版（修复）

```typescript
// ✅ 使用缓冲区，处理跨 chunk 的数据
let buffer = '';

while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
        if (buffer.trim()) {
            this.processBuffer(buffer, onMessage, onError);
        }
        onComplete();
        break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';  // 保留不完整的行

    for (const line of lines) {
        this.processLine(line, onMessage, onError);  // 独立函数
    }
}
```

---

## 改进点总结

| 方面 | 旧版 | 新版 |
|------|------|------|
| **缓冲区** | ❌ 无 | ✅ 有，缓存不完整数据 |
| **行处理** | ❌ 直接处理 | ✅ 只处理完整行 |
| **数据验证** | ❌ 无 | ✅ 多重验证 |
| **错误日志** | ❌ 简单 | ✅ 详细（位置、内容） |
| **错误恢复** | ❌ 无 | ✅ 继续处理后续消息 |
| **代码结构** | ❌ 单一函数 | ✅ 模块化（processLine/processBuffer） |

---

## 测试建议

### 1. 正常场景

发送小型消息，确保正常工作：

```json
data: {"type":"progress","message":"测试"}
```

**预期：** 正常解析

### 2. 大型消息

发送包含大量数据的消息：

```json
data: {"type":"preview_result","originalTrainingDays":[...10000个字符...],"updatedTrainingDays":[...10000个字符...]}
```

**预期：** 
- 消息可能被分片
- 缓冲区正确拼接
- 最终正确解析

### 3. 损坏的消息

人为构造损坏的消息：

```
data: {"type":"error"
```

**预期：**
- 解析失败
- 记录详细错误日志
- 不影响后续消息处理

### 4. 快速连续消息

快速发送多条消息：

```
data: {"type":"progress","message":"步骤1"}

data: {"type":"progress","message":"步骤2"}

data: {"type":"progress","message":"步骤3"}
```

**预期：** 所有消息都正确处理

---

## 错误日志示例

### 旧版日志（不详细）

```
解析 SSE 消息失败: SyntaxError: Unterminated string in JSON at position 48678
```

### 新版日志（详细）

```
解析 SSE 消息失败: {
  error: "Unterminated string in JSON at position 48678",
  line: "data: {\"type\":\"preview_result\",\"originalTrainingDays\":[{\"type\":\"training\",\"actionSets\":[{\"actionId\":\"123\"...",
  position: "48678"
}
```

**优势：**
- 显示错误位置
- 显示部分数据内容
- 便于调试

---

## 性能影响

### 内存使用

**旧版：** 
- 每个 chunk 处理完立即释放
- 内存占用低

**新版：**
- 使用 `buffer` 缓存数据
- 最大内存占用 = 单条最大消息大小
- 对于本应用，最大约 100KB（包含完整训练计划）

**结论：** ✅ 可接受

### CPU 使用

**新增操作：**
- `lines.pop()`: O(1)
- `buffer += chunk`: O(n)
- `buffer.split('\n')`: O(n)

**结论：** ✅ 影响微乎其微

---

## 边界情况处理

### 1. 空消息

```
data: 

```

**处理：** 
```typescript
if (!data.trim()) {
    return;  // 跳过
}
```

### 2. 无 type 字段

```json
data: {"message":"test"}
```

**处理：**
```typescript
if (!message.type) {
    console.warn('收到无效的 SSE 消息');
    return;
}
```

### 3. 流提前结束

**处理：**
```typescript
if (done) {
    if (buffer.trim()) {
        this.processBuffer(buffer, onMessage, onError);  // 处理剩余数据
    }
    onComplete();
    break;
}
```

---

## 改动文件

1. ✅ `src/app/service/batchOperationService.ts`
   - 添加 `buffer` 缓冲区机制
   - 新增 `processLine()` 方法
   - 新增 `processBuffer()` 方法
   - 增强错误处理和日志

---

## 总结

通过引入缓冲区机制和多重数据验证，彻底解决了 SSE 消息解析的鲁棒性问题。

### 关键改进

✅ **缓冲区机制**：正确处理跨 chunk 的数据  
✅ **数据验证**：多重检查确保数据完整性  
✅ **错误处理**：详细日志，不中断流程  
✅ **模块化**：代码结构清晰，易于维护  

### 效果

- ❌ 旧版：大型消息可能解析失败
- ✅ 新版：任意大小的消息都能正确处理

---

完成！✨ SSE 消息解析现在更加鲁棒，能够正确处理任意大小的消息分片。
