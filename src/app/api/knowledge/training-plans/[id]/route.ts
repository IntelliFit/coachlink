import { NextResponse } from "next/server";
import type { ApiData } from "@/types/api";
import {
    getPublishedTrainingPlanByIdOrSlug,
    toTrainingPlanDetail,
} from "../_helpers";
import curatedReferences from "@/data/curatedTrainingPlanReferences.json";

export async function GET(
    _req: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;
    const decodedId = decodeURIComponent(id);
    const reference = curatedReferences.items.find((item) =>
        item.id === decodedId || item.slug === decodedId
    );
    if (reference) {
        return NextResponse.json<ApiData<{ plan: typeof reference }>>({
            success: true,
            message: "获取训练计划参考来源成功",
            data: { plan: reference },
        });
    }

    const template = await getPublishedTrainingPlanByIdOrSlug(decodedId)
        .catch((error) => {
            console.error("[knowledge/training-plans] get failed:", error);
            return null;
        });

    if (!template) {
        return NextResponse.json({
            success: false,
            message: "训练计划模板不存在",
        }, { status: 404 });
    }

    return NextResponse.json<ApiData<{ plan: ReturnType<typeof toTrainingPlanDetail> }>>({
        success: true,
        message: "获取训练计划模板详情成功",
        data: {
            plan: toTrainingPlanDetail(template),
        },
    });
}
