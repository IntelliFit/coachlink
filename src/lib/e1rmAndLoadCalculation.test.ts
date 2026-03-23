import { describe, expect, it } from "vitest";
import { calculateE1RM } from "@/lib/e1rmCalculator";
import {
    calcRecommendedLoad,
    lambdaAverage,
    lambdaBrzycki,
    lambdaEpley,
    lambdaLombardi,
} from "@/lib/rmCaculator";

describe("calculateE1RM", () => {
    it("reps=1 时 e1RM 等于外加重量（不进入三公式分支）", () => {
        const r = calculateE1RM({
            weight: 100,
            reps: 1,
            bodyWeight: 80,
            includeBodyWeight: true,
        });
        expect(r.e1rm).toBe(100);
        expect(r.epley).toBe(100);
        expect(r.brzycki).toBe(100);
        expect(r.lombardi).toBe(100);
    });

    it("reps<=0 或非有限数时返回全 0", () => {
        expect(calculateE1RM({ weight: 100, reps: 0 }).e1rm).toBe(0);
        expect(calculateE1RM({ weight: 100, reps: -1 }).e1rm).toBe(0);
        expect(calculateE1RM({ weight: 100, reps: NaN as any }).e1rm).toBe(0);
    });

    it("weight 非有限时返回全 0", () => {
        expect(calculateE1RM({ weight: NaN, reps: 5 }).e1rm).toBe(0);
    });

    it("不含自重：外加重量必须 >0，否则返回全 0", () => {
        expect(calculateE1RM({ weight: 0, reps: 5 }).e1rm).toBe(0);
        expect(calculateE1RM({ weight: -5, reps: 5 }).e1rm).toBe(0);
    });

    it("含自重：需要有效体重且 外加+体重>0", () => {
        expect(
            calculateE1RM({
                weight: 10,
                reps: 5,
                includeBodyWeight: true,
                bodyWeight: 0,
            }).e1rm,
        ).toBe(0);
        expect(
            calculateE1RM({
                weight: -100,
                reps: 5,
                includeBodyWeight: true,
                bodyWeight: 80,
            }).e1rm,
        ).toBe(0);
    });

    it("不含自重：100kg×5 次 与三公式平均一致", () => {
        const w = 100;
        const r = 5;
        const epley = w * (1 + 0.0333 * r);
        const brzycki = w * (36 / (37 - r));
        const lombardi = w * Math.pow(r, 0.1);
        const expected = Math.round(((epley + brzycki + lombardi) / 3) * 10) / 10;
        const got = calculateE1RM({ weight: w, reps: r });
        expect(got.e1rm).toBe(expected);
        expect(got.epley).toBe(Math.round(epley * 10) / 10);
    });

    it("含自重：总重参与三公式后再减体重", () => {
        const ext = 20;
        const bw = 80;
        const r = 5;
        const total = ext + bw;
        const epley = total * (1 + 0.0333 * r) - bw;
        const brzycki = total * (36 / (37 - r)) - bw;
        const lombardi = total * Math.pow(r, 0.1) - bw;
        const expected = Math.round(((epley + brzycki + lombardi) / 3) * 10) / 10;
        const got = calculateE1RM({
            weight: ext,
            reps: r,
            bodyWeight: bw,
            includeBodyWeight: true,
        });
        expect(got.e1rm).toBe(expected);
    });

    it("含自重：允许负外加重量（辅助），总重仍 >0", () => {
        const got = calculateE1RM({
            weight: -10,
            reps: 5,
            bodyWeight: 80,
            includeBodyWeight: true,
        });
        expect(got.e1rm).toBeGreaterThan(0);
    });

    it("reps>=37 时 Brzycki 使用 safeReps=36", () => {
        const w = 100;
        const safeReps = 36;
        const epley = w * (1 + 0.0333 * safeReps);
        const brzycki = w * (36 / (37 - safeReps));
        const lombardi = w * Math.pow(safeReps, 0.1);
        const expected = Math.round(((epley + brzycki + lombardi) / 3) * 10) / 10;
        expect(calculateE1RM({ weight: w, reps: 40 }).e1rm).toBe(expected);
    });
});

describe("calcRecommendedLoad", () => {
    it("α=0（纯杠铃类）：L = 1RM / λ，不依赖体重数值", () => {
        const oneRM = 100;
        const reps = 5;
        const lambda = lambdaAverage(reps);
        const expected = Number(((oneRM / lambda)).toFixed(2));
        expect(calcRecommendedLoad(oneRM, 0, reps, 0, "average")).toBe(expected);
        // weight 可非正（产品注释允许），α=0 时不抛错
        expect(calcRecommendedLoad(oneRM, -1, reps, 0, "average")).toBe(expected);
    });

    it("α=1（含自重）：L = (1RM + W) / λ - W", () => {
        const oneRM = 50;
        const bw = 80;
        const reps = 5;
        const lambda = lambdaAverage(reps);
        const expected = Number(
            ((oneRM + bw) / lambda - bw).toFixed(2),
        );
        expect(calcRecommendedLoad(oneRM, bw, reps, 1, "average")).toBe(expected);
    });

    it("α=1 且体重<=0 时抛出", () => {
        expect(() => calcRecommendedLoad(50, 0, 5, 1)).toThrow("体重必须大于 0");
        expect(() => calcRecommendedLoad(50, -10, 5, 1)).toThrow("体重必须大于 0");
    });

    it("各 λ 模型结果不同但公式一致", () => {
        const oneRM = 120;
        const bw = 75;
        const reps = 8;
        for (const model of ["epley", "brzycki", "lombardi"] as const) {
            let lambda: number;
            if (model === "epley") lambda = lambdaEpley(reps);
            else if (model === "brzycki") lambda = lambdaBrzycki(reps);
            else lambda = lambdaLombardi(reps);
            const expected = Number(
                ((oneRM + bw) / lambda - bw).toFixed(2),
            );
            expect(calcRecommendedLoad(oneRM, bw, reps, 1, model)).toBe(expected);
        }
    });

    it("负 1RM（辅助引体语义）在 α=1 下可得到负推荐负重", () => {
        const load = calcRecommendedLoad(-10, 70, 5, 1, "average");
        expect(load).toBeLessThan(0);
    });

    it("reps 非法时底层 λ 抛错", () => {
        expect(() => calcRecommendedLoad(100, 80, 0, 1)).toThrow();
        expect(() => calcRecommendedLoad(100, 80, 37, 1)).toThrow();
    });

    it("与 calculateE1RM 不含自重：往返近似一致（同一组次下由 e1RM 反推工作重量）", () => {
        const workKg = 90;
        const reps = 6;
        const { e1rm } = calculateE1RM({ weight: workKg, reps });
        const back = calcRecommendedLoad(e1rm, 1, reps, 0, "average");
        expect(back).toBeCloseTo(workKg, 0);
    });
});
