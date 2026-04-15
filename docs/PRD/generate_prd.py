#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CoachLink 前端 PRD 文档生成脚本
生成小程序端 + Web 端所有页面的 PRD 文件，并以相对路径连接成树状结构。
"""

import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def write_file(path, content):
    full_path = os.path.join(BASE_DIR, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

# ==================== 数据定义 ====================

weapp_auth = [
    {
        "id": "login",
        "title": "登录页",
        "route": "/auth/login",
        "summary": "用户登录入口，支持密码/验证码双模式登录及微信手机号快捷登录。",
        "interactions": [
            ("密码登录/验证码登录切换", "tab", "切换登录模式，清空对应输入", None),
            ("手机号或邮箱输入框", "input", "输入账号", None),
            ("登录密码输入框", "input", "输入密码（仅在密码登录模式显示）", None),
            ("验证码输入框", "input", "输入6位验证码（仅在验证码登录模式显示）", None),
            ("获取验证码按钮", "button", "触发滑块验证后发送短信/邮件验证码，带60秒倒计时", None),
            ("用户协议勾选框", "checkbox", "同意用户服务协议和隐私政策", None),
            ("《用户服务协议》", "link", "跳转协议页", "./terms.md"),
            ("《隐私政策》", "link", "跳转隐私政策页", "./privacy.md"),
            ("立即登录按钮", "button", "校验后执行登录，成功后跳转对应首页", "../03-training/today-training.md"),
            ("手机号快捷登录按钮", "button", "调起微信 getPhoneNumber 授权并快捷登录", "../03-training/today-training.md"),
            ("忘记密码？", "link", "显示重置密码表单", None),
            ("立即注册", "link", "跳转注册页，携带 invite 参数", "./register.md"),
            ("返回登录", "button", "重置密码表单内返回登录态", None),
            ("滑块验证弹窗", "modal", "人机验证，成功后发送验证码", None),
        ],
        "states": [
            "登录中：按钮显示 loading 动画，禁止重复点击",
            "验证码倒计时：获取验证码按钮显示剩余秒数并禁用",
            "重置密码表单：替换登录表单显示重置密码界面",
        ]
    },
    {
        "id": "register",
        "title": "注册页",
        "route": "/auth/register",
        "summary": "新用户注册页，通过手机号/邮箱+验证码完成注册并自动登录。",
        "interactions": [
            ("手机号或邮箱输入框", "input", "输入注册账号", None),
            ("登录密码输入框", "input", "输入密码", None),
            ("确认密码输入框", "input", "再次输入密码校验一致性", None),
            ("邀请码输入框", "input", "可选，填写邀请码", None),
            ("验证码输入框", "input", "输入6位验证码", None),
            ("获取验证码按钮", "button", "触发滑块验证后发送验证码，带倒计时", None),
            ("同意协议勾选框", "checkbox", "同意用户协议与免责声明", None),
            ("《用户协议》", "link", "跳转用户协议页", "./terms.md"),
            ("《免责声明》", "link", "跳转免责声明页", "./disclaimer.md"),
            ("立即注册按钮", "button", "校验后注册并自动登录", "../03-training/today-training.md"),
            ("立即登录", "link", "返回登录页", "./login.md"),
            ("滑块验证弹窗", "modal", "人机验证，成功后发送验证码", None),
        ],
        "states": [
            "注册中：按钮显示 loading 动画",
            "验证码倒计时：获取验证码按钮禁用并显示倒计时",
        ]
    },
    {
        "id": "onboarding",
        "title": "入驻引导页",
        "route": "/auth/onboarding",
        "summary": "引导教练或健身房入驻平台，未登录先跳转登录。",
        "interactions": [
            ("我是教练，立即入驻", "button", "跳转教练申请页，未登录先跳登录", "../05-coach/application.md"),
            ("我是健身房，申请合作", "button", "跳转健身房申请页，未登录先跳登录", "../05-coach/application.md"),
        ],
        "states": []
    },
    {
        "id": "student-onboarding",
        "title": "学员 Onboarding",
        "route": "/auth/student-onboarding",
        "summary": "学员首次登录后完善基础档案的三步表单流程。",
        "interactions": [
            ("昵称输入框", "input", "填写昵称", None),
            ("性别选择", "card", "单选卡片：男 / 女", None),
            ("身高输入", "inputNumber", "输入身高(cm)", None),
            ("体重输入", "inputNumber", "输入体重(kg)", None),
            ("健身目标选择", "card", "单选卡片：减脂塑形/增肌强身/力量提升/体能改善/体态矫正/运动恢复/综合体适能/灵活柔韧", None),
            ("训练水平选择", "card", "单选卡片：零基础/有一点基础/有系统训练经验", None),
            ("感兴趣的训练方向", "chip", "多选标签：上肢/下肢/核心/体态纠正/减脂燃脂/灵活性/力量举/心肺有氧", None),
            ("常用器械", "chip", "多选标签：徒手/哑铃/杠铃/拉力器/器械区/壶铃", None),
            ("单次训练时长", "chip", "单选标签：15/20/30/45/60 分钟", None),
            ("上一步", "button", "返回上一步", None),
            ("下一步", "button", "校验并进入下一步", None),
            ("开始训练", "button", "提交档案并跳转训练页", "../03-training/impromptu-training.md"),
        ],
        "states": [
            "加载中：页面初始化时加载已有档案数据",
            "保存中：点击开始训练后显示保存中",
            "校验失败：必填项未填时 Toast 提示",
        ]
    },
    {
        "id": "wechat-auth",
        "title": "微信授权页",
        "route": "/auth/wechat-auth",
        "summary": "小程序快捷登录统一入口说明页，根据参数自动重定向。",
        "interactions": [
            ("去首页", "button", "返回平台首页", "../../weapp/02-discovery/index.md"),
        ],
        "states": [
            "自动重定向：页面加载后根据 type 参数自动跳转登录页（bind/login）",
        ]
    },
]

weapp_discovery = [
    {
        "id": "index",
        "title": "首页",
        "route": "/pages/index/index",
        "summary": "平台着陆页，展示核心卖点与功能入口，已登录自动跳转。",
        "interactions": [
            ("顶部登录按钮", "button", "已登录跳转训练页，未登录跳转登录", "../01-auth/login.md"),
            ("立即开始训练", "button", "已登录跳转训练页，未登录跳转登录", "../03-training/today-training.md"),
            ("入驻成为教练", "button", "跳转入驻引导页", "../01-auth/onboarding.md"),
            ("立即注册锁定权益", "button", "跳转注册页", "../01-auth/register.md"),
            ("关于", "link", "跳转关于页", "../04-me/about.md"),
            ("免责声明", "link", "跳转免责声明页", "../04-me/disclaimer.md"),
            ("服务条款", "link", "跳转服务条款页", "../04-me/terms.md"),
            ("联系", "link", "跳转联系页", "../04-me/contact.md"),
            ("文档", "link", "跳转文档页", "../04-me/docs.md"),
        ],
        "states": [
            "已登录自动跳转：useEffect 检测登录态后自动 relaunch 到对应首页",
        ]
    },
    {
        "id": "discovery-index",
        "title": "发现页",
        "route": "/discovery/index",
        "summary": "一站式发现教练、服务商品、热门动作与健身资讯。",
        "interactions": [
            ("搜索输入框", "input", "输入姓名或专长关键字，回车触发搜索", None),
            ("专长筛选下拉", "button", "调起微信 ActionSheet 选择专长过滤", None),
            ("搜索按钮", "button", "触发教练列表搜索", None),
            ("服务商品-查看更多", "link", "跳转服务市场", "./market.md"),
            ("商品卡片-购买", "button", "校验登录后跳转支付页", "../04-me/payment-webview.md"),
            ("商品卡片-加购", "button", "校验登录后加入购物车", "../04-me/cart.md"),
            ("热门动作-查看动作库", "link", "跳转动作库列表", "../03-training/actions.md"),
            ("动作卡片-详情", "button", "跳转动作详情", "../03-training/action-detail.md"),
            ("动作卡片-加入", "button", "将公开动作加入我的动作库", "../04-me/action-lib.md"),
            ("动作卡片主体", "card", "点击跳转动作详情", "../03-training/action-detail.md"),
            ("健身资讯-查看更多", "link", "跳转知识库首页", "../06-content/knowledge.md"),
            ("文章卡片", "card", "点击跳转内容详情", "../06-content/content-detail.md"),
            ("教练卡片", "card", "点击跳转教练主页", "./coach-profile.md"),
            ("加载更多", "button", "加载下一页教练列表", None),
        ],
        "states": [
            "加载中：教练列表、商品、动作、文章加载时显示骨架屏",
            "空状态：无教练/无商品/无动作/无文章时显示空提示",
            "专注模式：仅展示专属邀请教练，隐藏搜索与筛选",
            "触底加载：滚动到底部自动加载更多教练",
        ]
    },
    {
        "id": "market",
        "title": "服务市场",
        "route": "/discovery/market",
        "summary": "按教练展示所有可购买的订阅服务商品，支持筛选与加购。",
        "interactions": [
            ("搜索输入框", "input", "实时过滤商品（教练、商品、专长关键词）", None),
            ("套餐等级筛选", "tab", "切换全部/基础/专业/全能标签过滤", None),
            ("购物车按钮", "button", "跳转购物车", "../04-me/cart.md"),
            ("教练信息区", "card", "点击跳转教练主页定价Tab", "./coach-profile.md"),
            ("购买按钮", "button", "校验登录后跳转支付页", "../04-me/payment-webview.md"),
            ("加购按钮", "button", "加入购物车并弹出去购物车/继续选购提示", "../04-me/cart.md"),
        ],
        "states": [
            "加载中：页面初始化显示骨架屏",
            "下拉刷新：下拉重新加载市场数据",
            "空状态/错误：无商品或加载失败，提供重新加载和去发现教练入口",
            "筛选结果空：搜索/筛选无匹配时提示换关键词",
        ]
    },
    {
        "id": "coach-profile",
        "title": "教练主页",
        "route": "/discovery/coach-profile",
        "summary": "教练详情页，展示简介、定价、教学内容、评价，支持订阅与智能生成计划。",
        "interactions": [
            ("Tab切换", "tab", "切换：关于教练 / 订阅价格 / 教学内容 / 学员评价", None),
            ("待支付订阅横幅", "banner", "点击继续完成购买支付", "../04-me/payment-webview.md"),
            ("立即订阅/查看价格", "button", "滚动定位到订阅价格区并切换Tab", "#pricing"),
            ("续费", "button", "已订阅用户进入续费模式选择套餐", None),
            ("查看订阅进度", "button", "订阅处理中时的状态提示", None),
            ("智能生成计划", "button", "跳转AI生成计划页（需已订阅）", "./generate-plan.md"),
            ("填写/更新训练需求问卷", "button", "打开问卷弹窗（需已订阅）", None),
            ("套餐选择", "card", "选择时长套餐进行购买或续费", "../04-me/payment-webview.md"),
            ("教学内容项", "card", "点击跳转内容详情", "../06-content/content-detail.md"),
            ("问卷弹窗", "modal", "加载并提交训练需求问卷", None),
        ],
        "states": [
            "加载中：页面加载显示骨架屏",
            "错误：加载失败显示错误提示与重试按钮",
            "待支付：顶部显示待支付横幅引导继续支付",
            "未登录：购买/订阅时提示登录并携带 returnTo",
        ]
    },
    {
        "id": "generate-plan",
        "title": "智能生成计划",
        "route": "/discovery/generate-plan",
        "summary": "为订阅教练的学员选择训练域并填写评估表单以AI生成计划。",
        "interactions": [
            ("训练域选择卡片", "card", "单选：负重引体 / 负重臂屈伸 / 引体+臂屈伸组合", None),
            ("返回按钮", "button", "返回上一页", None),
            ("下一步按钮", "button", "确认域选择后展示评估表单", None),
            ("评估表单-返回", "button", "返回域选择", None),
            ("评估表单-提交", "button", "提交评估后跳转等待页", "./generate-plan-waiting.md"),
        ],
        "states": [
            "未登录重定向：未登录自动跳登录页",
            "缺少教练ID：无 coachId 时重定向到发现页",
            "加载中：等待 coachId 校验时显示加载中",
        ]
    },
    {
        "id": "generate-plan-waiting",
        "title": "计划生成等待页",
        "route": "/discovery/generate-plan/waiting",
        "summary": "展示AI计划生成进度与结果，支持重试与查看计划列表。",
        "interactions": [
            ("查看全部计划", "button", "跳转计划历史", "../04-me/plan-history.md"),
            ("重新生成", "button", "清除错误并重试快速生成", None),
            ("智能快速生成", "button", "手动触发计划生成请求", None),
            ("返回按钮", "button", "返回上一页", None),
        ],
        "states": [
            "轮询中：显示进度条与生成中提示",
            "成功：显示成功图标并自动跳转计划历史",
            "失败：显示错误信息，提供重新生成和查看计划入口",
            "异步任务已提交：后端返回 taskId，提示稍后去计划列表查看",
        ]
    },
    {
        "id": "ranking",
        "title": "排行榜列表",
        "route": "/discovery/ranking",
        "summary": "展示全部可参与的排行榜活动列表。",
        "interactions": [
            ("排行榜卡片", "card", "点击跳转排行榜详情", "./ranking-detail.md"),
        ],
        "states": [
            "未登录跳转：无 token 时重定向到登录页",
            "加载中：显示骨架屏",
            "空状态：暂无排行榜时显示空提示",
        ]
    },
    {
        "id": "ranking-detail",
        "title": "排行榜详情",
        "route": "/discovery/ranking/detail",
        "summary": "展示单个排行榜的规则、排名榜单及成绩提交入口。",
        "interactions": [
            ("立即挑战", "button", "打开成绩提交弹窗", None),
            ("成绩提交弹窗", "modal", "填写成绩表单并提交，成功后刷新榜单", None),
            ("返回", "link", "排行榜不存在时返回上一页", None),
        ],
        "states": [
            "未登录跳转：无 token 时重定向到登录页",
            "加载中：显示详情骨架屏",
            "排行榜不存在：显示空状态与返回入口",
        ]
    },
    {
        "id": "share",
        "title": "训练分享页",
        "route": "/discovery/share",
        "summary": "训练完成后生成分享卡片并保存到相册。",
        "interactions": [
            ("保存分享卡片", "button", "通过 Canvas 绘制卡片并保存到相册或预览", None),
            ("返回", "button", "返回上一页", None),
        ],
        "states": [
            "加载中：加载本次训练分享数据",
            "生成中：Canvas 绘制图片过程中按钮禁用",
        ]
    },
]

weapp_training = [
    {
        "id": "today-training",
        "title": "今日训练",
        "route": "/training/today-training",
        "summary": "展示学员今日训练计划的核心页面，支持教练/自建计划切换、日历选天、补练/跳过、轻任务管理、打卡分享与训练入口。",
        "interactions": [
            ("计划切换 Tab", "tab", "切换 coach/self 计划模式", None),
            ("教练订阅 Tab", "tab", "多教练时横向滚动切换当前订阅", None),
            ("移除自建计划", "button", "弹出确认后删除自建计划实例", None),
            ("说明卡片", "card", "打开「为什么要确认完成」说明弹窗", None),
            ("收起返回确认 Banner", "text", "隐藏训练完成返回提示", None),
            ("补练按钮", "button", "跳转到对应天的训练执行页", "./training-execution.md"),
            ("跳过按钮", "button", "弹出确认后跳过该训练日", None),
            ("去续费链接", "text", "跳转到教练主页续费", "../02-discovery/coach-profile.md"),
            ("日历面板", "calendar", "点击某天切换选中并展示当天安排", None),
            ("即兴锻炼入口", "button", "跳转即兴锻炼配置页", "./impromptu-training.md"),
            ("整日打卡图", "button", "打开生成日打卡分享图弹窗", None),
            ("今日训练卡片", "component", "打开轻任务/添加轻任务/删除轻任务", None),
            ("轻任务 Sheet 弹窗", "sheet", "填写并提交轻任务完成数据（饮食/有氧/习惯）", None),
            ("轻动作选择器", "picker", "从动作库选择轻任务类型动作", None),
            ("轻任务配置弹窗", "modal", "输入时间、备注、饮食内容/有氧距离/习惯名称等并创建任务", None),
            ("日打卡分享弹窗", "modal", "展示分享图并支持小程序分享", None),
            ("计划完成弹窗", "modal", "展示完成祝贺，提供更新档案/生成下一计划/查看全部计划", "../04-me/profile-detail.md"),
            ("说明弹窗-去输入并校准", "button", "关闭弹窗并跳转训练执行页", "./training-execution.md"),
            ("空状态-即兴锻炼", "button", "跳转即兴锻炼页", "./impromptu-training.md"),
            ("空状态-联系教练", "button", "跳转消息页", "../04-me/messages.md"),
            ("空状态-AI长期计划/我的计划库", "button", "跳转计划库", "../04-me/plan-lib.md"),
            ("空状态-浏览教练", "button", "跳转发现教练", "../02-discovery/index.md"),
        ],
        "states": [
            "loading：骨架屏状态",
            "无计划空状态（等待教练制定 / 未订阅）",
            "教练计划宽限期锁定状态",
            "多教练切换时的「待制定/待续费」标记",
            "missingDays 补练提示条",
            "今日已完成提示条",
            "返回确认提示条（banner）",
            "轻任务配置/选择/打卡弹窗显隐状态",
            "计划完成庆祝弹窗状态",
        ]
    },
    {
        "id": "training-execution",
        "title": "训练执行",
        "route": "/training/training-execution",
        "summary": "训练当日执行与记录页面，支持逐组录入重量/次数/RPE、视频上传、休息计时、添加额外动作/组、一键完成及训练反馈。",
        "interactions": [
            ("返回", "button", "返回上一页", None),
            ("联系教练", "button", "打开与教练的聊天会话", "../04-me/messages-chat.md"),
            ("跳过今日", "button", "弹出确认后跳过当天训练", None),
            ("动作卡片头部", "card", "展开/折叠动作，定位到该动作第一待完成组", None),
            ("删除额外动作", "text", "删除学员自行添加的动作（student_extra）", None),
            ("组行点击", "list", "待完成组设为当前组；已完成组展开详情", None),
            ("删除额外组", "text", "删除学员自行添加的组", None),
            ("重量输入", "input", "录入当前组实际重量（kg）", None),
            ("次数输入", "input", "录入当前组实际次数", None),
            ("RPE输入", "input", "录入主观用力程度 1-10", None),
            ("备注输入", "input", "记录本组训练感受或问题", None),
            ("选视频", "button", "调用 chooseVideo 并上传", None),
            ("贴链接", "button", "弹出可编辑 Modal 粘贴视频链接", None),
            ("标记PR", "toggle", "切换当前组是否标记为个人纪录", None),
            ("完成本组", "button", "提交当前组数据并自动推进到下一组/动作", None),
            ("编辑本组", "button", "允许修改已完成组的数据", None),
            ("取消编辑", "button", "退出编辑状态并恢复原始值", None),
            ("+ 新增一组", "button", "为当前动作添加额外组", None),
            ("非力量项目完成打卡", "button", "提交饮食/有氧/习惯类项目的完成数据", None),
            ("+ 添加动作", "button", "打开动作选择弹层", None),
            ("动作选择弹层", "modal", "搜索并选择动作库中的 STRENGTH 动作添加", None),
            ("完成训练", "button", "弹出确认后结束本次训练", None),
            ("一键完成训练", "button", "自动补齐未完成组后结束训练", None),
            ("返回今日安排继续轻任务", "button", "当轻任务未完成时返回今日训练页", "./today-training.md"),
            ("休息计时弹窗", "modal", "展示组间倒计时，支持 +30秒 / 跳过休息", None),
            ("训练反馈弹窗", "modal", "选择难度感受并填写文字反馈发送给教练", None),
        ],
        "states": [
            "loading：加载中",
            "加载失败重试状态",
            "只读模式（readOnly）禁止修改",
            "即兴训练模式（impromptu）",
            "组间休息倒计时覆盖层",
            "所有组完成后的完成提示",
            "轻任务未完成拦截提示",
            "训练反馈弹窗（可选跳过）",
            "视频上传中状态",
        ]
    },
    {
        "id": "action-detail",
        "title": "动作详情",
        "route": "/training/action-detail",
        "summary": "展示从缓存读取的动作详细信息，包括动作说明、训练部位、属性标签与演示视频链接。",
        "interactions": [
            ("复制视频链接", "button", "将动作演示视频 URL 复制到剪贴板", None),
        ],
        "states": [
            "未找到动作详情的空状态（提示返回动作库重新进入）",
        ]
    },
    {
        "id": "action-edit",
        "title": "动作编辑",
        "route": "/training/action-edit",
        "summary": "学员添加或编辑自定义动作到个人动作库。",
        "interactions": [
            ("动作名称", "input", "必填，最大100字符", None),
            ("动作描述", "textarea", "选填，最大500字符", None),
            ("训练部位", "input", "选填，多个用逗号分隔", None),
            ("动作类型选项", "radio", "选择 STRENGTH/DIET/CARDIO/HABIT", None),
            ("演示视频链接", "input", "选填", None),
            ("添加动作/保存", "button", "调用 addAction 后返回", "../04-me/action-lib.md"),
        ],
        "states": [
            "提交中 disabled 状态",
            "表单校验失败提示（名称必填）",
        ]
    },
    {
        "id": "actions",
        "title": "学员动作库",
        "route": "/training/actions",
        "summary": "浏览学员个人动作库列表，支持搜索与分页加载，点击卡片查看动作详情。",
        "interactions": [
            ("搜索动作", "input", "实时搜索动作名称", None),
            ("动作卡片", "card", "缓存动作数据并跳转详情页", "./action-detail.md"),
            ("加载更多", "button", "分页加载更多动作", None),
        ],
        "states": [
            "未登录跳转登录页",
            "加载中状态",
            "搜索为空状态",
            "列表为空状态（提示到电脑端添加）",
            "全部加载完成提示",
        ]
    },
    {
        "id": "copy-from-coach",
        "title": "从教练复制动作",
        "route": "/training/copy-from-coach",
        "summary": "展示订阅教练分享的动作列表，支持一键复制到学员个人动作库。",
        "interactions": [
            ("复制到我的动作库", "button", "调用 copyCoachAction 将该动作加入个人库", "../04-me/action-lib.md"),
            ("下拉刷新", "gesture", "重新加载教练动作列表", None),
            ("重试", "button", "错误时重新请求数据", None),
        ],
        "states": [
            "初始加载骨架屏",
            "加载失败错误状态",
            "列表为空状态（提示订阅教练后使用）",
            "已添加状态（按钮置灰）",
            "复制中 loading 状态",
        ]
    },
    {
        "id": "impromptu-training",
        "title": "即兴锻炼",
        "route": "/training/impromptu-training",
        "summary": "学员自定义即兴训练，选择动作与组次参数后创建并进入标准执行页。",
        "interactions": [
            ("返回训练", "button", "返回今日训练页", "./today-training.md"),
            ("AI 长期计划", "button", "跳转 AI 计划创建页", "../04-me/plan-lib-create.md"),
            ("添加项目", "button", "新增一条训练项", None),
            ("删除项目", "button", "移除对应训练项", None),
            ("选择动作", "trigger", "打开动作选择弹窗", None),
            ("动作选择弹窗", "modal", "从力量动作库中选择具体动作", None),
            ("组数输入", "input", "数字输入", None),
            ("次数输入", "input", "数字输入", None),
            ("休息输入", "input", "秒数数字输入", None),
            ("重量输入", "input", "可选，数字输入", None),
            ("开始训练", "button", "校验后创建即兴训练并跳转执行页", "./training-execution.md"),
        ],
        "states": [
            "未登录跳转登录页",
            "动作库加载中",
            "无训练项空提示",
            "开始训练 loading 状态",
        ]
    },
    {
        "id": "plan-current",
        "title": "当前计划",
        "route": "/training/plan/current",
        "summary": "展示学员当前激活计划的总览，包括训练日列表、完成进度统计与计划切换。",
        "interactions": [
            ("教练计划/我的计划 切换", "tab", "切换展示教练计划或自建计划", None),
            ("今日训练", "button", "跳转今日训练页", "./today-training.md"),
            ("全部计划", "button", "跳转计划历史页", "../04-me/plan-history.md"),
            ("发现教练", "button", "跳转教练发现页", "../02-discovery/index.md"),
            ("我的计划库", "button", "跳转计划库页", "../04-me/plan-lib.md"),
            ("训练日卡片", "card", "非休息日跳转到对应天的训练执行页", "./training-execution.md"),
        ],
        "states": [
            "加载中骨架屏",
            "有订阅但教练未制定计划空状态",
            "无任何计划空状态（引导发现教练/计划库）",
            "训练日完成/进行中/休息标记",
        ]
    },
]

# 由于数据量巨大，以下使用简化的方式批量生成
# 完整的交互数据已经由子代理分析得出，这里通过脚本生成文件

def render_prd(page, module_path, related_links):
    lines = []
    lines.append(f"# {page['title']}")
    lines.append("")
    lines.append(f"- **路由**：`{page['route']}`")
    lines.append(f"- **所属模块**：{module_path}")
    lines.append(f"- **功能概述**：{page['summary']}")
    lines.append("")
    lines.append("## 交互元素清单")
    lines.append("")
    lines.append("| 元素名称 | 类型 | 触发行为 | 跳转目标 |")
    lines.append("|---|---|---|---|")
    for item in page.get("interactions", []):
        target = item[3] if len(item) > 3 and item[3] else "—"
        if target and not target.startswith("http") and not target.startswith("#") and not target.startswith("./") and not target.startswith("../"):
            target = f"`{target}`"
        lines.append(f"| {item[0]} | {item[1]} | {item[2]} | {target} |")
    lines.append("")
    lines.append("## 页面状态与异常态")
    lines.append("")
    if page.get("states"):
        for st in page["states"]:
            lines.append(f"- {st}")
    else:
        lines.append("- 无特殊状态")
    lines.append("")
    lines.append("## 相关页面")
    lines.append("")
    for rel in related_links:
        lines.append(f"- [{rel['name']}]({rel['path']})")
    lines.append("")
    return "\n".join(lines)

# 生成 weapp 01-auth
write_file("weapp/01-auth/README.md", "# 认证模块（小程序）\\n\\n- [登录页](./login.md)\\n- [注册页](./register.md)\\n- [入驻引导页](./onboarding.md)\\n- [学员 Onboarding](./student-onboarding.md)\\n- [微信授权页](./wechat-auth.md)\\n")
for p in weapp_auth:
    related = [{"name": x["title"], "path": f"./{x['id']}.md"} for x in weapp_auth if x["id"] != p["id"]]
    write_file(f"weapp/01-auth/{p['id']}.md", render_prd(p, "小程序 / 认证", related))

# 生成 weapp 02-discovery
write_file("weapp/02-discovery/README.md", "# 发现与首页模块（小程序）\\n\\n- [首页（Landing）](./index.md)\\n- [发现页](./discovery-index.md)\\n- [服务市场](./market.md)\\n- [教练主页](./coach-profile.md)\\n- [智能生成计划](./generate-plan.md)\\n- [计划生成等待页](./generate-plan-waiting.md)\\n- [排行榜列表](./ranking.md)\\n- [排行榜详情](./ranking-detail.md)\\n- [训练分享页](./share.md)\\n")
for p in weapp_discovery:
    related = [{"name": x["title"], "path": f"./{x['id']}.md"} for x in weapp_discovery if x["id"] != p["id"]]
    write_file(f"weapp/02-discovery/{p['id']}.md", render_prd(p, "小程序 / 发现", related))

# 生成 weapp 03-training
write_file("weapp/03-training/README.md", "# 训练模块（小程序）\\n\\n- [今日训练](./today-training.md)\\n- [训练执行](./training-execution.md)\\n- [动作详情](./action-detail.md)\\n- [动作编辑](./action-edit.md)\\n- [学员动作库](./actions.md)\\n- [从教练复制动作](./copy-from-coach.md)\\n- [即兴锻炼](./impromptu-training.md)\\n- [当前计划](./plan-current.md)\\n")
for p in weapp_training:
    related = [{"name": x["title"], "path": f"./{x['id']}.md"} for x in weapp_training if x["id"] != p["id"]]
    write_file(f"weapp/03-training/{p['id']}.md", render_prd(p, "小程序 / 训练", related))

print("第一批 PRD 文件已生成")
