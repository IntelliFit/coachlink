import { COACH_HANDBOOK_PATH, PLATFORM_COMMISSION_PERCENT } from "@coachlink/core/src/coachPolicy";

/**
 * 教练申请审核结果私信。小程序聊天按纯文本显示、Web 按 markdown 渲染，
 * 所以不用 [文字](链接) 语法；行尾两个空格让 Web 端也能换行。
 */
const LINE_BREAK = "  \n";
const DEFAULT_BASE_URL = "https://coachlink.fit";

export function coachHandbookUrl(baseUrl: string = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL): string {
    return `${baseUrl.replace(/\/+$/, "")}${COACH_HANDBOOK_PATH}`;
}

function cleanNotes(notes: string | null | undefined): string {
    return String(notes ?? "").trim();
}

export function buildCoachApprovedMessage(options: { baseUrl?: string; includeHandbook?: boolean } = {}): string {
    const lines = [
        "恭喜！你的教练申请已通过审核，欢迎加入教链 CoachLink 教练团队🎉",
        "用学员的进步，证明教练的专业。",
        "",
        "开始接学员前，请切换到教练端完成「开店 4 步」：",
        "1. 收款账户：完成汇付开户（实名认证 + 本人结算银行卡），学员付款后才能分账给你",
        "2. 套餐定价：设置服务内容、周期和价格",
        "3. 学员问卷：学员购买时填写，帮你提前了解学员情况",
        "4. 计划模板：至少准备 1 个训练计划模板",
        "",
        `平台服务费：入驻初期为订单金额的 ${PLATFORM_COMMISSION_PERCENT}%，其余归教练，可在教练端申请提现。`,
        "平台运营会在 1-2 个工作日内通过电话或微信联系你，邀请你加入教练群并参加入职培训。",
    ];
    if (options.includeHandbook !== false) {
        lines.push(`《教练手册》：${coachHandbookUrl(options.baseUrl)}`);
    }
    return lines.join(LINE_BREAK);
}

export function buildCoachNeedsInfoMessage(notes: string | null | undefined): string {
    const detail = cleanNotes(notes);
    return [
        "你的教练申请我们已经看过了，还需要补充一些材料才能完成审核：",
        detail || "请补充个人简介、训练经历，以及能证明带练能力的学员案例或资质证明。",
        "",
        "补充方式：小程序「我的 → 申请成为教练」，修改后点「提交申请」即可重新进入审核。",
        "资料越具体（训练年限、擅长方向、带过的学员和成果），审核越快。",
    ].join(LINE_BREAK);
}

export function buildCoachRejectedMessage(notes: string | null | undefined): string {
    return [
        `你提交的教练申请未通过，原因：${cleanNotes(notes) || "无"}。`,
        "你可以在「我的 → 申请成为教练」查看审核意见，修改后重新提交。",
    ].join(LINE_BREAK);
}
