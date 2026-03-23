import { NextResponse } from "next/server";
import { POST as getInstanceRoutePost } from "../get-instance/route";
import type { GetInstanceDto, GetInstanceResponseDto } from "../get-instance/entity";
import type {
    GetTodayTrainingInstanceDto,
    GetTodayTrainingInstanceResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

type InstanceApiResponse = ApiData<GetInstanceResponseDto>;

async function fetchInstanceViaCanonicalRoute(
    payload: GetInstanceDto,
): Promise<GetInstanceResponseDto | null> {
    const internalReq = new Request("http://localhost/api/plan-lib/get-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const res = await getInstanceRoutePost(internalReq);
    const json = (await res.json().catch(() => null)) as
        | InstanceApiResponse
        | null;

    if (!res.ok || !json?.success || !json?.data?.instance) {
        return null;
    }

    return json.data;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const { subscriptionIds } = await req.json() as GetTodayTrainingInstanceDto;

    // Keep this endpoint as a thin aggregation wrapper.
    // Canonical instance logic lives in /api/plan-lib/get-instance.
    const [coachPlanResult, selfPlanResult] = await Promise.allSettled([
        subscriptionIds && subscriptionIds.length > 0
            ? fetchInstanceViaCanonicalRoute({ subscriptionIds })
            : Promise.resolve(null),
        fetchInstanceViaCanonicalRoute({ fetchSelf: true }),
    ]);

    const coachPlan = coachPlanResult.status === "fulfilled"
        ? coachPlanResult.value
        : null;
    const selfPlan = selfPlanResult.status === "fulfilled"
        ? selfPlanResult.value
        : null;

    return NextResponse.json<ApiData<GetTodayTrainingInstanceResponseDto>>({
        success: true,
        message: "获取今日训练计划成功",
        data: {
            coachPlan,
            selfPlan,
        },
    });
}
