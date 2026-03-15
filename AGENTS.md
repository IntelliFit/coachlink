# Agent Development Guidelines

## 代码修改规范

### 修改后检查流程
每次修改完成后，必须执行以下检查：

1. **语法检查** - 运行 lint 检查代码是否存在语法错误
   ```bash
   npm run lint
   ```
   > 注：本项目使用 Next.js 16，已移除内置 eslint，lint 脚本会提示运行 typecheck

2. **类型检查** - 检查 TypeScript 类型错误
   ```bash
   npm run typecheck
   ```
   > 项目存在历史类型错误，重点关注新增的错误

3. **构建验证** - 快速验证能否通过编译
   ```bash
   npx next build
   ```

4. **测试运行** - 确保修改不破坏现有功能
   ```bash
   npm test
   ```

### 常见错误处理

#### JSX 语法错误
- **症状**：`Expected '</', got '{'`
- **原因**：JSX 注释未正确闭合 `{/* ... */}`
- **修复**：确保注释以 `*/}` 结尾

#### 开发服务器崩溃
- **症状**：`ENOENT: no such file or directory, open '.next/dev/routes-manifest.json'`
- **解决**：运行 `npm run dev`，脚本会自动清理缓存并重启

#### 数据库列不存在错误
- **症状**：`column knowledge_nodes.is_collaborative does not exist`
- **原因**：数据库迁移未执行，代码查询了不存在的列
- **解决**：
  1. 短期：修改 API 代码，移除对缺失列的查询（兼容模式）
  2. 长期：在 Supabase 中执行迁移文件 `supabase/migrations/*.sql`

### BodyMap 组件注意事项

- **CSS 动画**：只使用颜色过渡（fill/filter），禁止使用 transform: scale() 影响 SVG 路径
- **高亮逻辑**：悬停时只高亮当前肌肉，已选中的不再同时高亮（hover 优先级 > selected）
- **布局**：控制按钮放在身体图上方，使用 flex justify-end 右对齐

### 开发服务器

- 使用 `npm run dev` 启动（已配置自动缓存清理和错误恢复）
- 如遇崩溃，脚本会自动清理 .next/dev 缓存并重启
