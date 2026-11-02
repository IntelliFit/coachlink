import { coachExitReasonLabel } from "@coachlink/core/src/coachFunnel";
import { hasCoachPackage, resolveHuifuAccountState } from "./coachOnboardingProgress";

export type FunnelEventRecord = {
    event: string;
    coach_id: string | null;
    user_id: string | null;
    anon_id: string | null;
    reason: string | null;
    note: string | null;
    properties: Record<string, unknown> | null;
    created_at: string;
};

export type FunnelCoachRecord = {
    id: string;
    user_id: string | null;
    name: string;
    huifu_card_token?: string | null;
    huifu_id?: string | null;
    huifu_apply_no?: string | null;
};

export type FunnelCoachRow = {
    coachId: string;
    name: string;
    canSell: boolean;
    views: number;
    pricingViews: number;
    buyClicks: number;
    blockedClicks: number;
    paymentStarts: number;
    paymentCancels: number;
    paidOrders: number;
    reasons: number;
};

export type CoachFunnelReport = {
    totals: {
        listVisitors: number;
        profileVisitors: number;
        pricingVisitors: number;
        buyClickVisitors: number;
        blockedVisitors: number;
        paymentStartVisitors: number;
        paymentCancelVisitors: number;
        paidOrders: number;
        answers: number;
        skips: number;
    };
    reasons: Array<{ reason: string; label: string; count: number }>;
    coaches: FunnelCoachRow[];
    notes: Array<{ coachName: string; reason: string; note: string; createdAt: string }>;
};

function visitorOf(event: FunnelEventRecord): string | null {
    return event.user_id ? `u:${event.user_id}` : event.anon_id ? `a:${event.anon_id}` : null;
}

/**
 * 按访客去重统计漏斗。教练看自己的主页不算；登录前后的同一个人会算两个访客，
 * 所以数字是估算，趋势和相对大小才可靠。
 */
export function buildCoachFunnelReport(params: {
    events: FunnelEventRecord[];
    coaches: FunnelCoachRecord[];
    pricing: Array<{ coach_id: string; products?: unknown; pricings?: unknown }>;
    paidOrdersByCoach: Record<string, number>;
}): CoachFunnelReport {
    const coachById = new Map(params.coaches.map((coach) => [coach.id, coach]));
    const pricingByCoach = new Map(params.pricing.map((row) => [row.coach_id, row]));
    const canSell = (coach: FunnelCoachRecord) =>
        resolveHuifuAccountState({
            huifuCardToken: coach.huifu_card_token,
            huifuId: coach.huifu_id,
            huifuApplyNo: coach.huifu_apply_no,
        }) === "opened" && hasCoachPackage(pricingByCoach.get(coach.id) ?? null);

    const totals = {
        list: new Set<string>(),
        profile: new Set<string>(),
        pricing: new Set<string>(),
        buy: new Set<string>(),
        blocked: new Set<string>(),
        paymentStart: new Set<string>(),
        paymentCancel: new Set<string>(),
    };
    const perCoach = new Map<string, {
        views: Set<string>;
        pricing: Set<string>;
        buy: Set<string>;
        blocked: Set<string>;
        paymentStart: Set<string>;
        paymentCancel: Set<string>;
        reasons: number;
    }>();
    const reasonCounts = new Map<string, number>();
    const notes: CoachFunnelReport["notes"] = [];
    let answers = 0;
    let skips = 0;

    const statsFor = (coachId: string) => {
        let stats = perCoach.get(coachId);
        if (!stats) {
            stats = {
                views: new Set<string>(),
                pricing: new Set<string>(),
                buy: new Set<string>(),
                blocked: new Set<string>(),
                paymentStart: new Set<string>(),
                paymentCancel: new Set<string>(),
                reasons: 0,
            };
            perCoach.set(coachId, stats);
        }
        return stats;
    };

    for (const event of params.events) {
        const visitor = visitorOf(event);
        if (!visitor) continue;
        // 体验版和 dev 站的自测事件也写库（方便验收），但不进报表
        const env = event.properties?.env;
        if (env && env !== "release") continue;

        if (event.event === "list_view") {
            totals.list.add(visitor);
            continue;
        }

        const coach = event.coach_id ? coachById.get(event.coach_id) : undefined;
        if (!coach) continue;
        if (event.user_id && coach.user_id === event.user_id) continue;
        const stats = statsFor(coach.id);

        switch (event.event) {
            case "profile_view":
                totals.profile.add(visitor);
                stats.views.add(visitor);
                break;
            case "pricing_view":
                totals.pricing.add(visitor);
                stats.pricing.add(visitor);
                break;
            case "buy_click":
                totals.buy.add(visitor);
                stats.buy.add(visitor);
                if (event.properties?.blocked) {
                    totals.blocked.add(visitor);
                    stats.blocked.add(visitor);
                }
                break;
            case "payment_start":
                totals.paymentStart.add(visitor);
                stats.paymentStart.add(visitor);
                break;
            case "payment_cancel":
            case "payment_fail":
                totals.paymentCancel.add(visitor);
                stats.paymentCancel.add(visitor);
                break;
            case "exit_reason":
                answers += 1;
                stats.reasons += 1;
                if (event.reason) reasonCounts.set(event.reason, (reasonCounts.get(event.reason) || 0) + 1);
                if (event.note) {
                    notes.push({
                        coachName: coach.name,
                        reason: coachExitReasonLabel(event.reason || ""),
                        note: event.note,
                        createdAt: event.created_at,
                    });
                }
                break;
            case "exit_skip":
                skips += 1;
                break;
            default:
                break;
        }
    }

    const coachIds = new Set([...perCoach.keys(), ...Object.keys(params.paidOrdersByCoach)]);
    const coaches: FunnelCoachRow[] = [];
    for (const coachId of coachIds) {
        const coach = coachById.get(coachId);
        if (!coach) continue;
        const stats = statsFor(coachId);
        coaches.push({
            coachId,
            name: coach.name,
            canSell: canSell(coach),
            views: stats.views.size,
            pricingViews: stats.pricing.size,
            buyClicks: stats.buy.size,
            blockedClicks: stats.blocked.size,
            paymentStarts: stats.paymentStart.size,
            paymentCancels: stats.paymentCancel.size,
            paidOrders: params.paidOrdersByCoach[coachId] || 0,
            reasons: stats.reasons,
        });
    }
    coaches.sort((a, b) => b.views - a.views || b.paidOrders - a.paidOrders || a.name.localeCompare(b.name));

    return {
        totals: {
            listVisitors: totals.list.size,
            profileVisitors: totals.profile.size,
            pricingVisitors: totals.pricing.size,
            buyClickVisitors: totals.buy.size,
            blockedVisitors: totals.blocked.size,
            paymentStartVisitors: totals.paymentStart.size,
            paymentCancelVisitors: totals.paymentCancel.size,
            paidOrders: coaches.reduce((sum, coach) => sum + coach.paidOrders, 0),
            answers,
            skips,
        },
        reasons: [...reasonCounts.entries()]
            .map(([reason, count]) => ({ reason, label: coachExitReasonLabel(reason), count }))
            .sort((a, b) => b.count - a.count),
        coaches,
        notes: notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30),
    };
}
