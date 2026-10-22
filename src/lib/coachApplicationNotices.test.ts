import { describe, expect, it } from "vitest";
import {
    buildCoachApprovedMessage,
    buildCoachNeedsInfoMessage,
    buildCoachRejectedMessage,
    coachHandbookUrl,
} from "./coachApplicationNotices";

describe("coach application notices", () => {
    it("links the handbook on the configured site", () => {
        expect(coachHandbookUrl("https://dev.coachlink.fit/")).toBe("https://dev.coachlink.fit/coach/handbook");
    });

    it("tells approved coaches the setup steps, the 10% fee and the handbook", () => {
        const message = buildCoachApprovedMessage({ baseUrl: "https://coachlink.fit" });
        expect(message).toContain("开店 4 步");
        expect(message).toContain("10%");
        expect(message).toContain("https://coachlink.fit/coach/handbook");
        // 小程序聊天按纯文本显示，不能出现 markdown 链接语法
        expect(message).not.toMatch(/\]\(/);
    });

    it("can leave out the handbook link before the page is live", () => {
        expect(buildCoachApprovedMessage({ includeHandbook: false })).not.toContain("/coach/handbook");
    });

    it("quotes the reviewer's notes when asking for more material", () => {
        const message = buildCoachNeedsInfoMessage("  请补充训练经历  ");
        expect(message).toContain("请补充训练经历");
        expect(message).toContain("我的 → 申请成为教练");
    });

    it("falls back to a default request when the reviewer left no notes", () => {
        expect(buildCoachNeedsInfoMessage("")).toContain("请补充个人简介");
    });

    it("shows the rejection reason or 无", () => {
        expect(buildCoachRejectedMessage("资质不符")).toContain("原因：资质不符");
        expect(buildCoachRejectedMessage(null)).toContain("原因：无");
    });
});
