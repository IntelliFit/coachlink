import { describe, expect, it } from "vitest";
import { getConversationPreview } from "./chatPreview";

describe("getConversationPreview", () => {
    it("prefers 内容 line for training feedback block", () => {
        const raw = `【训练反馈】完成第 10 天训练后提交了反馈
难度：轻松
内容：今天感觉很好，想加重量`;
        expect(getConversationPreview(raw)).toContain("反馈：");
        expect(getConversationPreview(raw)).toContain("加重量");
    });

    it("handles empty and null", () => {
        expect(getConversationPreview(null)).toBe("暂无消息");
        expect(getConversationPreview("")).toBe("暂无消息");
    });

    it("passes through image and file placeholders", () => {
        expect(getConversationPreview("[图片]")).toBe("[图片]");
        expect(getConversationPreview("[文件]")).toBe("[文件]");
    });

    it("summarizes training feedback without 内容 line", () => {
        const raw = "【训练反馈】完成第 3 天训练后提交了反馈";
        expect(getConversationPreview(raw)).toContain("训练反馈");
        expect(getConversationPreview(raw)).toContain("第3天");
    });
});
