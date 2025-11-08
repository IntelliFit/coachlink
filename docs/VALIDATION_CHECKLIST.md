# 训练执行系统验证清单

## 📋 部署步骤

### 1. 数据库执行
```sql
-- 在 Supabase 控制台执行以下SQL
-- 文件：supabase/migrations/20250811000001_create_coach_rulepacks.sql
-- 文件：supabase/migrations/20250811000002_create_training_execution_tables.sql

-- 如果已执行，检查表是否存在：
SELECT * FROM coach_rulepacks LIMIT 1;
SELECT * FROM training_sessions LIMIT 1;
SELECT * FROM training_progress LIMIT 1;
SELECT * FROM personal_records LIMIT 1;
SELECT * FROM training_reminders LIMIT 1;
```

### 2. 依赖安装
```bash
# 确保安装了必要的依赖
npm install lucide-react
npm install react-router-dom
```

### 3. 路由设置
在 App.tsx 中添加路由：
```tsx
import TrainingHub from './components/TrainingHub';

// 在路由中添加
<Route path="/training/:trainingPlanId" element={<TrainingHub userId={userId} trainingPlanId={useParams().trainingPlanId!} />} />
```

## 🔍 验证步骤

### Phase 1: 基础功能验证

#### ✅ 1. 数据库验证
- [ ] 检查所有新表是否创建成功
- [ ] 验证表结构是否正确
- [ ] 确认索引和触发器已创建

#### ✅ 2. 组件加载验证
- [ ] AITrainingPlanService 不再报错
- [ ] TrainingHub 组件正常渲染
- [ ] 所有子组件正常加载

### Phase 2: 功能流程验证

#### ✅ 3. 动作域选择验证
1. 进入教练详情页
2. 点击"AI训练计划"
3. 应该看到：
   - 动作域选择（负重引体/负重臂屈伸/组合）
   - 能力评估表单

#### ✅ 4. 训练计划生成验证
1. 选择动作域
2. 填写评估数据（BW次数、1RM等）
3. 点击生成计划
4. 验证：
   - 计划按规则引擎生成
   - 显示周历/日卡片预览

#### ✅ 5. 训练执行验证
1. 点击"开始训练"按钮
2. 跳转到 `/training/[planId]`
3. 验证：
   - 今日训练显示正确
   - 可以开始/暂停/完成训练
   - 可以记录组数、重量、RPE

### Phase 3: 数据验证

#### ✅ 6. 数据记录验证
```sql
-- 检查训练会话数据
SELECT * FROM training_sessions WHERE user_id = '你的用户ID' ORDER BY created_at DESC;

-- 检查训练动作数据
SELECT * FROM training_exercises te 
JOIN training_sessions ts ON te.training_session_id = ts.id 
WHERE ts.user_id = '你的用户ID';

-- 检查进度统计
SELECT * FROM training_progress WHERE user_id = '你的用户ID';

-- 检查个人记录
SELECT * FROM personal_records WHERE user_id = '你的用户ID' ORDER BY date_achieved DESC;
```

#### ✅ 7. 进度仪表盘验证
1. 在训练Hub中点击"训练进度"
2. 验证：
   - 显示训练统计卡片
   - 周进度图表正确
   - 个人记录显示正确

## 🧪 测试用例

### 测试用例1：负重引体计划
```
动作域：weighted_pullup
BW最大次数：8次
1RM：+20kg
技术评估：肩胛控制良好
预期：生成6周负重引体周期计划
```

### 测试用例2：训练执行
```
1. 查找今日训练
2. 开始训练会话
3. 完成一组负重引体：5次，+15kg
4. 记录RPE：7
5. 完成整个会话
6. 检查进度更新
```

## 🐛 常见问题排查

### 问题1: 空白页面/组件报错
- [ ] 检查控制台错误信息
- [ ] 确认所有依赖已安装
- [ ] 检查user_id是否正确设置

### 问题2: 数据库连接失败
- [ ] 检查Supabase配置
- [ ] 确认环境变量设置正确
- [ ] 验证数据库权限

### 问题3: 训练计划未生成
- [ ] 检查coach_rulepacks表中是否有对应教练的规则包
- [ ] 验证规则包key是否正确（weighted_pullup_6w等）

## 📊 验证成功标准

- [ ] 无JavaScript错误
- [ ] 所有功能按钮可点击
- [ ] 数据正确保存到数据库
- [ ] 训练进度实时更新
- [ ] 用户界面响应正常

## 🔧 快速修复命令

如果还有问题，运行：
```bash
# 清理并重新安装依赖
npm run clean
npm install

# 启动开发服务器
npm run dev
```

## 📞 技术支持

如果遇到无法解决的问题：
1. 检查浏览器控制台错误
2. 查看网络请求的响应
3. 确认Supabase项目配置
4. 提供具体的错误信息给我