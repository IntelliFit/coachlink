import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    createMockSupabase,
    type SupabaseExecContext,
} from "@/testUtils/mockSupabase";

let dataStore: Record<string, any> = {};

vi.mock("@/lib/supabaseClient", () => {
    const supabase = createMockSupabase((ctx: SupabaseExecContext) => {
        const key = `${ctx.table}:${ctx.op}`;
        const v = dataStore[key];
        if (typeof v === "function") return v(ctx);
        return v ?? { data: [], error: null };
    });
    return { default: supabase };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    getServerSession: async () => ({
        user: { id: "u-coach-1", is_coach: true },
    }),
}));

import { POST } from "./route";

beforeEach(() => {
    dataStore = {};
});

describe("POST /api/coach/list-questionnaires (integration, mocked DB)", () => {
    it("returns templates without depending on is_active; status comes from row.status", async () => {
        // 模拟数据：3 行问卷，其中一行 status=active（即"已上线"），一行 default
        // 关键：route 不再读 is_active，所以即便老数据 is_active=false 而 status=active
        // 也应当被当作"已上线"。
        dataStore["coach_questionnaires:select"] = (
            ctx: SupabaseExecContext,
        ) => {
            const isDefaultLookup = ctx.filters.some(
                (f) => f.kind === "eq"
                    && f.args[0] === "is_default"
                    && f.args[1] === true,
            );
            if (isDefaultLookup) {
                // is_default=true 的 maybeSingle 查询
                return {
                    data: { id: "qst-default" },
                    error: null,
                };
            }
            // 主列表查询
            return {
                data: [
                    {
                        id: "qst-active",
                        name: "新学员基础问卷",
                        questions: {
                            editorType: "simple",
                            questions: [
                                { id: "q1", type: "text", question: "你的目标？" },
                            ],
                        },
                        status: "active",
                        is_default: false,
                        version: 3,
                        created_at: "2026-04-01T00:00:00Z",
                        updated_at: "2026-04-30T00:00:00Z",
                    },
                    {
                        id: "qst-default",
                        name: "默认草稿",
                        questions: [
                            // 老 shape：纯数组；其中一题带 branching → editorType 应推断为 flow
                            {
                                id: "q1",
                                type: "option",
                                question: "?",
                                options: ["a", "b"],
                                branching: { defaultNext: null },
                            },
                        ],
                        status: "draft",
                        is_default: true,
                        version: 1,
                        created_at: "2026-03-01T00:00:00Z",
                        updated_at: "2026-04-29T00:00:00Z",
                    },
                    {
                        id: "qst-noname",
                        name: "",
                        // 缺 questions：route 应通过 fallbackName 给出"列表问卷"
                        questions: null,
                        status: "draft",
                        is_default: false,
                        version: null,
                        created_at: "2026-02-01T00:00:00Z",
                        updated_at: null,
                    },
                ],
                error: null,
            };
        };

        const req = new Request(
            "http://localhost/api/coach/list-questionnaires",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({}),
            },
        );

        const res = await POST(req);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.data.defaultId).toBe("qst-default");
        expect(json.data.items).toHaveLength(3);

        const byId = Object.fromEntries(
            json.data.items.map((i: any) => [i.id, i]),
        );

        expect(byId["qst-active"].status).toBe("active");
        expect(byId["qst-active"].editorType).toBe("simple");
        expect(byId["qst-active"].is_default).toBe(false);

        expect(byId["qst-default"].status).toBe("draft");
        expect(byId["qst-default"].editorType).toBe("flow"); // 来自 branching 推断
        expect(byId["qst-default"].is_default).toBe(true);

        expect(byId["qst-noname"].name).toBe("列表问卷"); // editorType=simple 兜底名
        expect(byId["qst-noname"].status).toBe("draft");
        expect(byId["qst-noname"].editorType).toBe("simple");

        // 关键断言：返回的 item shape 不包含 is_active 字段
        for (const item of json.data.items) {
            expect(item).not.toHaveProperty("is_active");
        }
    });

    it("returns empty list with null defaultId when coach has no questionnaires", async () => {
        dataStore["coach_questionnaires:select"] = (
            ctx: SupabaseExecContext,
        ) => {
            const isDefaultLookup = ctx.filters.some(
                (f) => f.kind === "eq"
                    && f.args[0] === "is_default"
                    && f.args[1] === true,
            );
            if (isDefaultLookup) {
                return { data: null, error: null };
            }
            return { data: [], error: null };
        };

        const req = new Request(
            "http://localhost/api/coach/list-questionnaires",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({}),
            },
        );

        const res = await POST(req);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.data.items).toEqual([]);
        expect(json.data.defaultId).toBeNull();
    });

    it("treats status='active' as published even when row also had legacy is_active=false", async () => {
        // 这条用例直接验证迁移期场景：旧数据 status='active' 但 is_active=false。
        // 新 route 完全不看 is_active，所以应当返回 status='active'。
        dataStore["coach_questionnaires:select"] = (
            ctx: SupabaseExecContext,
        ) => {
            const isDefaultLookup = ctx.filters.some(
                (f) => f.kind === "eq"
                    && f.args[0] === "is_default"
                    && f.args[1] === true,
            );
            if (isDefaultLookup) {
                return { data: null, error: null };
            }
            return {
                data: [
                    {
                        id: "qst-1",
                        name: "Old data",
                        questions: { editorType: "simple", questions: [] },
                        status: "active",
                        is_default: false,
                        // 故意还带 is_active=false（route 不应消费这个字段）
                        is_active: false,
                        version: 1,
                        created_at: "2026-01-01T00:00:00Z",
                        updated_at: "2026-01-01T00:00:00Z",
                    },
                ],
                error: null,
            };
        };

        const req = new Request(
            "http://localhost/api/coach/list-questionnaires",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({}),
            },
        );

        const res = await POST(req);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].status).toBe("active");
        expect(json.data.items[0]).not.toHaveProperty("is_active");
    });
});
