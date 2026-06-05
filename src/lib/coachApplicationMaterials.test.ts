import { describe, expect, it } from "vitest";
import {
    deriveLegacyFieldsFromMaterials,
    filterPublicCoachApplicationMaterials,
    normalizeCoachApplicationMaterials,
    validateCoachApplicationMediaUpload,
} from "./coachApplicationMaterials";

describe("coach application materials", () => {
    it("builds rich materials from legacy application fields", () => {
        const materials = normalizeCoachApplicationMaterials(null, {
            achievements: ["市赛冠军"],
            caseStudies: ["12周卧推提升20kg"],
            credentials: [{ name: "NSCA-CPT", url: "https://example.com/cert" }],
        });

        expect(materials).toHaveLength(3);
        expect(materials.map((item) => item.category)).toEqual([
            "achievement",
            "case",
            "credential",
        ]);
        expect(materials[2].links[0].url).toBe("https://example.com/cert");
    });

    it("derives legacy summaries from rich materials", () => {
        const materials = normalizeCoachApplicationMaterials([
            {
                id: "m1",
                category: "achievement",
                title: "地区力量举冠军",
                summary: "83kg级",
                isPublic: true,
            },
            {
                id: "m2",
                category: "case",
                title: "小白入门案例",
                summary: "8周稳定完成三大项",
                isPublic: true,
            },
            {
                id: "m3",
                category: "credential",
                title: "ACE-CPT",
                links: [{ id: "l1", label: "证书", url: "https://example.com/ace" }],
                isPublic: false,
            },
        ]);

        const legacy = deriveLegacyFieldsFromMaterials(materials);

        expect(legacy.achievements).toEqual(["地区力量举冠军：83kg级"]);
        expect(legacy.caseStudies).toEqual(["小白入门案例：8周稳定完成三大项"]);
        expect(legacy.credentials).toEqual([{ name: "ACE-CPT", url: "https://example.com/ace" }]);
    });

    it("filters private materials for public coach profile viewers", () => {
        const visible = filterPublicCoachApplicationMaterials([
            { id: "public", category: "media", title: "训练视频", isPublic: true },
            { id: "private", category: "credential", title: "身份证明", isPublic: false },
        ]);

        expect(visible.map((item) => item.id)).toEqual(["public"]);
    });

    it("validates application media upload rejection cases", () => {
        expect(validateCoachApplicationMediaUpload({
            userId: null,
            contentType: "image/png",
            sizeBytes: 1,
        })).toMatchObject({ ok: false, status: 401 });

        expect(validateCoachApplicationMediaUpload({
            userId: "u1",
            contentType: "application/pdf",
            sizeBytes: 1,
        })).toMatchObject({ ok: false, status: 400 });

        expect(validateCoachApplicationMediaUpload({
            userId: "u1",
            contentType: "image/png",
            sizeBytes: 6 * 1024 * 1024,
        })).toMatchObject({ ok: false, status: 413 });

        expect(validateCoachApplicationMediaUpload({
            userId: "u1",
            contentType: "video/mp4",
            sizeBytes: 200 * 1024 * 1024 + 1,
        })).toMatchObject({ ok: false, status: 413 });
    });
});
