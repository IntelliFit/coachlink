import { describe, expect, it } from "vitest";
import {
    ensureQuestionIds,
    parseQuestionnaireDocument,
} from "./questionnaireDocument";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("parseQuestionnaireDocument", () => {
    it("treats a bare array as { editorType: 'simple', questions: array }", () => {
        const raw = [
            { id: "q1", type: "text", question: "hi" },
        ];
        expect(parseQuestionnaireDocument(raw)).toEqual({
            editorType: "simple",
            questions: raw,
        });
    });

    it("infers 'flow' editorType when any inner item has branching", () => {
        const raw = [
            { id: "q1", type: "option", question: "?", options: ["a", "b"] },
            { id: "q2", type: "option", question: "??", options: ["c"], branching: { defaultNext: null } },
        ];
        expect(parseQuestionnaireDocument(raw).editorType).toBe("flow");
    });

    it("infers 'flow' editorType when any inner item has next", () => {
        const raw = [{ id: "q1", type: "text", question: "x", next: null }];
        expect(parseQuestionnaireDocument(raw).editorType).toBe("flow");
    });

    it("unwraps { questions: [...] } shape", () => {
        const inner = [{ id: "q1", type: "text", question: "x" }];
        expect(parseQuestionnaireDocument({ questions: inner })).toEqual({
            editorType: "simple",
            questions: inner,
        });
    });

    it("respects explicit editorType over content inference", () => {
        // 内容看上去像 simple，但显式标了 flow → 仍要采纳 flow
        expect(
            parseQuestionnaireDocument({
                editorType: "flow",
                questions: [{ id: "q1", type: "text", question: "x" }],
            }).editorType,
        ).toBe("flow");

        // 内容里有 branching，但显式标了 simple → 采纳 simple
        expect(
            parseQuestionnaireDocument({
                editorType: "simple",
                questions: [{ id: "q1", type: "text", question: "x", next: null }],
            }).editorType,
        ).toBe("simple");
    });

    it("ignores invalid editorType values and falls back to inference", () => {
        const doc = parseQuestionnaireDocument({
            editorType: "garbage",
            questions: [{ id: "q1", type: "text", question: "x" }],
        });
        expect(doc.editorType).toBe("simple");
    });

    it("unwraps deeply nested { questions: { questions: [...] } } shape", () => {
        const inner = [{ id: "q1", type: "text", question: "deep" }];
        const doc = parseQuestionnaireDocument({ questions: { questions: inner } });
        expect(doc.questions).toEqual(inner);
        expect(doc.editorType).toBe("simple");
    });

    it("returns an empty doc for null / undefined / non-object inputs", () => {
        expect(parseQuestionnaireDocument(null)).toEqual({
            editorType: "simple",
            questions: [],
        });
        expect(parseQuestionnaireDocument(undefined)).toEqual({
            editorType: "simple",
            questions: [],
        });
        expect(parseQuestionnaireDocument("oops")).toEqual({
            editorType: "simple",
            questions: [],
        });
    });

    it("returns empty questions list when object has no recognizable shape", () => {
        expect(parseQuestionnaireDocument({ foo: "bar" })).toEqual({
            editorType: "simple",
            questions: [],
        });
    });
});

describe("ensureQuestionIds", () => {
    it("leaves items with valid id unchanged", () => {
        const input = [
            { id: "q1", type: "text", question: "x" },
            { id: "q2", type: "text", question: "y" },
        ];
        const { normalized, changed } = ensureQuestionIds(input);
        expect(changed).toBe(false);
        expect(normalized).toEqual(input);
    });

    it("fills missing id with a uuid string and reports changed=true", () => {
        const input = [{ type: "text", question: "x" }];
        const { normalized, changed } = ensureQuestionIds(input);
        expect(changed).toBe(true);
        expect(normalized).toHaveLength(1);
        const first = normalized[0] as { id: string; type: string; question: string };
        expect(first.id).toMatch(UUID_RE);
        expect(first.type).toBe("text");
        expect(first.question).toBe("x");
    });

    it("only fills the items that lack id (mixed input)", () => {
        const input = [
            { id: "keep", type: "text", question: "x" },
            { type: "text", question: "y" },
        ];
        const { normalized, changed } = ensureQuestionIds(input);
        expect(changed).toBe(true);
        const [first, second] = normalized as Array<{ id: string }>;
        expect(first.id).toBe("keep");
        expect(second.id).toMatch(UUID_RE);
    });

    it("converts a string item into a text question with auto id", () => {
        const { normalized, changed } = ensureQuestionIds(["你的目标？" as any]);
        expect(changed).toBe(true);
        const first = normalized[0] as {
            id: string;
            type: string;
            question: string;
        };
        expect(first.type).toBe("text");
        expect(first.question).toBe("你的目标？");
        expect(first.id).toMatch(UUID_RE);
    });

    it("returns empty list and changed=false for non-array input", () => {
        const { normalized, changed } = ensureQuestionIds(undefined as any);
        expect(changed).toBe(false);
        expect(normalized).toEqual([]);
    });
});
