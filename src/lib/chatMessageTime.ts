import {
    diffBeijingCalendarDays,
    formatBeijingDate,
    getBeijingDateParts,
    getBeijingWeekday,
    toBeijingDateKey,
    type DateInput,
} from "@/lib/beijingTime";

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

/** 会话列表中间日期条：今天 / 昨天 / 完整日期 + 星期 */
export function formatChatDateSeparator(iso: string, now: Date = new Date()): string {
    const d = diffBeijingCalendarDays(now, iso);
    if (d === 0) return "今天";
    if (d === 1) return "昨天";
    const { year, month, day } = getBeijingDateParts(iso);
    const wd = getBeijingWeekday(year, month, day);
    const w = WEEKDAY_ZH[wd] ?? "";
    const nowYear = getBeijingDateParts(now).year;
    if (year === nowYear) {
        return `${month}月${day}日 星期${w}`;
    }
    return `${year}年${month}月${day}日 星期${w}`;
}

/**
 * 气泡下方时间：跨天时带日期，当天仅 HH:mm（北京时间）
 */
export function formatChatBubbleTime(iso: string, now: Date = new Date()): string {
    const d = diffBeijingCalendarDays(now, iso);
    const hm = formatBeijingDate(iso, "zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    if (d === 0) return hm;
    if (d === 1) return `昨天 ${hm}`;
    const { year, month, day } = getBeijingDateParts(iso);
    const nowYear = getBeijingDateParts(now).year;
    if (year === nowYear) {
        return `${month}月${day}日 ${hm}`;
    }
    return `${year}年${month}月${day}日 ${hm}`;
}

export function shouldShowDateSeparator(prevIso: DateInput | null | undefined, currIso: string): boolean {
    if (!prevIso) return true;
    return toBeijingDateKey(prevIso) !== toBeijingDateKey(currIso);
}
