import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getApiUserId } from "@/lib/getApiUserId";
import type { ApiData } from "@/types/api";
import type {
    GetQuestionnairesDto,
    GetQuestionnairesResponseDto,
} from "./entity";
import { TrainingItem } from "@/types/questionnaires";
import {
    ensureQuestionIds,
    parseQuestionnaireDocument,
} from "@/lib/questionnaireDocument";

async function enrichRmQuestions(
    questions: TrainingItem[],
): Promise<TrainingItem[]> {
    const rmActionIds = Array.from(
        new Set(
            questions.flatMap((item: any) =>
                item?.type === "rm" && Array.isArray(item?.actionIds)
                    ? item.actionIds.filter((id: unknown) => typeof id === "string" && id.trim())
                    : [],
            ),
        ),
    );

    if (rmActionIds.length === 0) {
        return questions;
    }

    const { data: actionRows, error: actionError } = await supabase
        .from("coach_actions")
        .select("id, name")
        .in("id", rmActionIds);

    if (actionError) {
        console.error("[get-questionnaires] load rm action names failed:", actionError);
    }

    const actionNameMap = new Map<string, string>();
    (actionRows || []).forEach((row: any) => {
        const id = String(row?.id || "").trim();
        const name = String(row?.name || "").trim();
        if (id && name) actionNameMap.set(id, name);
    });

    return questions.map((item: any) => {
        if (item?.type !== "rm") return item;

        const actionIds = Array.isArray(item?.actionIds) ? item.actionIds : [];
        const existingInputs =
            item?.userInputs && typeof item.userInputs === "object" ? item.userInputs : {};

        const generatedInputs: Record<string, string | number> = {};
        actionIds.forEach((actionId: string, index: number) => {
            const key =
                actionNameMap.get(String(actionId).trim()) ||
                String(actionId || "").trim() ||
                `动作${index + 1}`;
            if (!(key in generatedInputs)) {
                generatedInputs[key] = existingInputs[key] ?? "";
            }
        });

        return {
            ...item,
            userInputs:
                Object.keys(generatedInputs).length > 0
                    ? generatedInputs
                    : existingInputs,
        } as TrainingItem;
    });
}

export async function POST(req: NextRequest) {
    const requesterId = await getApiUserId(req);
    if (!requesterId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    let userId: string;

    const {
        coachId = "",
    } = await req.json() as GetQuestionnairesDto;

    if (!coachId) {
        // 网页端：教练查自己的问卷，需要确认 requester 是教练
        const { data: coachCheck } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", requesterId)
            .maybeSingle();

        if (!coachCheck) {
            return NextResponse.json({
                success: false,
                message: "用户不是教练",
                data: null,
            }, { status: 403 });
        }
        userId = requesterId;
    } else {
        const { data: coach, error: coachError } = await supabase
            .from("coaches")
            .select("user_id")
            .eq("id", coachId)
            .single();

        if (coachError || !coach) {
            return NextResponse.json({
                success: false,
                message: "获取教练信息失败",
                data: null,
            }, { status: 500 });
        }

        userId = coach.user_id;
    }

    // 线上版本就是 status='active' 的那一份；规则保证每个 coach 至多一份。
    const { data: questionnaire, error: fetchError } = await supabase
        .from("coach_questionnaires")
        .select("id,questions,updated_at")
        .eq("coach_id", userId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (fetchError) {
        console.error("[get-questionnaires] fetch error:", fetchError);
        return NextResponse.json({
            success: false,
            message: "获取问卷失败",
            data: null,
        }, { status: 500 });
    }

    const defaultQuestions: TrainingItem[] = [];

    const questionnairesData = questionnaire ?? {
        id: "",
        questions: defaultQuestions,
    };

    const document = parseQuestionnaireDocument((questionnairesData as any)?.questions);
    const sourceQuestions = document.questions.length > 0
        ? document.questions
        : defaultQuestions;

    // 确保每个问题都有稳定 id（用于分支/历史答案匹配）
    const { normalized, changed } = ensureQuestionIds(sourceQuestions as any);

    // 若发现旧数据缺少 id，则自动补齐并持久化（避免每次打开都变）
    if (changed && questionnairesData.id) {
        const { error: patchErr } = await supabase
            .from("coach_questionnaires")
            .update({
                questions: {
                    editorType: document.editorType,
                    questions: normalized,
                } as any,
            })
            .eq("id", questionnairesData.id);
        if (patchErr) {
            console.error("[get-questionnaires] auto-migrate ids failed:", patchErr);
        }
    }

    const enrichedQuestions = await enrichRmQuestions(normalized);

    return NextResponse.json<ApiData<GetQuestionnairesResponseDto>>({
        success: true,
        message: "获取问卷成功",
        data: {
            id: questionnairesData.id,
            questionnaires: enrichedQuestions,
        },
    });
}
