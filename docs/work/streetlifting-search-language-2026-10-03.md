# 单杠备用搜索英文回填（2026-10-03）

用户最新截图：搜索北京大学后可以回填，名称Peking University，地区Beijing/Haidian，地址颐和园路5号与英文地区拼接。不能以此宣称此前微信原生空返回已恢复；此格式对应备用Photon搜索。

核对src/lib/globalPlaceSearch.ts，实际请求固定lang=en，与用户日本所在地/梯子无关。真实同机API对比：同一北京大学查询，lang=en返回Peking University/Beijing/Haidian；移除lang后返回北京大学/北京市/海淀街道，两者第一个结果坐标均116.3039468/39.9918215。没有伪造翻译或修改实际坐标。

已移除服务端强制英文；服务端与小程序搜索缓存增加local-names标识，避免24小时缓存中的旧英文被先展示和选中。实际修改后的searchGlobalPlaces返回“颐和园路 5号 · 海淀街道 · 北京市 · 中国”，海外London仍有英国结果。证据photon-local-language-result.json和check-local-place-names.ts（真实网络返回，无mock）。现有反查/缓存/鉴权4项相关测试通过，未改测试文件；TS转译语法0/diff检查通过。最终本地小程序构建2897模块通过，未上传新包/部署外部dev服务/写真实点位。

官方开发者工具完整真实备用搜索验证通过：先备份用户当前Peking University自动草稿，原生空返回及继续弹窗使用受控模拟，只为进入备用地图；搜索网络、接口结果及回填未mock。输入北京大学→真实localhost:3001后端→中文结果→选择与原草稿经纬度完全相同的第一项→确认→中文名称/地区/地址进入真实表单；两个PNG已逐一查看，chinese-search-ui-report.json passed=true/searchResponseMocked=false/automaticNameChinese=true/automaticAddressChinese=true/samePointPreserved=true/userChangesPreserved=true/submitted=false。原用户手改字段必须保留；本次用户英语字段均等于自动字段标记，真实中文结果已更新其当前本地草稿，停留中文表单供用户查看，没有提交上传。原生mock与showModal均restore，原有真实诊断和其他用户缓存恢复，backup文件chinese-search-current-draft-backup.json可恢复。

首次验证用mock函数throw导致SDK没有完成原生Promise，产生等待地图超时；实际失败PNG已查看。随后使用已验证可完成的空返回模拟，完整真实搜索通过。这是验证工具的mock行为，不把它冒称为业务原生空返回根因。此前真正微信原生选择空返回仍未查明；本轮证明的是备用搜索实际中文回填。

Photon官方语言说明：https://github.com/komoot/photon/blob/master/docs/api-v1.md#adjust-language 。不指定语言且不传Accept-Language时使用服务端默认，通常为地点本地名称；本次真实查询已确认中国结果为中文。不是把所有海外文字承诺自动翻译为中文。
