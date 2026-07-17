import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { createTrainingVideoRecord } from '../_helpers/videoRecord';
import type { SubmitVideoUrlDto } from './entity';
import { getTrainingVideoSizeError } from '@/lib/trainingVideoLimits';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { videoUrl, context, fileSizeBytes, metadata } = await request.json() as SubmitVideoUrlDto;

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

    const sizeError = fileSizeBytes && fileSizeBytes > 0
        ? getTrainingVideoSizeError(fileSizeBytes)
        : null;
    if (sizeError) {
        return NextResponse.json({
            success: false,
            message: sizeError,
            data: null,
        }, { status: 413 });
    }

    // If this is our own Storage upload, do quota accounting here (to avoid charging for failed uploads).
    if (fileSizeBytes && fileSizeBytes > 0) {
        const { checkStorageAvailable, incrementStorageUsage } = await import(
            "@/lib/membershipLimit"
        );
        const quotaCheck = await checkStorageAvailable(userId, fileSizeBytes);
        if (!quotaCheck.success) {
            return NextResponse.json({
                success: false,
                message: quotaCheck.message || "存储空间不足",
                data: null,
            }, { status: 403 });
        }
        await incrementStorageUsage(userId, fileSizeBytes).catch((e) =>
            console.error("Failed to update storage usage for direct upload", e)
        );
    }

    const videoRecord = await createTrainingVideoRecord({
        userId,
        videoUrl,
        context,
        submissionSource: fileSizeBytes && fileSizeBytes > 0 ? 'file_upload' : 'url_submission',
        fileSize: fileSizeBytes && fileSizeBytes > 0 ? fileSizeBytes : undefined,
        metadata: metadata || undefined,
    });

    return NextResponse.json({
        success: true,
        message: '提交视频URL成功',
        data: videoRecord
    });
}
