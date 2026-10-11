import { NextRequest, NextResponse } from 'next/server';
import { POST as getInstance } from '@/app/api/plan-lib/get-instance/route';
import { canStartPlanDay, normalizePlanDays } from '@coachlink/core/src/trainingAccess';

/** Compatibility endpoint: old screens must use the same progress as the homepage. */
export async function POST(request: Request) {
    try {
        const { instanceId } = await request.json();
        if (!instanceId) return NextResponse.json({ success: false, message: '缺少 instanceId 参数' }, { status: 400 });
        const response = await getInstance(new NextRequest(request.url, {
            method: 'POST', headers: request.headers, body: JSON.stringify({ id: instanceId }),
        }));
        if (!response.ok) return response;
        const payload = await response.json();
        if (!payload.success || !payload.data?.instance) return NextResponse.json(payload);
        const data = payload.data;
        const days = normalizePlanDays(data.instance.training_days);
        const progressDayIndex = Number(data.recommendedDayIndex || 1);
        const next = days.find(day => canStartPlanDay({ trainingDays: days, progressDayIndex,
            targetDayIndex: day.dayIndex, executionsByDayIndex: data.executionsByDayIndex }));
        return NextResponse.json({ success: true, message: '获取成功', data: {
            ...data, nextDayIndex: next?.dayIndex ?? progressDayIndex,
            startExecutionDay: data.instance.start_execution_day,
        } });
    } catch {
        return NextResponse.json({ success: false, message: '无法核对训练进度，请重试' }, { status: 500 });
    }
}
