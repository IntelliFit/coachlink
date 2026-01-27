import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import type {
    StudentActionReferencesDto,
    StudentActionReferencesResponseDto,
} from "./entity";
import { getActionIdFromSet, normalizeTrainingDays } from "@/lib/actionRefs";

export async function POST(req: Request) {
    const { actionIds } = await req.json() as StudentActionReferencesDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;
    if (!userId) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Unauthorized",
            data: null,
        }, { status: 401 });
    }

    const ids = Array.isArray(actionIds)
        ? Array.from(new Set(actionIds.filter((x) => typeof x === "string" && x.trim())))
        : [];
    if (ids.length === 0) {
        return NextResponse.json<ApiData<StudentActionReferencesResponseDto>>({
            success: true,
            message: "ok",
            data: { instances: [], totals: { instanceCount: 0, matchCount: 0 } },
        });
    }

    const target = new Set(ids);

    // Student actions are mainly referenced by student's self plans (instances)
    const { data: instances, error } = await supabase
        .from("coach_plan_instances")
        .select("id,name,status,training_days,source,student_id")
        .eq("student_id", userId);

    if (error) {
        console.error("[student action-references] instances error:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "Failed to fetch instances",
            data: null,
        }, { status: 500 });
    }

    const hits: StudentActionReferencesResponseDto["instances"] = [];
    let total = 0;
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
            total += matches;
            hits.push({
                instanceId: (inst as any).id,
                name: (inst as any).name,
                status: (inst as any).status ?? null,
                matchCount: matches,
            });
        }
    }

    return NextResponse.json<ApiData<StudentActionReferencesResponseDto>>({
        success: true,
        message: "ok",
        data: {
            instances: hits.sort((a, b) => b.matchCount - a.matchCount),
            totals: { instanceCount: hits.length, matchCount: total },
        },
    });
}

