# Web 教练套餐支付宝与微信支付（2026-10-05）

## 2026-10-06 最终执行方案和当前状态

用户要求停止来回列方案，明确当前实现与配置。执行方案固定为：CoachLink 网页教练套餐微信支付使用汇付 H5／PC 托管收银台，沿用现有汇付教练资金结算；支付宝原路径保留。本地业务代码一直是这条托管路径，本次没有改成微信直连。此前“项目号不是所有微信支付必需”的通用解释不代表已经切换代码或取消本项目所选托管路径。

当前网页微信不能真实付款：托管项目号未配、未部署、未验证真实手机付款／回调／履约／到账。桌面与手机均只完成本地代码和模拟验证，不能把电脑二维码展示说成电脑扫码已经可收款。

| 入口 | 配置并上线后代码提供的入口效果 | 已验证范围 |
| --- | --- | --- |
| 电脑网页 | 展示汇付收银台链接二维码，手机微信扫码进入收银台付款 | 二维码和查单模拟通过，实付未验 |
| 手机 Safari／Chrome 等 | 点击立即支付直接跳转移动收银台 | 跳转、返回与查单模拟通过，真实微信拉起未验 |
| 微信内网页 | 点击立即支付直接进入移动收银台，由收银台完成微信授权与支付 | 同上，实际授权／支付未验 |

需要完成的配置顺序：

1. 在汇付合作伙伴控台创建或复用 H5／PC 统一收银台托管项目，开通并选择所需微信支付方式，取得真实 `project_id`。
2. 按该托管项目要求完成微信渠道授权和支付目录配置；不是把当前小程序支付权限或网站微信登录 AppID 当作网页权限已开通。
3. 当前单源来源为 Apollo，将真实项目号配置为 `HUIFU_WEB_PAY_PROJECT_ID`。本日只读复核既有五项汇付基础字段均存在、NEXTAUTH_URL 存在、回调为 HTTPS 的 `/api/payment/wechat/notify` 且无查询参数；不要求重复填写已有基础密钥，也不把业务配置写进根 `.env`。
4. 使后端运行时配置生效并部署代码，然后受控验证电脑扫码、手机外部浏览器和微信内网页三条真实付款／返回／查单／订阅生效／到账链路。

这条已确定执行方案需要托管项目号，后续据此推进，不再因讨论通用直连选项来回改路径。若汇付明确无法支持目标场景，应先记录真实阻碍并与用户说明；不能靠模拟跳转宣称已经支持。当前仍无项目号或商户后台配置证据，本次只读复核和文档定案，没有 Apollo／商户配置写入或发布。

官方依据：[H5／PC 托管项目和开通要求](https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/hostingpay-preorder-h5-pc.md)。

## 2026-10-06 必需性复核（历史解释，执行方案以上方为准）

用户质疑是否必须申请托管项目。官方接口确实要求托管项目 `project_id`，但这是当前本地选择的汇付托管方案依赖，不是所有手机微信支付的通用要求。此前直接让用户补项目号，未先核查既有商户能力，选择依据不充分；托管是否最终采用仍需复核，不应把手机模拟跳转表述为真实手机微信支付已完成。

本日通过当前 Apollo 单源 bootstrap 只读检查：`WECHAT_PAY_MCHID`、`WECHAT_PAY_SERIAL_NO`、`WECHAT_PAY_API_V3_KEY`、`WECHAT_PAY_PRIVATE_KEY`、`WECHAT_PAY_PUBLIC_KEY` 均有配置，网站微信 AppID 和小程序 AppID 也有配置。仅检查存在性，未输出值、未验证密钥有效性、H5／JSAPI 产品权限、AppID 绑定或域名授权。

微信原生直连可分别接外部浏览器 H5 与微信内 JSAPI，不需要汇付项目号，但要确认商户对应权限／支付域名和授权目录。CoachLink 现有教练支付和资金结算经汇付，改成直连收款时不能继续无条件沿用汇付余额结算；现有资金流的兼容性也须核实。两个参考项目当前 Native 实现不证明 H5／JSAPI 权限已开通。

若最终选择托管，项目号来自汇付合作伙伴控台实际创建的 H5／PC 统一收银台项目，并配置到当前 Apollo。无需在方案复核完成前催促用户创建新项目。本次仅只读核对及文档纠正，未改业务源码、商户配置、Apollo 或发布状态。

来源：[汇付托管字段要求](https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/hostingpay-preorder-h5-pc-request.md)、[微信官方 H5 权限申请](https://pay.wechatpay.cn/doc/v3/merchant/4012791841)、[微信官方 JSAPI 授权目录](https://pay.wechatpay.cn/doc/v3/merchant/4013287088)。

用户已确认手机浏览器和微信内打开网页都需要支持。本地改为汇付 H5／PC 托管收银台接入，保留支付宝原路径。尚未提交、推送、部署或真实付款；当前 Apollo 缺少托管项目号，微信网页下单明确返回 503，不能称为已经可收款。

## 支付方式与纠正

- 参考项目 `D:/files/tokenhub` 与 `D:/files/jianwen-community` 使用微信直连 Native 扫码，不能当作 CoachLink 汇付聚合正扫的支持证明。两个参考项目仅只读，没有复制密钥或调用其业务订单接口。
- 前一版尝试汇付 `/v3/trade/payment/jspay` 的 `T_NATIVE`，只有模拟验证。当前聚合文档未列出普通间联 Native，该创建路径已撤换；`HUIFU_WECHAT_NATIVE_APPID` 不再用于本次接入。
- 现用官方 `/v2/trade/hosting/payment/preorder`、`pre_order_type=1`、`trans_type=T_JSAPI`。托管项目负责网页微信授权，不复用小程序或网站扫码登录的 openid。
- 手机浏览器和微信内均使用 `hosting_data.request_type=M`，点击支付后跳转签名响应里的 HTTPS `jump_url`；电脑使用 `P`，展示该收银台链接的二维码并查单。
- 手机收银台最终通过何种微信能力拉起取决于真实托管项目和汇付配置。本地没有接微信原生 `transactions/h5`，也没有把模拟跳转算作真实微信唤起成功。

## 实现与金额保护

- `/api/payment/wechat/web/create` 与支付宝入口共享 `src/lib/webPaymentOrder.ts`。微信只接受当前学员的 `pending_payment` 教练新购／续费业务订单；金额和周数由保存的订单决定。
- 缺少 `HUIFU_WEB_PAY_PROJECT_ID` 时，在创建支付记录和调用网关前拒绝，不退回未经验证的 Native，不返回虚构二维码。
- 提前保存 `payment_provider=wechat`、`huifu_payment_mode=hosting`、请求日期和 `T_JSAPI`；业务订单绑定 `platform_wechat`，沿用 CoachLink 汇付现金户、教练履约与结算。
- 返回本站 `/payment/[id]?provider=wechat&redirect=...`，仅接受站内相对业务返回路径。回到结果页不代表已付款，必须查单确认。
- 托管订单用 `/v2/trade/hosting/payment/queryorderinfo`；历史支付宝和小程序用原入口。检查业务码、原订单号／日期、最终订单状态和金额；可重试的失败尝试不当作整张托管订单最终失败。
- 两条查询入口和签名通知校验新 Web 订单金额，非成功结果不会覆盖已经支付的 Web 订单；历史公共支付宝查询入口也对新 Web 订单校验用户归属。
- 结果页操作按钮使用纯品牌色 `#CF6D4E`，active 只改透明度。未修改小程序、移动 APP、已有测试文件或数据库结构。

## 配置与实际阻碍

严格继续使用 `.env` 选择来源的单源配置。只读 bootstrap 检查当前为 Apollo，汇付五个必需基础字段和回调配置存在；`HUIFU_WEB_PAY_PROJECT_ID` 未设置，也没有其他既有汇付 hosting/project 配置键。没有输出密钥值。

需要在汇付合作伙伴后台创建真实 H5／PC 统一收银台托管项目、开通所需微信支付方式，并按官方说明配置微信授权域名 `api.huifu.com/hostingH5/`。将项目号写入当前配置来源，本机应为 Apollo 的 `HUIFU_WEB_PAY_PROJECT_ID`；不要把业务配置写进根 `.env` 或另加 `.env.local`。

已向用户请求已有项目号（非密钥），尚未收到。没有更改 Apollo、商户后台或支付域名。真实项目开通、手机唤起／付款／返回、异步通知、订阅生效和资金到账仍待验收；教练账户 readiness 不等于托管项目已开通。

## 本地验证

- `npm run lint` 正常退出，仅提示未配置 ESLint；`npm run typecheck` 通过。
- `npm test` 最终 75 文件、500 测试通过（并行会话新增了其他业务测试，本轮没有修改测试文件）；`npx next build` 编译和 547 页生成通过。最终源码修改后复跑均退出 0。
- 隔离后端 21 项通过：缺项目号零写入、PC／手机／微信浏览器类型、服务端价格和周数、归属／订单状态／绑定错误、网关失败、HTTPS 链接、站内返回地址、真实 RSA 加签验签、托管查询状态／订单匹配、历史支付宝和小程序兼容。
- 按 `web-devtools` 验证实际 PaymentDialog 与 PaymentPage，Vite＋Playwright 6 条交互通过、页面错误 0：电脑扫码及查单暂时失败恢复、支付宝保留、普通 iPhone 浏览器和含 MicroMessenger 浏览器同手机跳转／返回待确认／查单后成功、缺配置友好失败。截图已查看。
- 收银台是标注本地模拟的拦截页面，Next 导航钩子替换为浏览器导航；不能表述为真实汇付／微信付款或完整 Next 订阅 E2E。
- 现有完整 E2E 未执行：seed／cleanup 会写当前 bootstrap 指向的实际业务库，未提供隔离库。没有改测试配置或运行入口。前轮列举 4 个 E2E 用例不算执行通过。

最新证据：`artifacts/web-mobile-payment/2026-10-05/`，含 `backend-result.json`、`ui-result.json`、`runtime-readonly.json`、门禁日志和两种手机浏览器截图；旧 `artifacts/web-wechat-payment/2026-10-05/` 只保留前版模拟历史。验证进程已关闭，真实数据库写入与支付网关调用为 0。

## 官方依据

- [汇付官方 H5／PC 托管预下单](https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/hostingpay-preorder-h5-pc.md)
- [托管字段和 M／P 类型](https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/hostingpay-preorder-h5-pc-request.md)
- [托管交易查询](https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/hostingpay-query-payment-status-query.md)
- [汇付聚合微信支付场景](https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/aggregation-order-method-wechat.md)
- [微信官方 H5／JSAPI 浏览器边界](https://pay.wechatpay.cn/doc/v3/merchant/4012791845)

Next 包缺少要求的 `node_modules/next/dist/docs/`，本轮沿用现有 Node Route Handler 和官方说明，不改 Web bootstrap。

## 2026-10-06 配置操作说明

用户要求把抽象步骤变成具体操作。当前只核对官方公开说明及本地 bootstrap，没有登录或修改商户后台。

1. 登录接入现有汇付支付时的合作伙伴控台。官方开放平台入口 https://paas.huifu.com/open/home/index.html 。不要新注册或换商户；若仅有商户控台或没有托管配置入口，先由原服务商/汇付对接人确认操作账号和权限。
2. 在合作伙伴控台创建或复用 H5/PC 托管收银台项目，项目可命名 CoachLink 网页支付，确认微信渠道可选，取得真实 project_id。官方公开总览未给出这项功能的完整菜单路径，尚未看到用户登录后台，不伪造准确按钮位置。下一步需要用户打开后台并提供左侧菜单截图，以便按实际页面定位。
3. 官方微信配置路径为：合作伙伴平台→统一支付平台→商户→商户信息→目标商户查看→一体化支付→基础支付→微信支付详情→微信秘钥配置。该页管理 AppID、对应秘钥及支付授权目录。先读现有配置，不改小程序现有授权；H5/PC 项目所需 AppID、目录及大小写以该项目实际要求/汇付确认填写。不能将 api.huifu.com/hostingH5/ 不加区分填入所有名为域名的字段。
4. 项目号取得后由代理按当前环境配置 Apollo HUIFU_WEB_PAY_PROJECT_ID；本机 bootstrap 只读确认 app_id=coachlink、cluster=local、namespace=app-config。它们只代表本机选中的环境，不能直接当作生产配置目标。当前未写 Apollo，部署和真实付款验收仍未执行。

没有后台权限/入口时可复制给原汇付技术对接人：CoachLink 沿用现有汇付商户和教练结算，需 H5/PC 托管收银台，覆盖电脑微信扫码、手机 Safari/Chrome 同机付款、微信内网页付款。请确认三场景支持情况，协助创建或复用托管项目、提供 project_id，并明确所用 AppID 和授权目录配置。

官方来源：
- https://github.com/huifurepo/dg-payment-skills/blob/main/huifu-pay-integration/references/hostingpay-preorder-h5-pc.md
- https://paas.huifu.com/bbs/topic/16/appid-%E6%8E%88%E6%9D%83%E7%9B%AE%E5%BD%95%E9%85%8D%E7%BD%AE-%E5%90%88%E4%BD%9C%E4%BC%99%E4%BC%B4%E6%8E%A7%E5%8F%B0%E6%93%8D%E4%BD%9C%E6%8C%87%E5%BC%95
- https://paas.huifu.com/cms/details/gCpH6djOI.html （官方技术支持 400-820-2819 / cs@huifu.com）
