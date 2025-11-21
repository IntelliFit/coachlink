# CoachLink Frontend Prototype

这是一个纯 HTML/CSS/JS 的高保真原型，展示了 CoachLink 的核心功能流程。

## 如何运行

直接在浏览器中打开 `index.html` 文件即可。无需安装任何依赖或服务器。

## 包含的功能模块

### 1. 登录页 (`index.html`)

- 模拟登录入口，可选择"我是教练"或"我是学员"。
- 默认账号密码已预填。

### 2. 教练端 (`coach/`)

- **工作台 (`dashboard.html`)**: 核心数据概览与动态。
- **动作与模板库 (`library.html`)**: **[核心缺失功能]** 管理动作库和计划模板。
- **计划编辑器 (`plan-editor.html`)**: **[核心缺失功能]** 可视化的周计划编辑器。
- **学员管理 (`clients.html`)**: 学员列表与状态。

### 3. 学员端 (`student/`)

- **我的训练 (`dashboard.html`)**: 周视图与今日计划。
- **训练进行中 (`execution.html`)**: **[核心缺失功能]**
  沉浸式训练执行模式（暗色模式）。
- **个人档案 (`profile.html`)**: 数据统计。

## 技术说明

- **零依赖**: 仅使用了 `Lucide Icons` (CDN) 用于图标。
- **Mock Data**: 数据存储在 `js/mock_data.js`，使用 `localStorage`
  模拟数据持久化。
- **样式**: 使用 CSS Variables 实现主题化，易于扩展。
