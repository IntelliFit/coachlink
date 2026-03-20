const BEIJING_TIME_ZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;

type DateInput = Date | string | number;

const getDateFromInput = (input?: DateInput | null): Date => {
    if (input === null || input === undefined) return new Date();
    return input instanceof Date ? new Date(input.getTime()) : new Date(input);
};

export const getBeijingDateParts = (input?: DateInput | null) => {
    const date = getDateFromInput(input);
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: BEIJING_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value || 0);
    const month = Number(parts.find((p) => p.type === "month")?.value || 0);
    const day = Number(parts.find((p) => p.type === "day")?.value || 0);
    return { year, month, day };
};

export const getBeijingDayStart = (input?: DateInput | null) => {
    const { year, month, day } = getBeijingDateParts(input);
    // Beijing is UTC+8 (no DST): local 00:00 == previous day 16:00 UTC.
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000);
};

export const toBeijingDateKey = (input?: DateInput | null) => {
    const { year, month, day } = getBeijingDateParts(input);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const addBeijingDays = (input: DateInput, offsetDays: number) => {
    const start = getBeijingDayStart(input);
    return new Date(start.getTime() + offsetDays * DAY_MS);
};

export const diffBeijingCalendarDays = (
    left: DateInput,
    right: DateInput,
) => {
    const leftStart = getBeijingDayStart(left).getTime();
    const rightStart = getBeijingDayStart(right).getTime();
    return Math.floor((leftStart - rightStart) / DAY_MS);
};

export const formatBeijingDate = (
    input: DateInput,
    locales: string | string[],
    options: Intl.DateTimeFormatOptions,
) => {
    return new Intl.DateTimeFormat(locales, {
        ...options,
        timeZone: BEIJING_TIME_ZONE,
    }).format(getDateFromInput(input));
};

export const getBeijingWeekday = (year: number, month: number, day: number) => {
    // Weekday of a calendar date is timezone-independent.
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

export const getBeijingMonthDays = (year: number, month: number) => {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const getBeijingDateFromParts = (
    year: number,
    month: number,
    day: number,
) => {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000);
};

export const shiftBeijingMonth = (
    year: number,
    month: number,
    offset: number,
) => {
    const total = year * 12 + (month - 1) + offset;
    const nextYear = Math.floor(total / 12);
    const nextMonth = ((total % 12) + 12) % 12 + 1;
    return { year: nextYear, month: nextMonth };
};

export const BEIJING_TZ = BEIJING_TIME_ZONE;
