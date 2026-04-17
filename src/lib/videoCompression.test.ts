import { describe, expect, it } from "vitest";

import {
    AUTO_COMPRESS_THRESHOLD_BYTES,
    DEFAULT_COMPRESSED_TARGET_BYTES,
    MAX_VIDEO_DIMENSION,
    buildVideoCompressionPlan,
} from "./videoCompression";

describe("buildVideoCompressionPlan", () => {
    it("skips compression for already small low-res videos", () => {
        const plan = buildVideoCompressionPlan(8 * 1024 * 1024, {
            durationSeconds: 20,
            width: 960,
            height: 540,
        });

        expect(plan.shouldCompress).toBe(false);
        expect(plan.targetWidth).toBe(960);
        expect(plan.targetHeight).toBe(540);
    });

    it("compresses large uploads and caps long edge to 1280", () => {
        const plan = buildVideoCompressionPlan(90 * 1024 * 1024, {
            durationSeconds: 45,
            width: 3840,
            height: 2160,
        });

        expect(plan.shouldCompress).toBe(true);
        expect(Math.max(plan.targetWidth, plan.targetHeight)).toBe(MAX_VIDEO_DIMENSION);
        expect(plan.targetMaxBytes).toBeLessThanOrEqual(DEFAULT_COMPRESSED_TARGET_BYTES);
        expect(plan.targetMaxBytes).toBeLessThan(90 * 1024 * 1024);
    });

    it("can still resize high-res videos even below the size threshold", () => {
        const plan = buildVideoCompressionPlan(AUTO_COMPRESS_THRESHOLD_BYTES - 1, {
            durationSeconds: 15,
            width: 2560,
            height: 1440,
        });

        expect(plan.shouldCompress).toBe(true);
        expect(plan.targetWidth).toBe(1280);
        expect(plan.targetHeight).toBe(720);
    });
});
