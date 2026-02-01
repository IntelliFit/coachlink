"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Types
export interface GuideStep {
    element?: string;
    popover: {
        title: string;
        description: string;
        side?: "top" | "right" | "bottom" | "left";
        align?: "start" | "center" | "end";
    };
}

export interface GuideConfig {
    key: string;
    steps: GuideStep[];
    onComplete?: () => void;
    onSkip?: () => void;
}

// Create driver instance with Chinese localization and styling
export function createGuide(config: GuideConfig) {
    const driverInstance = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        overlayColor: 'rgba(15, 23, 42, 0.3)',
        popoverClass: "aero-guide-popover",
        nextBtnText: "下一步",
        prevBtnText: "上一步",
        doneBtnText: "完成",
        progressText: "{{current}} / {{total}}",
        onDestroyed: () => {
            config.onComplete?.();
        },
        steps: config.steps.map((step) => ({
            element: step.element,
            popover: {
                title: step.popover.title,
                description: step.popover.description,
                side: step.popover.side || "bottom",
                align: step.popover.align || "center",
            },
        })),
    });

    return {
        start: () => driverInstance.drive(),
        destroy: () => driverInstance.destroy(),
        instance: driverInstance,
    };
}

// Predefined guide configurations
export const GUIDE_CONFIGS = {
    // Coach Dashboard Tour
    COACH_ONBOARDING: {
        key: "coach_onboarding",
        steps: [
            {
                popover: {
                    title: "欢迎加入 CoachLink 教练团队！",
                    description:
                        "这里是您的数字化工作台。让我们花 1 分钟带您熟悉核心功能。",
                },
            },
            {
                element: "#guide-plan-library",
                popover: {
                    title: "这是您的核心资产",
                    description:
                        '支持智能一键导入！复制文本即可生成结构化计划。在这里积累您的"数字资产"，一键复用。',
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-students",
                popover: {
                    title: "管理您的学员",
                    description:
                        "查看学员列表、处理订阅请求、分配计划都在这里完成。",
                    side: "bottom" as const,
                },
            },
            {
                popover: {
                    title: "开始您的执教之旅！",
                    description:
                        '建议您先去创建一个"通用训练模板"，以备不时之需。点击右上角头像可进行收款设置。',
                },
            },
        ],
    },

    // Student Dashboard Tour
    STUDENT_ONBOARDING: {
        key: "student_onboarding",
        steps: [
            {
                popover: {
                    title: "欢迎来到 CoachLink！",
                    description:
                        "我们用 1 分钟带你走完核心路径：找到教练 → 订阅支付 → 等待教练下发计划 → 今日训练直接开练。",
                },
            },
            {
                element: "#guide-today-training",
                popover: {
                    title: "这是您的每日任务",
                    description:
                        '您的训练重量已根据您的 1RM 智能计算。点击"开始训练"即可进入跟随模式，支持手动微调重量。',
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-find-coach",
                popover: {
                    title: "还没有计划？",
                    description:
                        "从这里进入教练主页：看擅长领域/价格方案/订阅问卷。订阅后系统会留存支付与服务记录，方便追溯。",
                    side: "right" as const,
                },
            },
            {
                element: "#guide-profile",
                popover: {
                    title: "见证您的蜕变",
                    description:
                        "体重、1RM、训练记录、进步组与关键视频都会沉淀在这里，方便复盘与和教练沟通。",
                    side: "right" as const,
                },
            },
            {
                popover: {
                    title: "准备就绪！",
                    description:
                        "建议：先完善档案（体重/1RM 越准，自动算重量越准），再完成一次训练并分享，形成第一条闭环。",
                },
            },
        ],
    },

    // Student: Find coach (discovery page) - action-oriented
    STUDENT_FIND_COACH_GUIDE: {
        key: "student_find_coach",
        steps: [
            {
                popover: {
                    title: "第一步：找到合适的教练",
                    description:
                        "你可以按姓名/专长筛选。点进教练主页后，选择方案→填写问卷→支付→等待教练下发计划。",
                },
            },
            {
                element: "#guide-discovery-search",
                popover: {
                    title: "先搜你想要的方向",
                    description: "例如：力量举/增肌/减脂/康复等关键词。",
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-discovery-filter",
                popover: {
                    title: "再用专长筛一下",
                    description: "更快找到匹配你目标的教练。",
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-discovery-first-coach",
                popover: {
                    title: "点开一个教练主页",
                    description: "查看方案与服务内容，准备进入订阅流程。",
                    side: "top" as const,
                },
            },
        ],
    },

    // Student Subscribe Flow (coach profile page)
    STUDENT_SUBSCRIBE_FLOW_GUIDE: {
        key: "student_subscribe_flow",
        steps: [
            {
                popover: {
                    title: "订阅教练：完整流程（1分钟）",
                    description:
                        "你会经历：选择方案 →（可能需要填问卷）→ 支付 → 等待教练确认与下发计划 → 今日训练开始执行。",
                },
            },
            {
                element: "#guide-subscribe-entry",
                popover: {
                    title: "订阅入口在这里（不用右滑找 Tab）",
                    description:
                        "在手机上“订阅价格”标签可能需要右滑才能看见。点这个“立即订阅”按钮会自动跳到订阅价格区。",
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-subscribe-products",
                popover: {
                    title: "进入订阅价格后：选方案与周期",
                    description:
                        "不同方案通常对应不同服务强度（例如是否包含视频点评/沟通频率）。选好后按页面提示继续即可。",
                    side: "top" as const,
                },
            },
            {
                popover: {
                    title: "问卷不是形式",
                    description:
                        "如果弹出教练问卷，请认真填写：它会直接影响计划个性化与自动算重量的准确性（尤其是 1RM 相关数据）。",
                },
            },
            {
                popover: {
                    title: "支付后去哪看进度？",
                    description:
                        '支付/提交凭证后会进入“等待教练确认/发计划”。你可以在「我的订阅」里看到状态，并一键联系教练加速处理。',
                },
            },
        ],
    },

    // Student: Questionnaire dialog guide (shown when questionnaire dialog opens)
    STUDENT_QUESTIONNAIRE_GUIDE: {
        key: "student_questionnaire",
        steps: [
            {
                element: "#guide-coach-questionnaire",
                popover: {
                    title: "填写教练问卷（关键一步）",
                    description:
                        "请尽量填写真实的训练经历/目标/频率/1RM（如有）。这些信息会直接影响计划个性化与智能算重量的准确性。",
                    side: "top" as const,
                },
            },
            {
                popover: {
                    title: "提交后做什么？",
                    description: "提交问卷后会进入支付步骤。支付完成后去「我的订阅」查看状态，并可一键联系教练。",
                },
            },
        ],
    },

    // Student: Payment dialog guide (shown when payment dialog opens)
    STUDENT_PAYMENT_GUIDE: {
        key: "student_payment",
        steps: [
            {
                element: "#guide-payment-options",
                popover: {
                    title: "完成支付/提交凭证",
                    description:
                        "根据页面提示选择支付方式。提交后状态会变为「等待教练确认」，系统会通知教练处理。",
                    side: "top" as const,
                },
            },
            {
                popover: {
                    title: "支付后去哪？",
                    description: "回到「我的订阅」查看进度；也可以直接在线咨询教练，加速计划下发。",
                },
            },
        ],
    },

    // Student Subscription Status (subscription list page)
    STUDENT_SUBSCRIPTION_STATUS_GUIDE: {
        key: "student_subscription_status",
        steps: [
            {
                popover: {
                    title: "这里是订阅进度中心",
                    description:
                        "订阅不是一次性发完模板就结束：这里会展示你与每位教练的状态、到期时间，以及下一步该做什么。",
                },
            },
            {
                element: "#guide-subscription-list",
                popover: {
                    title: "看懂状态（很重要）",
                    description:
                        "如果显示「待支付」：说明流程没走完；如果显示「等待教练确认」：已提交支付信息，教练确认后会下发计划。",
                    side: "top" as const,
                },
            },
            {
                element: "#guide-subscription-chat",
                popover: {
                    title: "等待期别干等",
                    description:
                        "建议直接在线咨询教练，把你的目标/时间安排/受伤史补充清楚，计划会更贴合，也能加速教练处理。",
                    side: "top" as const,
                },
            },
        ],
    },

    // Plan Editor Deep Dive
    PLAN_EDITOR_GUIDE: {
        key: "plan_editor",
        steps: [
            {
                element: "#guide-day-column",
                popover: {
                    title: "训练日设置",
                    description: "点击这里添加新的训练日或休息日。",
                    side: "right" as const,
                },
            },
            {
                element: "#guide-ai-import",
                popover: {
                    title: "智能导入",
                    description:
                        "把聊天记录里的计划直接粘贴到这里，系统帮您自动生成结构化模板！",
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-action-library",
                popover: {
                    title: "动作库",
                    description:
                        "支持拖拽，也支持从自己的动作库中复用视频演示。",
                    side: "left" as const,
                },
            },
        ],
    },

    // Execution Guide
    EXECUTION_GUIDE: {
        key: "execution",
        steps: [
            {
                element: "#guide-weight-input",
                popover: {
                    title: "智能重量",
                    description:
                        "默认显示计算好的重量，觉得轻了/重了就改成真实重量：本次后续组会联动校准；系统也会据此更新 e1RM，让下次自动算重量更准。",
                    side: "top" as const,
                },
            },
            {
                element: "#guide-video-upload",
                popover: {
                    title: "上传视频",
                    description: "上传本组视频，获取教练的动作纠正。",
                    side: "top" as const,
                },
            },
            {
                element: "#guide-finish-training",
                popover: {
                    title: "完成训练",
                    description: "所有动作完成后，别忘了点击这里提交！",
                    side: "top" as const,
                },
            },
        ],
    },

    // Student: Today training / progress explanation
    STUDENT_TODAY_TRAINING_PROGRESS_GUIDE: {
        key: "student_today_training_progress",
        steps: [
            {
                element: "#guide-today-progress",
                popover: {
                    title: "今日推进日（不是日历）",
                    description:
                        "休息日会自动顺延；到训练日会停住，直到你完成/跳过。这样不会因为延迟执行而“看起来进度被推走”。",
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-today-card",
                popover: {
                    title: "开始训练的意义",
                    description:
                        "这里是你下一次需要关注的训练日。进入执行后输入真实重量/次数，不仅是记录，还会校准推荐并更新 e1RM，让下次自动算重量更准。",
                    side: "bottom" as const,
                },
            },
            {
                element: "#guide-missing-days",
                popover: {
                    title: "漏练也能补（或跳过确认）",
                    description:
                        "如果之前有训练日没确认，你可以随时补练；也可以选择跳过（会标记为跳过，教练可见）。漏练不会影响今日推荐的推进逻辑。",
                    side: "top" as const,
                },
            },
        ],
    },

    // Chat Guide
    CHAT_GUIDE: {
        key: "chat",
        steps: [
            {
                element: "#guide-video-reference",
                popover: {
                    title: "视频引用",
                    description:
                        "点击这里引用您的训练视频或历史数据，教练能更准确地为您解答。",
                    side: "top" as const,
                },
            },
        ],
    },
};
