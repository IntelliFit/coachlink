/**
 * 平台服务费（抽成）。
 *
 * 2026-10-22 平台负责人确定：入驻初期 / 优惠期统一按订单金额的 10% 收取，其余归教练。
 * 付款回调里创建结算单时按当时的比例写死 coach_amount / platform_fee（未开户的教练无法收款，
 * 所以正常订单付款即建单），之后的分账、退款都以结算单为准。例外：付款时没建成结算单、
 * 事后由管理员补建的订单，会按补建时的比例计算。
 * 比例定义在 core 包，申请页和《教练手册》展示同一个数。
 */
import { PLATFORM_COMMISSION_PERCENT } from "@coachlink/core/src/coachPolicy";

export { PLATFORM_COMMISSION_PERCENT };

const DEFAULT_SETTLEMENT_DELAY_DAYS = 7;

/** 学员付款后过多少天才把教练那份分账出去（留出退款窗口），线上由环境变量配置。 */
export function resolveCoachSettlementDelayDays(
    raw: string | undefined = process.env.COACH_SUBSCRIPTION_SETTLEMENT_DELAY_DAYS,
): number {
    const configured = Number(raw ?? String(DEFAULT_SETTLEMENT_DELAY_DAYS));
    if (!Number.isFinite(configured)) return DEFAULT_SETTLEMENT_DELAY_DAYS;
    return Math.max(0, configured);
}

/** 汇付分账上线前的老直连订单按 20% 结算，退款冲回钱包时仍按当时的规则计算。 */
export const LEGACY_DIRECT_PAY_COMMISSION_PERCENT = 20;

export type OrderSplitFen = {
    coachAmount: number;
    platformFee: number;
};

/** 平台服务费向下取整到分，零头归教练。 */
export function splitOrderAmountFen(
    totalFen: number,
    commissionPercent: number = PLATFORM_COMMISSION_PERCENT,
): OrderSplitFen {
    const total = Math.max(0, Math.round(totalFen));
    const platformFee = Math.floor((total * commissionPercent) / 100);
    return { coachAmount: total - platformFee, platformFee };
}

/**
 * 分账时用结算记录里写下的教练金额；老记录缺这个字段才按当前比例重算。
 * 避免「下单时 20%、分账时已改成 10%」这类跨版本订单分错钱。
 */
export function resolveSettlementCoachAmountFen(
    settlement: { coach_amount?: number | string | null } | null | undefined,
    totalFen: number,
): number {
    const recorded = Math.round(Number(settlement?.coach_amount));
    if (Number.isFinite(recorded) && recorded > 0) {
        return recorded;
    }
    return splitOrderAmountFen(totalFen).coachAmount;
}
