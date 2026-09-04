# CoachLink 移动 App API 鉴权审计（2026-09-04）

## 结论

移动 App 的登录与会话恢复已经在 Android Release 包中实测通过，但训练写入链路仍存在服务端鉴权不一致：App 统一发送 `Authorization: Bearer <token>`，部分 API 仍只调用 `getServerSession()` 读取网页 Cookie。对这些接口，按钮和客户端事件即使正确绑定，也可能在线上返回 401。

本轮没有批量修改生产 API 的鉴权边界。原因是这会同时影响对象所有权、教练/学员角色判断和网页现有会话，需要逐路验证，不能通过机械替换上线。

## 已确认的高优先级接口

以下路由已逐文件确认只读取 `getServerSession()`，而对应 App 页面通过 Bearer Token 调用：

- 计划训练：`/api/execution/complete-set`、`/api/execution/complete-item`、`/api/execution/finish`。
- 计划训练扩展组：`/api/execution/extra-content/add-extra-set`（同目录其他增删接口需逐路复核）。
- 即兴训练：`/api/impromptu/start`、`/api/impromptu/get`、`/api/impromptu/complete-set`、`/api/impromptu/finish`。
- 即兴训练视频：`/api/impromptu/upload-set-video`、`/api/impromptu/add-set-video-link`。

这组接口应作为下一轮 P0：统一使用已存在、能同时兼容 Cookie 与 Bearer 的身份解析函数，并继续执行现有的 `student_id === userId` 等对象所有权检查。

## 仅静态可疑，不能直接判定故障

静态扫描还命中了购物车、教练聚合、学员动作库、街健、支付查询、工具箱和部分用户接口。这里包含公开接口、内部自行校验 Token 的接口以及可能确有遗漏的接口，必须逐个阅读调用端和服务端后分类，不能直接批量替换。

特别说明：公开动作列表等接口允许未登录读取属于预期行为，不能因为没有 `getApiUserId` 就判断为漏洞。

## 推荐实施顺序

1. 为身份解析建立覆盖 Cookie、有效 Bearer、无效 Bearer、过期 Bearer、Cookie/Bearer 冲突的接口级测试。
2. 先改计划训练和即兴训练 P0 路由；每路保留对象所有权与角色校验。
3. 用专用测试账号创建一次可清理的执行记录，覆盖开始、完成组、附加组、视频、结束；在 `finally` 删除所有测试数据。
4. 再处理教练、动作库、支付和工具箱，避免一次扩大鉴权面。
5. 数据库迁移 `20260904_create_impromptu_execution_set_videos.sql` 与服务端部署完成后，才对外宣称即兴训练视频完整可用。

## 本轮验证边界

- 已验证：教练账号密码登录、登录后即时进入首页、强制停止后会话保持、只读教练页面导航、退出登录。
- 已验证：游客知识页、本地参考计划详情、原始来源外链。
- 未执行：真实训练写入、点评、提现、角色切换、短信发送、密码重置、支付、订单与数据库迁移。
- 线上状态：本轮后端改动和迁移均未部署，因此 APK 中依赖新服务端能力的功能不能视为线上闭环。
