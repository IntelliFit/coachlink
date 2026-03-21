const BEIJING_TIME_ZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

type DateInput = Date | string | number;

const isValidDate = (value: Date) => Number.isFinite(value.getTime());

const normalizeDateString = (raw: string) => {
    let value = raw.trim();
    if (!value) return value;

    // Normalize "YYYY-MM-DD HH:mm:ss+08" -> "YYYY-MM-DDTHH:mm:ss+08:00".
    if (value.includes(" ") && !value.includes("T")) {
        value = value.replace(" ", "T");
    }
    value = value.replace(/([+-]\d{2})(?!:?\d{2})$/, "$1:00");
    // Clamp microseconds to milliseconds to improve parsing compatibility.
    value = value.replace(/(\.\d{3})\d+(?=(Z|[+-]\d{2}:?\d{2})$)/, "$1");

    return value;
};

const getDateFromInput = (input?: DateInput | null): Date => {
    if (input === null || input === undefined) return new Date();

    if (input instanceof Date) {
        return isValidDate(input) ? new Date(input.getTime()) : new Date();
    }

    if (typeof input === "string") {
        const direct = new Date(input);
        if (isValidDate(direct)) return direct;

        const normalized = normalizeDateString(input);
        if (normalized && normalized !== input) {
            const normalizedDate = new Date(normalized);
            if (isValidDate(normalizedDate)) return normalizedDate;
        }

        return new Date();
    }

    const parsed = new Date(input);
    return isValidDate(parsed) ? parsed : new Date();
};

const getBeijingPartsByUtcShift = (date: Date) => {
    const shifted = new Date(date.getTime() + BEIJING_UTC_OFFSET_MS);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        second: shifted.getUTCSeconds(),
    };
};

const createBeijingFormatter = (
    locales: string | string[],
    options: Intl.DateTimeFormatOptions,
) => {
    try {
        return new Intl.DateTimeFormat(locales, {
            ...options,
            timeZone: BEIJING_TIME_ZONE,
        });
    } catch {
        return null;
    }
};

export const getBeijingDateParts = (input?: DateInput | null) => {
    const date = getDateFromInput(input);
    const fmt = createBeijingFormatter("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    if (fmt && typeof fmt.formatToParts === "function") {
        try {
            const parts = fmt.formatToParts(date);
            const year = Number(parts.find((p) => p.type === "year")?.value || 0);
            const month = Number(parts.find((p) => p.type === "month")?.value || 0);
            const day = Number(parts.find((p) => p.type === "day")?.value || 0);
            if (year > 0 && month > 0 && day > 0) {
                return { year, month, day };
            }
        } catch {
            // fallback below
        }
    }

    const fallback = getBeijingPartsByUtcShift(date);
    return { year: fallback.year, month: fallback.month, day: fallback.day };
};

export const getBeijingDayStart = (input?: DateInput | null) => {
    const { year, month, day } = getBeijingDateParts(input);
    // Beijing is UTC+8 (no DST): local 00:00 == previous day 16:00 UTC.
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - BEIJING_UTC_OFFSET_MS);
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
    const date = getDateFromInput(input);
    const formatter = createBeijingFormatter(locales, options);
    if (formatter) {
        try {
            return formatter.format(date);
        } catch {
            // fallback below
        }
    }

    // Fallback path for runtimes missing IANA timezone support.
    const beijingWallTime = new Date(date.getTime() + BEIJING_UTC_OFFSET_MS);
    return new Intl.DateTimeFormat(locales, {
        ...options,
        timeZone: "UTC",
    }).format(beijingWallTime);
};

export const toBeijingISOStringFromWallTime = (input: DateInput) => {
    const d = getDateFromInput(input);
    const utcMs = Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds(),
    ) - 8 * 60 * 60 * 1000;
    return new Date(utcMs).toISOString();
};

export const fromISOStringToBeijingWallTimeDate = (input?: DateInput | null) => {
    const d = getDateFromInput(input);
    const fmt = createBeijingFormatter("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    if (fmt && typeof fmt.formatToParts === "function") {
        try {
            const parts = fmt.formatToParts(d);
            const year = Number(parts.find((p) => p.type === "year")?.value || 0);
            const month = Number(parts.find((p) => p.type === "month")?.value || 0);
            const day = Number(parts.find((p) => p.type === "day")?.value || 0);
            const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
            const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
            const second = Number(parts.find((p) => p.type === "second")?.value || 0);
            if (year > 0 && month > 0 && day > 0) {
                return new Date(year, month - 1, day, hour, minute, second, d.getMilliseconds());
            }
        } catch {
            // fallback below
        }
    }

    const fallback = getBeijingPartsByUtcShift(d);
    return new Date(
        fallback.year,
        fallback.month - 1,
        fallback.day,
        fallback.hour,
        fallback.minute,
        fallback.second,
        d.getMilliseconds(),
    );
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
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - BEIJING_UTC_OFFSET_MS);
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
