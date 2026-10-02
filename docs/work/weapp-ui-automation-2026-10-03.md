# 微信小程序自动切页与截图验收

已跑通 CoachLink 的真实自动化截图，用户无需逐页切换或截图。本轮使用已登录的微信开发者工具、同一项目及官方 `miniprogram-automator`；没有模拟业务数据或接管桌面输入。

## 实测结果

1. 训练首页：路由及截图正确。
2. 教练：实际点击底部入口、确认路由切换，等待骨架消失；截图显示真实的十位教练列表。
3. 知识：实际点击底部入口；截图包含训练计划和精选好文。
4. 工具箱：实际点击底部入口；截图显示工具卡片。
5. 我的：实际点击底部入口；最终截图显示已登录身份与 13/3/11 的实际统计。

连续两轮得到 10 张截图；自动重开项目后再跑一轮得到 5 张；修正启动阶段 SDK 悬挂连接退出问题和个人统计零值等待后，最终从启动开始再跑一轮得到 5 张，进程退出码 0。20 张文件已逐张查看：19 张作为加载后的页面证据，首轮我的页三项零值的一张仅作为加载过渡证据。末次运行包含启动、运行时就绪、实际导航校验、PNG 文件与尺寸校验、截图后路由复核，最终回到训练首页。原始记录在 `artifacts/uiux-audit/2026-10-03/final-unattended/manifest.json`。

## 可复跑命令

在仓库根目录执行：

```powershell
node scripts/weapp-ui-audit.cjs
```

默认自动启动同一项目，并通过五个主页面两次；产物目录含截图、启动日志和 manifest。保留当前会话时使用 `--connect-only`；可以通过 `--output` 指定独立输出目录，`--cycles 1` 执行一轮。Windows CLI 路径可用 `--cli` 或 `WECHAT_DEVTOOLS_CLI` 指定；SDK 可用 `--sdk` 或 `WEAPP_AUTOMATOR_PATH` 指定。脚本优先读取本地 SDK，否则复用已安装 mrc 内的 SDK，没有新增依赖。

此脚本操作的是模拟器内部元素；没有桌面鼠标、键盘或屏幕坐标输入。CLI 开窗会显示项目窗口，不能保证对当前前台窗口的焦点毫无影响。已有微信工具登录和正常的小程序登录态是前提；不跳过登录/安全确认，不伪造身份。自动启动仅重开指定项目，不退出整个开发者工具、清缓存、上传或发布。

## 诊断边界

早期只看接口 success、单次图片或默认窗口状态不足以证明流程成功。同一个 DevTools 进程存在多个同名项目窗口，曾经匹配到另一个应用，该图已拒收。旧 CLI 使用不同路径表示时出现无法按项目路径识别的上下文；最终脚本统一 Windows 绝对路径，并实际等待运行时就绪，不用任意固定等待冒充启动完成。之前所有超时的单一根因仍未完全确认。

截图文件名必须与截图后实际路由一致；画面仍需检查。页面初始骨架不作为正常内容；统计全部为零时给予有界等待，仍为零会保留“加载完成不确定”的标记，不假造数值。

本轮已验证五个一级页面，不等于 124 个注册页、教练权限页、训练写入路径、真机相机及 Web/App 的全面验收。UI/UX 审查仍在继续。

## 当前真实截图

### 1. 训练首页

![自动截图：训练首页](D:/files/coachlink/artifacts/uiux-audit/2026-10-03/final-unattended/01-pages-index-index.png)

### 2. 教练

![自动截图：教练](D:/files/coachlink/artifacts/uiux-audit/2026-10-03/final-unattended/02-discovery-index.png)

### 3. 知识库

![自动截图：知识库](D:/files/coachlink/artifacts/uiux-audit/2026-10-03/final-unattended/03-content-knowledge.png)

### 4. 工具箱

![自动截图：工具箱](D:/files/coachlink/artifacts/uiux-audit/2026-10-03/final-unattended/04-toolbox-index.png)

### 5. 我的

![自动截图：我的](D:/files/coachlink/artifacts/uiux-audit/2026-10-03/final-unattended/05-me-profile-index.png)
