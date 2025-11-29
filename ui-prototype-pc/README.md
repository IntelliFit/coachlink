# CoachLink 前端原型（PC）

这是一个纯 HTML/CSS/JS 的高保真交互原型，用于演示 CoachLink 的学员端/教练端/管理员端的关键流程：教练申请、角色切换、学员管理、计划编辑与档案查看等。

## 运行方式

你可以任选一种方式运行：

1) 直接双击打开
- 直接在浏览器打开 `index.html`（file://）。
- 适合快速预览。

2) 启动本地静态服务器（推荐）
- **推荐使用 `http-server`**:
  ```bash
  npx --yes http-server -p 8080 -c-1
  ```
  然后访问 `http://localhost:8080/`
  - `-c-1` 禁用缓存，确保每次都加载最新文件
  - `http-server` 不会修改 URL 或重定向，保证查询参数正常传递

- 其他可用方案:
  - VS Code Live Server 插件
  - Python: `python -m http.server 8080`

- ⚠️ **不推荐使用 `serve`**:
  - `serve` 的 "clean URLs" 功能会在重定向时丢失查询参数
  - 例如访问 `plan-editor.html?clientId=xxx` 可能被重定向到 `plan-editor`，导致 `clientId` 丢失
  - 如果必须使用 `serve`，请访问不带 `.html` 后缀的 URL（如 `plan-editor?clientId=xxx`）

- ⚠️ **不要使用 Next.js/Vite 等框架的 dev server**:
  - 这些框架有自己的路由系统，会干扰静态 HTML 的正常访问

## 体验账号（人物画像）
- 马六（student_001）: 纯学员，已订阅 张教练 与 李明教练
- 王五（student_004）: 学员，教练申请审核中
- 李明（dual_role_001）: 学员+教练（已通过申请），学员仅订阅张教练（不会订阅自己）
- 张教练（coach_001）: 教练+学员（教练端有学员；学员端无任何订阅，呈空状态）
- 管理员（admin_001）: 审核教练申请以及审核排行榜提交的成绩

登录入口在 `index.html`，页面内提供了以上人物的快捷按钮。右上角头像下拉包含：我的订阅、消息中心、教练申请、切换到教练端/学员端（仅双角色显示）。

## 主要页面与流程

### 学员端（`student/`）
- 教练申请（`student/coach-application.html`）
  - 流程状态：草稿、已提交（审核中）、通过、拒绝
  - 通过后，头像菜单出现“切换到教练端”；页面内也会显示“进入教练端”按钮
- 发现教练（`student/discover-coaches.html`）
  - 动态读取 `MockData.coaches`，管理员通过后新增的教练会出现在列表中
- 我的训练（`student/dashboard.html`）
  - 今日训练与周进度，基于用户订阅的教练动态渲染
  - 若无订阅则显示“暂无订阅的教练”的空状态
- 训练计划（`student/plan.html`）
  - 按已订阅教练切换查看整周计划；无订阅时显示空状态
- 个人档案（`student/profile.html`）
  - 个人信息、力量数据、进步趋势、时间线、教练观察与建议等均为动态渲染
  - 无订阅/无数据时提供合理的空状态文案

### 教练端（`coach/`）
- 学员管理（`coach/clients.html`）
  - 从 `Store.get('clients')[coachProfileId]` 读取当前教练的学员
  - 已“初步制定”计划的学员显示“查看/调整”；未制定显示“制定计划”
  - 点击“查看/调整”进入计划编辑器的“学员模式”（见下）
- 计划编辑器（`coach/plan-editor.html`）
  - 双模式：
    - 学员模式（URL 带 `clientId`）
      - 标题为“{学员名} 的训练计划”，显示“学员档案”按钮（右侧抽屉面板）
      - 隐藏“保存模板”，展示已制定的训练内容与执行记录（若有）
    - 模板模式（URL 带 `id` 或 `mode=new_template`）
      - 用于新建/编辑计划模板，显示“保存模板”按钮，可管理周/日、导入周等
- 动作库（`coach/library.html`）
  - 供计划编辑器选择动作（当前示例数据来自 `Store.get('exercises')`）

### 管理端（`admin/`）
- 教练申请管理（`admin/coach-applications.html`）
  - 查看申请详情并执行通过/拒绝
  - 通过后，申请人将获得 `coach` 角色，出现在可发现的教练列表中

## 关键数据与存储
所有 mock 数据位于 `js/mock_data.js`，并通过 `localStorage` 模拟持久化：
- 用户与角色
  - 用户包含 `roles`（如 `['student']`、`['student','coach']`）与当前激活 `role`
  - `UserService` 与 `RoleManager` 负责登录状态与角色切换（存于 `localStorage`）
- 教练与档案
  - `MockData.coaches`、`MockData.coachProfiles` 定义教练列表与主页信息
- 订阅
  - 李明（双角色）仅订阅张教练；教练不会订阅自己
- 学员列表（教练侧）
  - `clients` 为“按教练档案ID分组的对象”：`{ coachProfileId: Client[] }`
  - 每个学员记录包含 `hasPlan`、`plan`、`subscriptionMonths`、`tier` 等
- 计划数据
  - `clientPlans`：以“学员ID”为键（如 `student_liming`、`student_maliu`）保存完整周计划
  - `clientExecution`：以“学员ID”为键保存执行记录（示例包含卧推/深蹲的反馈）
- 学员档案数据
  - `studentProfiles`：以“学员ID”为键，提供基本信息/力量数据/时间线/教练备注等
- 初始化与重置
  - 为避免本地缓存陈旧，`Store.init()` 会将 `MockData` 全量写入 `localStorage`
  - 如需“恢复出厂设置”，可清空浏览器 `localStorage` 后刷新页面

## 导航与交互要点
- 侧边栏仅显示当前角色相关的菜单项
- 头像下拉：学员在未获得教练角色或申请中/被拒时显示“教练申请”；双角色显示“切换到教练端/学员端”
- `clients.html` 跳转到 `plan-editor?clientId=...`（无 `.html` 后缀），保证在多数静态服务器下保留查询参数

## 重要文件速查
- 入口：`index.html`
- 全局脚本：`js/app.js`（导航、权限、菜单）、`js/mock_data.js`（数据、存储、服务）
- 学员端：`student/dashboard.html`、`student/plan.html`、`student/profile.html`、`student/coach-application.html`
- 教练端：`coach/clients.html`、`coach/plan-editor.html`、`coach/library.html`
- 管理端：`admin/coach-applications.html`

## 已知限制
- 本原型仅为前端演示，所有数据来自 `localStorage`，无真实后端
- 模板库/动作库为示例实现，未接入真实内容管理能力

## 故障排除

### 计划编辑器显示"未命名模板"而不是学员计划
1. **检查静态服务器**：确保使用 `http-server` 而非 `serve`
2. **清除浏览器缓存**：按 `Ctrl+Shift+R`（Windows）或 `Cmd+Shift+R`（Mac）强制刷新
3. **检查 localStorage**：在浏览器控制台执行 `localStorage.getItem('currentViewingClientId')` 查看是否有值
4. **重置数据**：清空 `localStorage`（控制台执行 `localStorage.clear()`）后刷新页面

### 不同电脑/浏览器无法正常使用
- 本原型使用 `localStorage` 存储状态，不同浏览器/电脑的数据是独立的
- 首次访问时，`Store.init()` 会自动初始化所有 mock 数据
- 如果数据异常，清空 `localStorage` 后刷新即可恢复默认状态

### 从 GitHub 下载后无法运行
- 确保使用静态服务器运行（不要直接双击打开 HTML 文件）
- 推荐命令：`npx --yes http-server -p 8080 -c-1`
