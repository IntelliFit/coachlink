import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import { createTrainingVideoRecord } from '../_helpers/videoRecord';
import type { SubmitVideoUrlDto } from './entity';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { videoUrl, context } = await request.json() as SubmitVideoUrlDto;

    const userId = session.user.id;

    // 验证URL
    if (!videoUrl) {
        return NextResponse.json({
            success: false,
            message: '缺少视频URL',
            data: null
        }, { status: 400 });
    }

    if (!context?.type) {
        return NextResponse.json({
            success: false,
            message: '缺少上下文信息',
            data: null
        }, { status: 400 });
    }

    // 验证URL格式
    let isValidUrl = false;
    try {
        const urlObj = new URL(videoUrl);
        isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        isValidUrl = false;
    }

    if (!isValidUrl) {
        return NextResponse.json({
            success: false,
            message: '无效的视频URL',
            data: null
        }, { status: 400 });
    }

    const videoRecord = await createTrainingVideoRecord({
        userId,
        videoUrl,
        context,
        submissionSource: 'url_submission'
    });

    return NextResponse.json({
        success: true,
        message: '提交视频URL成功',
        data: videoRecord
    });
}