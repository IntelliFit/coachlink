/**
 * 周解锁工具函数
 * 用于计算训练计划的当前解锁周次，限制学员只能查看当前周及之前的训练内容
 */

/**
 * 计算从计划开始日期到现在的周次
 * @param startDate 计划开始日期（字符串或Date对象）
 * @returns 当前周次（1-based），如果没有开始日期则返回1
 */
export function calculateCurrentWeek(
    startDate: string | Date | null | undefined,
): number {
    if (!startDate) {
        return 1;
    }

    const start = new Date(startDate);
    const now = new Date();

    // Normalize to local day boundaries to avoid off-by-one caused by time-of-day (e.g. startDate parsed at 08:00).
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    // 如果开始日期在未来，返回第1周
    if (start > now) {
        return 1;
    }

    // 计算天数差
    const diffTime = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 计算周次（第1天到第7天是第1周，第8天到第14天是第2周...）
    return Math.max(1, Math.ceil((diffDays + 1) / 7));
}

/**
 * 根据天索引计算该天属于第几周
 * @param dayIndex 训练日索引（1-based）
 * @returns 该天所属的周次（1-based）
 */
export function getDayWeekNumber(dayIndex: number): number {
    return Math.ceil(dayIndex / 7);
}

/**
 * 判断某一天是否已解锁
 * @param dayIndex 训练日索引（1-based）
 * @param unlockedWeek 当前已解锁的周次
 * @returns 该天是否已解锁
 */
export function isDayUnlocked(dayIndex: number, unlockedWeek: number): boolean {
    const dayWeek = getDayWeekNumber(dayIndex);
    return dayWeek <= unlockedWeek;
}

/**
 * 判断某一周是否已解锁
 * @param weekNumber 要检查的周次（1-based）
 * @param unlockedWeek 当前已解锁的周次
 * @returns 该周是否已解锁
 */
export function isWeekUnlocked(
    weekNumber: number,
    unlockedWeek: number,
): boolean {
    return weekNumber <= unlockedWeek;
}

/**
 * 获取解锁日期（某周将于何时解锁）
 * @param weekNumber 要查询的周次
 * @param startDate 计划开始日期
 * @returns 解锁日期
 */
export function getUnlockDate(
    weekNumber: number,
    startDate: string | Date | null | undefined,
): Date | null {
    if (!startDate) {
        return null;
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    // 第N周在第 (N-1)*7 天开始解锁
    const unlockOffset = (weekNumber - 1) * 7;
    const unlockDate = new Date(start);
    unlockDate.setDate(start.getDate() + unlockOffset);

    return unlockDate;
}

/**
 * 格式化解锁日期显示
 * @param unlockDate 解锁日期
 * @returns 格式化后的日期字符串
 */
export function formatUnlockDate(unlockDate: Date | null): string {
    if (!unlockDate) {
        return "";
    }

    return unlockDate.toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
    });
}

/**
 * 计算距离某周解锁还有多少天
 * @param weekNumber 要查询的周次
 * @param startDate 计划开始日期
 * @returns 距离解锁的天数，如果已解锁则返回0
 */
export function getDaysUntilUnlock(
    weekNumber: number,
    startDate: string | Date | null | undefined,
): number {
    const unlockDate = getUnlockDate(weekNumber, startDate);
    if (!unlockDate) {
        return 0;
    }

    const now = new Date();
    const diffTime = unlockDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
}
