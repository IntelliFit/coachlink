import { NextResponse } from "next/server";

import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import supabase from "@/lib/supabaseClient";
import {
    buildTemplateExportFilename,
    formatTemplateToText,
} from "@/lib/planExportText";
import type { ApiData } from "@/types/api";

import type {
    ExportTemplateTextDto,
    ExportTemplateTextResponseDto,
} from "./entity";

export async function POST(req: Request) {
    const { id } = (await req.json()) as ExportTemplateTextDto;

    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    const userId = authResult.userId || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const isCoach = authResult.user?.is_coach === true || Boolean((await supabase.from("users").select("is_coach").eq("id", userId).single()).data?.is_coach);
    if (!isCoach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    const { data: template, error: templateError } = await supabase
        .from("coach_plan_templates")
        .select("id,name,description,training_days")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (templateError || !template) {
        return NextResponse.json({
            success: false,
            message: "Template not found",
        }, { status: 404 });
    }

    const trainingDays = Array.isArray(template.training_days)
        ? template.training_days
        : typeof template.training_days === "string"
            ? JSON.parse(template.training_days)
            : [];

    const actionIds = new Set<string>();
    for (const day of trainingDays) {
        const actionSets = Array.isArray(day?.actionSets) ? day.actionSets : [];
        for (const actionSet of actionSets) {
            if (actionSet?.type === "no-filter" && actionSet.actionId) {
                actionIds.add(String(actionSet.actionId));
            }
            const branchActions = Array.isArray(actionSet?.actions)
                ? actionSet.actions
                : [];
            for (const branchAction of branchActions) {
                if (branchAction?.actionId) {
                    actionIds.add(String(branchAction.actionId));
                }
            }
        }
    }

    let actionNameById: Record<string, string> = {};
    if (actionIds.size > 0) {
        const { data: coachActions } = await supabase
            .from("coach_actions")
            .select("id,name")
            .eq("coach_id", userId)
            .in("id", Array.from(actionIds));

        actionNameById = Object.fromEntries(
            (coachActions || []).map((action) => [action.id, action.name]),
        );
    }

    const text = formatTemplateToText({
        description: template.description,
        trainingDays,
        actionNameById,
    });

    return NextResponse.json<ApiData<ExportTemplateTextResponseDto>>({
        success: true,
        message: "导出训练计划文本成功",
        data: {
            templateName: template.name,
            text,
            filename: buildTemplateExportFilename(template.name),
        },
    });
}
