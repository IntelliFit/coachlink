# CoachLink Apps 结构与 APP 迁移规范

## 目录结构

CoachLink 采用与 `food_link` 一致的移动端目录模型：

- `apps/wechat/`：微信小程序，Taro + React。
- `apps/mobile/`：移动 APP，Expo + React Native。
- `packages/core/`：平台无关类型和业务常量。
- `packages/api-client/`：跨端 API client，注入平台 request/token storage adapter。

根目录不要再新建 `app/` 或恢复 `wechat_app/` 作为源码目录；Next.js 主站路由仍以 `src/app/` 为准。

## APP 技术方案

`apps/mobile` 对齐 `food_link/apps/mobile` 的工程方案：

- Expo SDK `~56.0.0`
- React `19.2.3`
- React Native `0.85.3`
- React Navigation 7：Bottom Tabs + Native Stack
- `@react-native-async-storage/async-storage` 做本地登录态与后续移动端缓存
- `lucide-react-native` 做图标
- `expo-file-system`、`expo-image-picker`、`expo-clipboard` 预留文件、图片和剪贴板能力

APP 标识默认值：

- package：`@coachlink/mobile`
- slug：`coachlink-mobile`
- scheme：`coachlink`
- Android package / iOS bundle id：`cn.coachlink.app`

## 常用命令

```bash
npm install
npm run dev:mobile
npm run typecheck:mobile
npm run mobile:android
npm run mobile:ios
npm --workspace apps/wechat run build:weapp
```

`dev:mobile` 会启动 `scripts/start-mobile-dev.cjs`，自动选择局域网 IP，并把 `EXPO_PUBLIC_API_BASE_URL` 指向本机 CoachLink Web API。默认 API 端口是 `3000`，可用 `MOBILE_DEV_API_PORT` 覆盖。

## API 与登录态

APP 不直接访问 Supabase。所有数据通过 Web API：

- 登录复用 `/api/miniapp/login`，返回 `user + token`。
- 注册复用 `/api/auth/register`，注册成功后再密码登录。
- 短信复用 `/api/sms/send-verification-code`。
- 鉴权请求统一加 `Authorization: Bearer <token>`。

移动端本地键：

- `coachlink_mobile_access_token`
- `coachlink_mobile_user`
- `coachlink_mobile_user_id`

## 从小程序迁移功能到 APP

每次迁移一个功能时按这个顺序走：

1. 先判断逻辑是否平台无关。平台无关的类型、计算、数据归一化放到 `packages/core`。
2. API 调用放到 `packages/api-client`，不要在 APP 页面里散写 fetch。
3. 页面交互在 `apps/mobile/src/screens` 实现，导航类型同步更新 `src/navigation/types.ts`。
4. 本地缓存优先使用 AsyncStorage，并沿用移动端 60 天缓存原则。
5. 小程序里的 `Taro.*` 能力要替换成 RN/Expo 等价能力，不要把 Taro 依赖带进 APP。
6. 完成功能后至少运行 `npm run typecheck:mobile`，涉及小程序共享改动时同时跑 `npm --workspace apps/wechat run build:weapp`。

## 当前初始化状态

首版 APP 已完成工程壳、登录态、五个底部入口和占位业务页。尚未迁移完整小程序页面；后续优先迁移训练首页、训练执行、工具箱中街健指数和功率视频分析。
