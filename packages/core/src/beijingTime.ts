const BEIJING_TIME_ZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export type DateInput = Date | string | number;

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
    timeZone = BEIJING_TIME_ZONE,
) => {
    try {
        if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat !== "function") return null;
        return new Intl.DateTimeFormat(locales, {
            ...options,
            timeZone,
        });
    } catch {
        return null;
    }
};

// Some mini-program JS engines have no Intl at all. Keep calendar labels usable
// using UTC fields shifted to Beijing time, independent of the device timezone.
const formatBeijingWithoutIntl = (date: Date, locales: string | string[], options: Intl.DateTimeFormatOptions) => {
    const parts = getBeijingPartsByUtcShift(date);
    const zh = /^zh/i.test(Array.isArray(locales) ? locales[0] || "" : locales);
    const pad = (value: number, style?: string) => style === "2-digit" ? String(value).padStart(2, "0") : String(value);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekdayIndex = new Date(date.getTime() + BEIJING_UTC_OFFSET_MS).getUTCDay();
    const year = options.year ? pad(options.year === "2-digit" ? parts.year % 100 : parts.year, options.year) : "";
    const month = options.month ? (options.month === "long" || options.month === "short" || options.month === "narrow"
        ? zh ? `${parts.month}月` : options.month === "long" ? months[parts.month - 1] : months[parts.month - 1].slice(0, options.month === "narrow" ? 1 : 3)
        : pad(parts.month, options.month)) : "";
    const day = options.day ? pad(parts.day, options.day) : "";
    const weekday = options.weekday ? zh ? `${options.weekday === "long" ? "星期" : options.weekday === "short" ? "周" : ""}${"日一二三四五六"[weekdayIndex]}`
        : options.weekday === "long" ? weekdays[weekdayIndex] : weekdays[weekdayIndex].slice(0, options.weekday === "narrow" ? 1 : 3) : "";
    const dateLabel = zh && (options.month === "long" || options.month === "short" || options.month === "narrow")
        ? `${year ? year + "年" : ""}${month}${day ? day + "日" : ""}`
        : [year, month, day].filter(Boolean).join("/");
    const hour12 = options.hour12 ?? (options.hourCycle ? options.hourCycle === "h11" || options.hourCycle === "h12" : !zh);
    const hour = hour12 ? (options.hourCycle === "h11" ? parts.hour % 12 : parts.hour % 12 || 12)
        : options.hourCycle === "h24" && parts.hour === 0 ? 24 : parts.hour;
    const time = [options.hour ? pad(hour, options.hour) : "", options.minute ? pad(parts.minute, options.minute) : "", options.second ? pad(parts.second, options.second) : ""].filter(Boolean).join(":");
    const period = time && options.hour && hour12 ? zh ? parts.hour < 12 ? "上午" : "下午" : parts.hour < 12 ? "AM" : "PM" : "";
    const timeLabel = period ? zh ? period + time : `${time} ${period}` : time;
    const label = [dateLabel, weekday, timeLabel].filter(Boolean).join(" ");
    return label || `${parts.year}/${pad(parts.month, "2-digit")}/${pad(parts.day, "2-digit")}`;
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

    // Engines with Intl but without IANA zones may still support UTC.
    const beijingWallTime = new Date(date.getTime() + BEIJING_UTC_OFFSET_MS);
    const utcFormatter = createBeijingFormatter(locales, options, "UTC");
    if (utcFormatter) {
        try { return utcFormatter.format(beijingWallTime); } catch { /* fallback below */ }
    }
    return formatBeijingWithoutIntl(date, locales, options);
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
