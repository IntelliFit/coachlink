import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    calculateE1RM,
    type E1RMCalculationParams,
    requiresBodyWeightFallback,
} from "@/lib/e1rmCalculator";
import type { ApiData } from "@/types/api";
import type {
    CalculateE1RMDto,
    CalculateE1RMResponseDto,
} from "./entity";

/**
 * POST /api/execution/calculate-e1rm
 *
 * Calculate estimated 1RM using 2-formula average method
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<CalculateE1RMResponseDto>>(
                { success: false, message: "未登录", data: null },
                { status: 401 },
            );
        }

        const body: CalculateE1RMDto = await request.json();
        const { weight, reps, bodyWeight, includeBodyWeight, actionName } =
            body;

        // Validate required params
        if (weight === undefined || reps === undefined) {
            return NextResponse.json<ApiData<CalculateE1RMResponseDto>>(
                {
                    success: false,
                    message: "缺少必填参数: weight, reps",
                    data: null,
                },
                { status: 400 },
            );
        }

        if (weight <= 0 || reps <= 0) {
            return NextResponse.json<ApiData<CalculateE1RMResponseDto>>(
                {
                    success: false,
                    message: "weight 和 reps 必须大于0",
                    data: null,
                },
                { status: 400 },
            );
        }

        // Determine if body weight should be included
        let shouldIncludeBodyWeight = includeBodyWeight ?? false;
        if (actionName && !includeBodyWeight) {
            shouldIncludeBodyWeight = requiresBodyWeightFallback(actionName);
        }

        // Calculate e1RM
        const params: E1RMCalculationParams = {
            weight,
            reps,
            bodyWeight: bodyWeight ?? 0,
            includeBodyWeight: shouldIncludeBodyWeight,
        };

        const result = calculateE1RM(params);

        // Build formula string for display
        let formula: string;
        if (shouldIncludeBodyWeight && bodyWeight) {
            formula =
                `(${weight}kg + ${bodyWeight}kg自重) × avg(Epley, Brzycki) = ${result.e1rm}kg`;
        } else {
            formula =
                `${weight}kg × ${reps}次 → avg(${result.epley}, ${result.brzycki}) = ${result.e1rm}kg`;
        }

        return NextResponse.json<ApiData<CalculateE1RMResponseDto>>({
            success: true,
            message: "计算成功",
            data: {
                e1rm: result.e1rm,
                epley: result.epley,
                brzycki: result.brzycki,
                formula,
                includesBodyWeight: shouldIncludeBodyWeight,
            },
        });
    } catch (error) {
        console.error("计算e1RM失败:", error);
        return NextResponse.json<ApiData<CalculateE1RMResponseDto>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}
