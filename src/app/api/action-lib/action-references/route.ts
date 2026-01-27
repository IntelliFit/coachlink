import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    ActionReferencesDto,
    ActionReferencesResponseDto,
} from "./entity";
import { getActionIdFromSet, normalizeTrainingDays } from "@/lib/actionRefs";

export async function POST(req: Request) {
    const { actionIds } = await req.json() as ActionReferencesDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Unauthorized",
            data: null,
        }, { status: 401 });
    }
    if (!session.user.is_coach) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Forbidden",
            data: null,
        }, { status: 403 });
    }

    const ids = Array.isArray(actionIds)
        ? Array.from(new Set(actionIds.filter((x) => typeof x === "string" && x.trim())))
        : [];
    if (ids.length === 0) {
        return NextResponse.json<ApiData<ActionReferencesResponseDto>>({
            success: true,
            message: "ok",
            data: {
                templates: [],
                instances: [],
                totals: { templateCount: 0, instanceCount: 0, matchCount: 0 },
            },
        });
    }

    const target = new Set(ids);

    // 1) templates (coach_id = userId)
    const { data: templates, error: templatesError } = await supabase
        .from("coach_plan_templates")
        .select("id,name,training_days")
        .eq("coach_id", userId);

    if (templatesError) {
        console.error("[action-references] templates error:", templatesError);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Failed to fetch templates",
            data: null,
        }, { status: 500 });
    }

    const templateHits: ActionReferencesResponseDto["templates"] = [];
    let templateMatchTotal = 0;
    for (const t of templates || []) {
        const days = normalizeTrainingDays((t as any).training_days);
        let matches = 0;
        for (const day of days) {
            const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
            for (const s of sets) {
                const aid = getActionIdFromSet(s);
                if (aid && target.has(aid)) matches += 1;
            }
        }
        if (matches > 0) {
            templateMatchTotal += matches;
            templateHits.push({
                templateId: (t as any).id,
                name: (t as any).name,
                matchCount: matches,
            });
        }
    }

    // 2) instances (coach_id = coaches.id for this user)
    const { data: coachRow } = await supabase
        .from("coaches")
        .select("id,status")
        .eq("user_id", userId)
        .maybeSingle();

    const instanceHits: ActionReferencesResponseDto["instances"] = [];
    let instanceMatchTotal = 0;
    if (coachRow?.id) {
        const { data: instances, error: instancesError } = await supabase
            .from("coach_plan_instances")
            .select("id,name,status,student_id,training_days")
            .eq("coach_id", coachRow.id);

        if (instancesError) {
            console.error("[action-references] instances error:", instancesError);
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "Failed to fetch instances",
                data: null,
            }, { status: 500 });
        }

        for (const inst of instances || []) {
            const days = normalizeTrainingDays((inst as any).training_days);
            let matches = 0;
            for (const day of days) {
                const sets = Array.isArray(day?.actionSets) ? day.actionSets : [];
                for (const s of sets) {
                    const aid = getActionIdFromSet(s);
                    if (aid && target.has(aid)) matches += 1;
                }
            }
            if (matches > 0) {
                instanceMatchTotal += matches;
                instanceHits.push({
                    instanceId: (inst as any).id,
                    name: (inst as any).name,
                    status: (inst as any).status ?? null,
                    studentId: (inst as any).student_id ?? null,
                    matchCount: matches,
                });
            }
        }
    }

    const matchCount = templateMatchTotal + instanceMatchTotal;
    return NextResponse.json<ApiData<ActionReferencesResponseDto>>({
        success: true,
        message: "ok",
        data: {
            templates: templateHits.sort((a, b) => b.matchCount - a.matchCount),
            instances: instanceHits.sort((a, b) => b.matchCount - a.matchCount),
            totals: {
                templateCount: templateHits.length,
                instanceCount: instanceHits.length,
                matchCount,
            },
        },
    });
}

