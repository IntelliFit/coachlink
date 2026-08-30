import { fenToYuan } from "@/lib/moneyUtils";

export type CoachWithdrawalArrivalType = "D0" | "D1" | "DM" | "T1";

export interface CoachWithdrawalRules {
    min_amount: number;
    max_amount: number;
    amount_description: string;
    daily_count_description: string;
    availability_description: string;
    arrival_type: CoachWithdrawalArrivalType;
    arrival_description: string;
    fee_description: string;
    destination_description: string;
}

const MIN_AMOUNT_YUAN = 0.1;

export function resolveCoachWithdrawalArrivalType(): CoachWithdrawalArrivalType {
    const configured = String(
        process.env.HUIFU_COACH_WITHDRAW_DATE_TYPE
        || process.env.HUIFU_COACH_CASH_TYPE
        || "D1",
    ).trim().toUpperCase();

    if (configured === "D0" || configured === "D1" || configured === "DM" || configured === "T1") {
        return configured;
    }
    return "D1";
}

export function describeCoachWithdrawalArrival(type: CoachWithdrawalArrivalType): string {
    switch (type) {
        case "D0":
            return "预计当日到账（D+0）";
        case "DM":
            return "预计当日到账（不含当日交易资金）";
        case "T1":
            return "预计次工作日到账（T+1）";
        case "D1":
        default:
            return "预计次自然日到账（D+1）";
    }
}

export function getCoachWithdrawalRules(withdrawableFen: number): CoachWithdrawalRules {
    const maxAmount = fenToYuan(Math.max(0, Math.round(withdrawableFen)));
    const arrivalType = resolveCoachWithdrawalArrivalType();

    return {
        min_amount: MIN_AMOUNT_YUAN,
        max_amount: maxAmount,
        amount_description: maxAmount >= MIN_AMOUNT_YUAN
            ? `单笔最低 ${MIN_AMOUNT_YUAN.toFixed(2)} 元，最高为当前可提现余额 ${maxAmount.toFixed(2)} 元`
            : `单笔最低 ${MIN_AMOUNT_YUAN.toFixed(2)} 元；当前可提现余额不足最低提现金额`,
        daily_count_description: "平台不限制每日申请次数，实际以汇付及银行卡风控为准",
        availability_description: "全天可申请（00:00–24:00），系统或银行维护期间除外",
        arrival_type: arrivalType,
        arrival_description: describeCoachWithdrawalArrival(arrivalType),
        fee_description: "平台不额外收取提现服务费；汇付取现手续费按签约规则结算，实际扣费及到账金额以银行入账记录为准",
        destination_description: "提现至已绑定的本人结算银行卡",
    };
}
