# 单杠地图海外点位

用户确认希望小程序支持标记国外单杠。本轮范围是本地源码、迁移准备与验证，未获得生产迁移/部署/上传授权。

## 最新追加：搜索与地图直接选点

用户纠正手填经纬度不能作为主体验。本轮在既有地图页增加选点模式，不新增路由：添加页主按钮“搜索 / 地图选点”；搜索城市、公园或地址，选择结果后地图定位，再点击地图、原生POI或“选取地图中心”，确认后自动回填坐标与已知区域信息。没有搜到也能直接拖动地图选点；经纬度输入折叠在备用入口。选点不提交云端，只把确认结果先存本地用户草稿，提交按钮仍负责正式保存。

地名搜索经CoachLink自身API代理Photon，前端不直连第三方、不新增微信请求域名；主动按搜索才请求，不做输入联想连发。服务端按查询缓存24小时、合并并发相同查询，每进程上游节流1.5秒，最多256缓存项；小程序复用60天缓存，最多20项搜索缓存，云端最新结果覆盖。搜索失败仍可地图选点。`STREETLIFTING_PLACE_SEARCH_URL` 是可选服务端业务配置，默认 `https://photon.komoot.io/api/`；按现有local/Apollo单源规则提供，不读第二份env或把密钥放到客户端。

[Photon官方说明](https://github.com/komoot/photon#demo-server)允许合理使用公共服务，但没有可用性保证、过量会限流；访问量扩大时应切换自有或有保障的兼容服务。地址数据 © OpenStreetMap contributors，页面已注明来源。海外底图仍由微信地图提供，地名搜索结果并不等于其底图覆盖已验收。

新增 `src/lib/locationSearch.test.ts` / `locationSearchRoute.test.ts` 共9项测试通过：GeoJSON经纬顺序、海外原始WGS84、南纬/西经、非法/重复候选、缓存/节流/失败重试/上游切换与认证输入边界。未改既有测试。最终69文件443测试全通过；第一次旧会员导入超时已在编译/UI运行结束后独立串行复验通过。根/core类型、新API扩展类型检查0错误，完整小程序仍有历史错误、相对HEAD新增0。

最终Next546页、小程序2893模块/124页构建通过；产物含搜索、确认、主选点入口与备用经纬度入口，实际开发API仅localhost:3001。使用现有真实小程序登录的只读请求已确认本地search-places返回200、代代木公园/日本/Tokyo与35.6714052,139.6951716，保留WGS84来源。证据 `picker-next-build.log`、`picker-weapp-build.log`、`picker-tests-final.log`、`picker-api-types.json`、`picker-package-verification.json` 和 `picker/ui-manifest.json` 在同一artifacts目录。

新的自动化脚本 `scripts/verify-streetlifting-location-picker-ui.cjs` 使用真实搜索→选择→地图中心→确认→回填，finally恢复原用户草稿，不创建业务点位；`--picker-only` 只做搜索和地图中心，不计返回表单通过。本轮完整流程第一次找不到主入口元素，等待后第二次automator response超时；单独目标页仍缺搜索输入框。wechatide-skill0.3.2版本/登录门禁通过后，正常刷新原项目一次，再试仍缺主入口元素。最终没有有效目标截图/完整交互证据，不能确认新代码在运行时的渲染，亦不能把原因直接归为缓存。源产物包含新控件。证据 `picker/ui-manifest.json`、`picker/picker-only-manifest.json`。没有关闭/重开工具或模拟地图坐标事件，现有用户草稿已恢复。

## 原因与改动

原添加页唯一的坐标入口是 `Taro.chooseLocation()`；海外地点搜索失败时没有备用方式。区域字段只有省市区，原地图默认国内中心，不能形成完整海外录入流程。不能据此推断微信地图在所有国家都不能选点。

- 添加页允许任意国家/地区名称，提供常用国家快捷选择；省/州与区县选填，城市及地址不限定中国行政区。
- 保留微信地图选点，加经纬度手动输入（纬度在前，经度在后），支持南纬/西经和零坐标；原生选点失败会显示备用入口，取消选点不提示失败。
- 手动坐标按 GPS / Google 海外地图的 WGS84 明确标记；微信原生选点标记 GCJ02。历史坐标保持未知来源，不批量转换历史数据。小程序渲染、附近距离与打开地图使用共享转换；明确海外国家的坐标不应用中国偏移。
- 经度/纬度预览直接进入小程序地图并定位到点位，返回保留表单草稿，不依赖外国地名搜索；列表“查看地图”也直接定位。地图支持世界视角与拖动浏览，原系统地图导航保留，第三方国外底图、搜索及真机导航覆盖不作保证。
- 数据库新增 nullable `country` / `coordinate_system`；创建、修改、列表、分享与 map-pins 保留元数据，支持国家筛选及国家关键字搜索。旧客户端未发送新字段时不覆盖新元数据；map-pins 有迁移前的旧列查询兼容。
- 复用一个点位缓存入口 `streetlifting_location_cache_v1`：列表先读本地、后台读云端并覆盖，按条目 savedAt 裁剪60天、列表最多20个查询缓存。提交前先持久化按用户隔离的草稿，失败后新增/编辑可恢复，云端成功后清草稿；不自动重试创建真实点位。

迁移由 Supabase CLI 生成：`supabase/migrations/20261002175648_streetlifting_locations_global.sql`。时间戳为 CLI 使用的 UTC；用户侧日期为北京时间 2026-10-03。

## 验证与上线

- lint 脚本仅提示未配置；根 typecheck 与 core typecheck 通过。
- 新增17项坐标/输入回归及4项缓存回归；最终串行运行全量67文件434测试通过，未改已有测试文件。并行构建期间的一项旧测试冷导入超时已在构建结束后复验通过。
- 扩展类型检查覆盖本次API源文件及完整小程序：相对HEAD的API新增错误0，小程序历史诊断430→428、新增0；完整小程序仍有428项历史错误，不能称其全量类型检查干净。
- 隔离 PostgreSQL 已验证迁移、国家查询、西经/南纬、更新、删除及历史空 metadata；事务回滚、残留表0、临时容器删除，没有写真实数据。
- Next build 545页编译通过；最终小程序2892模块构建通过，124个注册页面JS/WXML/JSON完整。最终开发包只含localhost:3001，不含localhost:3000；当前本地health、列表和map-pins只读请求成功。
- 开发者工具验证已尝试两次：第一次reLaunch回执后实际未进入目标页，第二次 timeout waiting for automator response；没有本轮有效PNG或地图交互证据。最后只读SDK当前页返回首页，目标页仍未验收。同一9420会话正在供另一个UI审查使用，本轮未关闭/重开或继续接管，避免相互干扰。海外地图实际画面、底图覆盖、真机搜索与系统地图导航尚未验证。

本地证据在 `artifacts/streetlifting-global/2026-10-03/`：`tests-final-serial.log`、`weapp-final-build.log`、`typecheck.json`、`package-verification.json`、`ui-manifest.json`。后续在工具会话可独占时运行 `node scripts/verify-streetlifting-global-ui.cjs`，确认实际路由、PNG、伦敦中心及世界视角；脚本不提交真实点位。

正式生效需先应用迁移，再更新 API，最后上传/发布新的小程序包；不能只上传小程序。当前未提交/推送/生产迁移/部署/体验版上传/提审。
