import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RETIRED = "deepseek-v4-flash";
// 用户指定 2026-10-17 版 v4.1 Flash；与线上 WANJIE_ARK_PLAN_MODEL 一致。
const REPLACEMENT = "deepseek-v4.1-flash-1017";

const MODEL_ENV_KEYS = [
    "WANJIE_ARK_MODEL",
    "WANJIE_ARK_PLAN_MODEL",
    "WANJIE_ARK_PLAN_SCRIPT_MODEL",
    "WANJIE_ARK_COACH_REPLY_MODEL",
    "WANJIE_ARK_VISION_MODEL",
    "WANJIE_ARK_FAST_MODEL",
] as const;

// 每个用例重新加载模块，保证「每个模型只告警一次」的进程内状态互不影响。
async function loadLlm() {
    vi.resetModules();
    return import("./coachlinkLlm");
}

describe("coachlinkLlm model resolution", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.stubEnv("WANJIE_ARK_API_KEY", "test-key-not-real");
        vi.stubEnv("WANJIE_ARK_BASE_URL", "http://127.0.0.1:9/api/v1");
        for (const key of MODEL_ENV_KEYS) vi.stubEnv(key, "");
        vi.stubEnv("WANJIE_ARK_MODEL", "deepseek-v4-pro");
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        warnSpy.mockRestore();
    });

    it("replaces a retired plan model with one the gateway serves", async () => {
        vi.stubEnv("WANJIE_ARK_PLAN_MODEL", RETIRED);
        const { getCoachlinkPlanLlm } = await loadLlm();

        expect(getCoachlinkPlanLlm().model).toBe(REPLACEMENT);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(String(warnSpy.mock.calls[0]?.[0])).toContain(RETIRED);
        expect(String(warnSpy.mock.calls[0]?.[0])).toContain("WANJIE_ARK_PLAN_MODEL");
    });

    it("warns only once per process for the same retired model", async () => {
        vi.stubEnv("WANJIE_ARK_PLAN_MODEL", RETIRED);
        const { getCoachlinkPlanLlm } = await loadLlm();

        getCoachlinkPlanLlm();
        getCoachlinkPlanLlm();
        getCoachlinkPlanLlm();

        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("trims surrounding whitespace before checking for a retired model", async () => {
        vi.stubEnv("WANJIE_ARK_PLAN_MODEL", `  ${RETIRED}  `);
        const { getCoachlinkPlanLlm } = await loadLlm();

        expect(getCoachlinkPlanLlm().model).toBe(REPLACEMENT);
    });

    it("keeps a served plan model as configured", async () => {
        vi.stubEnv("WANJIE_ARK_PLAN_MODEL", "deepseek-v4.1-flash");
        const { getCoachlinkPlanLlm } = await loadLlm();

        expect(getCoachlinkPlanLlm().model).toBe("deepseek-v4.1-flash");
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("falls back to WANJIE_ARK_MODEL when no plan model is configured", async () => {
        const { getCoachlinkPlanLlm } = await loadLlm();

        expect(getCoachlinkPlanLlm().model).toBe("deepseek-v4-pro");
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("replaces a retired WANJIE_ARK_MODEL used as the plan fallback", async () => {
        vi.stubEnv("WANJIE_ARK_MODEL", RETIRED);
        const { getCoachlinkPlanLlm, getCoachlinkLlm } = await loadLlm();

        expect(getCoachlinkPlanLlm().model).toBe(REPLACEMENT);
        expect(getCoachlinkLlm().model).toBe(REPLACEMENT);
    });

    // 线上 Apollo 没配 FAST / PLAN_SCRIPT，这两类实际用的就是代码默认值。
    it("resolves the fast and plan-script kinds to deepseek-v4.1-flash-1017 when unset", async () => {
        const { getCoachlinkFastLlm, getCoachlinkPlanScriptLlm } = await loadLlm();

        expect(getCoachlinkFastLlm().model).toBe(REPLACEMENT);
        expect(getCoachlinkPlanScriptLlm().model).toBe(REPLACEMENT);
    });

    it("replaces a retired model set explicitly for the fast and plan-script kinds", async () => {
        vi.stubEnv("WANJIE_ARK_FAST_MODEL", RETIRED);
        vi.stubEnv("WANJIE_ARK_PLAN_SCRIPT_MODEL", RETIRED);
        const { getCoachlinkFastLlm, getCoachlinkPlanScriptLlm } = await loadLlm();

        expect(getCoachlinkFastLlm().model).toBe(REPLACEMENT);
        expect(getCoachlinkPlanScriptLlm().model).toBe(REPLACEMENT);
    });

    it("keeps explicit served models for coach-reply and vision", async () => {
        vi.stubEnv("WANJIE_ARK_COACH_REPLY_MODEL", "deepseek-v4-pro");
        vi.stubEnv("WANJIE_ARK_VISION_MODEL", "qwen3.8-flash");
        const { getCoachlinkCoachReplyLlm, getCoachlinkVisionLlm } = await loadLlm();

        expect(getCoachlinkCoachReplyLlm().model).toBe("deepseek-v4-pro");
        expect(getCoachlinkVisionLlm().model).toBe("qwen3.8-flash");
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
