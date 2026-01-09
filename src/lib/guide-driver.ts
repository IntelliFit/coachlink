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
        overlayColor: "rgba(0, 0, 0, 0.7)",
        popoverClass: "coachlink-guide-popover",
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
                        "您的专业运动之旅即将开始。让我们花 1 分钟带您熟悉核心功能。",
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
                        "在这里浏览我们的金牌教练库，找到适合您的专业导师，为您定制专属计划。",
                    side: "right" as const,
                },
            },
            {
                element: "#guide-profile",
                popover: {
                    title: "见证您的蜕变",
                    description:
                        "所有的训练数据、身体指标变化都会在这里形成可视化报表。",
                    side: "right" as const,
                },
            },
            {
                popover: {
                    title: "准备就绪！",
                    description:
                        "去做第一次训练，或者去完善一下您的个人资料吧！",
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
                        "默认显示计算好的重量，觉得轻了？直接手动修改，后续组数会自动联动。",
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
