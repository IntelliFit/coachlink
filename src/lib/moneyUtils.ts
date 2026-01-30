/**
 * 金额工具 - 内部统一「分」（整数），仅展示时转为「元」
 *
 * 约定：
 * - 数据库、API 内部传递、业务计算：一律使用「分」（整数）
 * - 转为「元」只发生在：返回给前端的字段、调支付宝等第三方接口的字符串
 *
 * 精度：用 decimal.js 做元↔分换算及带小数的乘除，避免 JS 浮点问题。
 */

import Decimal from "decimal.js";

const FEN_PER_YUAN = 100;

/**
 * 元 → 分（整数）
 * 仅用于：前端/第三方传入的「元」转成内部「分」
 */
export function yuanToFen(yuan: number | string | null | undefined): number {
    if (yuan === null || yuan === undefined) return 0;
    const n = typeof yuan === "string" ? parseFloat(yuan) : yuan;
    if (!Number.isFinite(n)) return 0;
    return new Decimal(n).times(FEN_PER_YUAN).round().toNumber();
}

/**
 * 分 → 元（小数，用于展示或第三方接口）
 * 仅用于：返回给前端、或调支付宝等需要「元」的地方
 */
export function fenToYuan(fen: number | string | null | undefined): number {
    if (fen === null || fen === undefined) return 0;
    const n = typeof fen === "string" ? parseInt(fen, 10) : fen;
    if (!Number.isFinite(n)) return 0;
    return new Decimal(n).div(FEN_PER_YUAN).toNumber();
}

/**
 * 格式化「元」为两位小数字符串（如 "3.14"）
 */
export function formatYuan(yuan: number | string | null | undefined): string {
    const n = typeof yuan === "string" ? parseFloat(yuan) : yuan;
    if (!Number.isFinite(n)) return "0.00";
    return new Decimal(n).toFixed(2);
}

/**
 * 分 → 格式化的元字符串（仅展示用）
 */
export function formatYuanFromFen(fen: number | string | null | undefined): string {
    return formatYuan(fenToYuan(fen));
}

/** 分 + 分 → 分（整数，精度安全） */
export function addFen(fen1: number, fen2: number): number {
    const a = Math.round(Number(fen1) || 0);
    const b = Math.round(Number(fen2) || 0);
    return a + b;
}

/** 分 - 分 → 分 */
export function subtractFen(fen1: number, fen2: number): number {
    const a = Math.round(Number(fen1) || 0);
    const b = Math.round(Number(fen2) || 0);
    return a - b;
}

/**
 * 分 × 系数 → 分（四舍五入）
 * 系数可为小数（如 0.01 表示 1%），用 Decimal 保证精度
 */
export function multiplyFen(fen: number, multiplier: number): number {
    const f = Math.round(Number(fen) || 0);
    return new Decimal(f).times(multiplier).round().toNumber();
}

/**
 * 分 ÷ 数 → 分（四舍五入）
 */
export function divideFen(fen: number, divisor: number): number {
    if (!Number.isFinite(divisor) || divisor === 0) return 0;
    const f = Math.round(Number(fen) || 0);
    return new Decimal(f).div(divisor).round().toNumber();
}

/** 保证分不为负 */
export function ensureNonNegativeFen(fen: number): number {
    const n = Math.round(Number(fen) || 0);
    return Math.max(0, n);
}

/**
 * 从任意值安全取「分」：若已是整数则视为分，否则视为元并转换（兼容旧数据）
 * 仅在对来源不确定时使用；确定来自 DB 的金额应直接 Number(x)
 */
export function toFenSafe(value: number | string | null | undefined, alreadyFen: boolean): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "string" ? parseFloat(value) : value;
    if (!Number.isFinite(n)) return 0;
    if (alreadyFen) return Math.round(n);
    return yuanToFen(n);
}
