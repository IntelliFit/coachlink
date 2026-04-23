import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    CoachAiAutoReplySettingsDto,
    CoachAiAutoReplySettingsResponseDto,
} from "./entity";
import { normalizeCoachAiKnowledgeDocuments } from "@/lib/coachAiKnowledge";

const MAX_PROMPT_LENGTH = 3000;
const MAX_KNOWLEDGE_LENGTH = 12000;
const MAX_KNOWLEDGE_DOCUMENTS = 30;
const MAX_KNOWLEDGE_DOCUMENT_LENGTH = 25000;
const MAX_KNOWLEDGE_DOCUMENTS_TOTAL_LENGTH = 120000;
const MODEL = "deepseek-chat";

async function ensureCoach(userId: string) {
    const { data, error } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return Boolean(data?.id);
}

function mapRow(row: any): CoachAiAutoReplySettingsResponseDto {
    return {
        enabled: Boolean(row?.enabled),
        systemPrompt: row?.system_prompt || "",
        knowledgeBase: row?.knowledge_base || "",
        knowledgeDocuments: normalizeCoachAiKnowledgeDocuments(row?.knowledge_documents),
        model: row?.model || MODEL,
        updatedAt: row?.updated_at || null,
    };
}

function isMissingKnowledgeDocumentsColumn(error: any) {
    const message = String(error?.message || "");
    return message.includes("knowledge_documents") || message.includes("schema cache");
}

async function loadSettingsRow(userId: string) {
    const withDocs = await supabase
        .from("coach_ai_auto_reply_settings" as any)
        .select("enabled, system_prompt, knowledge_base, knowledge_documents, model, updated_at")
        .eq("coach_user_id", userId)
        .maybeSingle();

    if (!withDocs.error || !isMissingKnowledgeDocumentsColumn(withDocs.error)) {
        return withDocs;
    }

    const legacy = await supabase
        .from("coach_ai_auto_reply_settings" as any)
        .select("enabled, system_prompt, knowledge_base, model, updated_at")
        .eq("coach_user_id", userId)
        .maybeSingle();

    return legacy;
}

export async function GET() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const userId = session.user.id;
    const isCoach = await ensureCoach(userId);
    if (!isCoach) {
        return NextResponse.json({ success: false, message: "未找到教练身份", data: null }, { status: 403 });
    }

    const { data, error } = await loadSettingsRow(userId);

    if (error) {
        return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
    }

    return NextResponse.json<ApiData<CoachAiAutoReplySettingsResponseDto>>({
        success: true,
        message: "获取成功",
        data: mapRow(data),
    });
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }

    const userId = session.user.id;
    const isCoach = await ensureCoach(userId);
    if (!isCoach) {
        return NextResponse.json({ success: false, message: "未找到教练身份", data: null }, { status: 403 });
    }

    const body = await req.json() as CoachAiAutoReplySettingsDto;
    const systemPrompt = (body.systemPrompt || "").trim();
    const knowledgeBase = (body.knowledgeBase || "").trim();
    const knowledgeDocuments = normalizeCoachAiKnowledgeDocuments(body.knowledgeDocuments);
    const totalDocumentLength = knowledgeDocuments.reduce((sum, doc) => sum + doc.content.length, 0);

    if (systemPrompt.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ success: false, message: `基础提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, data: null }, { status: 400 });
    }
    if (knowledgeBase.length > MAX_KNOWLEDGE_LENGTH) {
        return NextResponse.json({ success: false, message: `资料库不能超过 ${MAX_KNOWLEDGE_LENGTH} 字`, data: null }, { status: 400 });
    }
    if (knowledgeDocuments.length > MAX_KNOWLEDGE_DOCUMENTS) {
        return NextResponse.json({ success: false, message: `知识文档不能超过 ${MAX_KNOWLEDGE_DOCUMENTS} 个`, data: null }, { status: 400 });
    }
    const oversizedDocument = knowledgeDocuments.find((doc) => doc.content.length > MAX_KNOWLEDGE_DOCUMENT_LENGTH);
    if (oversizedDocument) {
        return NextResponse.json({ success: false, message: `单个知识文档不能超过 ${MAX_KNOWLEDGE_DOCUMENT_LENGTH} 字：${oversizedDocument.title}`, data: null }, { status: 400 });
    }
    if (totalDocumentLength > MAX_KNOWLEDGE_DOCUMENTS_TOTAL_LENGTH) {
        return NextResponse.json({ success: false, message: `知识文档总长度不能超过 ${MAX_KNOWLEDGE_DOCUMENTS_TOTAL_LENGTH} 字`, data: null }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("coach_ai_auto_reply_settings" as any)
        .upsert({
            coach_user_id: userId,
            enabled: Boolean(body.enabled),
            system_prompt: systemPrompt,
            knowledge_base: knowledgeBase,
            knowledge_documents: knowledgeDocuments,
            model: MODEL,
            updated_at: now,
        }, { onConflict: "coach_user_id" })
        .select("enabled, system_prompt, knowledge_base, knowledge_documents, model, updated_at")
        .single();

    if (error) {
        if (isMissingKnowledgeDocumentsColumn(error)) {
            return NextResponse.json({
                success: false,
                message: "数据库尚未执行 AI 知识文档迁移，请先执行 20260420_coach_ai_knowledge_documents.sql",
                data: null,
            }, { status: 400 });
        }
        return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
    }

    return NextResponse.json<ApiData<CoachAiAutoReplySettingsResponseDto>>({
        success: true,
        message: "保存成功",
        data: mapRow(data),
    });
}
