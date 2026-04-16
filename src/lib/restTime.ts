const MAX_REASONABLE_REST_SECONDS = 30 * 60;

/**
 * Normalize planned rest time into seconds.
 *
 * Historical plan data may contain values that were accidentally expanded by 60x
 * (for example, 180 seconds being persisted as 10800). For group rest this is
 * clearly out of range, so we collapse those values back to their intended seconds.
 */
export function normalizePlannedRestSeconds(
    rawValue: unknown,
    fallbackSeconds = 90,
): number {
    if (rawValue === null || rawValue === undefined || rawValue === "") {
        return fallbackSeconds;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
        return fallbackSeconds;
    }

    if (numericValue <= 0) {
        return 0;
    }

    if (numericValue > MAX_REASONABLE_REST_SECONDS) {
        const collapsed = numericValue / 60;
        if (collapsed > 0 && collapsed <= MAX_REASONABLE_REST_SECONDS) {
            return Math.round(collapsed);
        }
    }

    return Math.round(numericValue);
}

