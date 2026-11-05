import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 用户指定 2026-10-17 版 v4.1 Flash。线上 Apollo 没配 FAST / PLAN_SCRIPT，这两类实际用的就是代码默认值。
const FLASH_DEFAULT = "deepseek-v4.1-flash-1017";

describe("coachlinkLlm flash defaults", () => {
    beforeEach(() => {
        vi.stubEnv("WANJIE_ARK_API_KEY", "test-key-not-real");
        vi.stubEnv("WANJIE_ARK_BASE_URL", "http://127.0.0.1:9/api/v1");
        vi.stubEnv("WANJIE_ARK_MODEL", "deepseek-v4-pro");
        vi.stubEnv("WANJIE_ARK_FAST_MODEL", "");
        vi.stubEnv("WANJIE_ARK_PLAN_SCRIPT_MODEL", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("uses deepseek-v4.1-flash-1017 for the fast and plan-script kinds when unset", async () => {
        const { getCoachlinkFastLlm, getCoachlinkPlanScriptLlm } = await import("./coachlinkLlm");

        expect(getCoachlinkFastLlm().model).toBe(FLASH_DEFAULT);
        expect(getCoachlinkPlanScriptLlm().model).toBe(FLASH_DEFAULT);
    });

    it("still lets Apollo override the fast and plan-script models", async () => {
        vi.stubEnv("WANJIE_ARK_FAST_MODEL", "deepseek-v4.1-flash");
        vi.stubEnv("WANJIE_ARK_PLAN_SCRIPT_MODEL", "deepseek-v4-pro");
        const { getCoachlinkFastLlm, getCoachlinkPlanScriptLlm } = await import("./coachlinkLlm");

        expect(getCoachlinkFastLlm().model).toBe("deepseek-v4.1-flash");
        expect(getCoachlinkPlanScriptLlm().model).toBe("deepseek-v4-pro");
    });
});
