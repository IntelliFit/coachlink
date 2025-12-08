/**
 * Epley 模型的 λ(r)
 * λ_epley(r) = 1 + 0.0333r
 */
export function lambdaEpley(r: number): number {
    if (r <= 0) throw new Error("r 必须大于 0");
    return 1 + 0.0333 * r;
}

/**
 * Brzycki 模型的 λ(r)
 * λ_brzycki(r) = 36 / (37 - r)
 */
export function lambdaBrzycki(r: number): number {
    if (r <= 0 || r >= 37) {
        throw new Error("r 必须在 (0, 37) 区间内");
    }
    return 36 / (37 - r);
}

/**
 * Lombardi 模型的 λ(r)
 * λ_lombardi(r) = r ^ 0.1
 */
export function lambdaLombardi(r: number): number {
    if (r <= 0) throw new Error("r 必须大于 0");
    return Math.pow(r, 0.1);
}

/**
 * 三模型平均 λ(r)
 *
 * λ_avg(r) =
 * (λ_epley + λ_brzycki + λ_lombardi) / 3
 */
export function lambdaAverage(r: number): number {
    const e = lambdaEpley(r);
    const b = lambdaBrzycki(r);
    const l = lambdaLombardi(r);

    return (e + b + l) / 3;
}


/**
 * 支持的 λ 模型类型
 */
export type LambdaModel = 
    | "average"   // 三公式平均
    | "epley"
    | "brzycki"
    | "lombardi";

/**
 * 计算推荐负重 L_r
 *
 * 公式：
 * L_r = (1RM + αW) / λ(r) - αW
 */
export function calcRecommendedLoad(
    oneRM: number,
    weight: number,
    reps: number,
    alpha: number = 1,
    model: LambdaModel = "average"
): number {
    if (oneRM <= 0) throw new Error("1RM 必须大于 0");
    if (weight <= 0) throw new Error("体重必须大于 0");

    let lambda: number;

    switch (model) {
        case "epley":
            lambda = lambdaEpley(reps);
            break;
        case "brzycki":
            lambda = lambdaBrzycki(reps);
            break;
        case "lombardi":
            lambda = lambdaLombardi(reps);
            break;
        case "average":
        default:
            lambda = lambdaAverage(reps);
    }

    const load = (oneRM + alpha * weight) / lambda - alpha * weight;

    return Math.max(0, Number(load.toFixed(2)));
}
