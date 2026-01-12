import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { AddVideoToCollectionDto, AddVideoToCollectionResponseDto } from './entity';
import { getOwnedExecutionSetVideo, getOwnedTrainingVideo } from '../_helpers/videoCollection';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json() as AddVideoToCollectionDto;
    const { trainingVideoId, executionSetVideoId, title, description, tags, isFeatured } = body;

    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    const normalizedTitle = typeof title === 'string' ? title.trim() : '';

    if (!normalizedDescription) {
        return NextResponse.json({
            success: false,
            message: '请填写视频描述',
            data: null
        }, { status: 400 });
    }

    if (!trainingVideoId && !executionSetVideoId) {
        return NextResponse.json({
            success: false,
            message: '缺少视频来源',
            data: null
        }, { status: 400 });
    }

    try {
        let source: string = 'manual';
        let videoUrl: string | null = null;
        let thumbnailUrl: string | null = null;
        let storagePath: string | null = null;
        let storageBucket: string | null = null;
        let durationSeconds: number | null = null;
        let fileSize: number | null = null;
        let processingStatus: string | null = null;

        if (trainingVideoId) {
            const trainingVideo = await getOwnedTrainingVideo(trainingVideoId, userId);
            if (!trainingVideo) {
                return NextResponse.json({
                    success: false,
                    message: '未找到对应的训练视频或无权限',
                    data: null
                }, { status: 403 });
            }
            source = 'training_video';
            videoUrl = trainingVideo.video_url;
            thumbnailUrl = trainingVideo.thumbnail_url;
            durationSeconds = trainingVideo.duration_seconds;
            fileSize = trainingVideo.file_size;
            processingStatus = trainingVideo.processing_status;
            storageBucket = (trainingVideo.metadata as any)?.storage_bucket || null;
            storagePath = (trainingVideo.metadata as any)?.storage_path || null;
        }

        if (executionSetVideoId && !trainingVideoId) {
            const executionVideo = await getOwnedExecutionSetVideo(executionSetVideoId, userId);
            if (!executionVideo) {
                return NextResponse.json({
                    success: false,
                    message: '未找到对应的执行视频或无权限',
                    data: null
                }, { status: 403 });
            }
            source = 'progress_set';
            videoUrl = executionVideo.video_url;
            thumbnailUrl = executionVideo.thumbnail_url;
            durationSeconds = executionVideo.duration_seconds;
            fileSize = executionVideo.file_size;
            processingStatus = executionVideo.review_status ?? null;
            storageBucket = executionVideo.storage_bucket ?? null;
            storagePath = executionVideo.storage_path ?? null;
        }

        const { data, error } = await supabase
            .from('student_video_collections')
            .insert({
                user_id: userId,
                training_video_id: trainingVideoId ?? null,
                execution_set_video_id: executionSetVideoId ?? null,
                source,
                // title 为可选字段；避免写入与 description 重复的冗余数据
                title: normalizedTitle || null,
                description: normalizedDescription,
                tags: tags && tags.length > 0 ? tags : [],
                is_featured: !!isFeatured,
                video_url: videoUrl,
                thumbnail_url: thumbnailUrl,
                storage_path: storagePath,
                storage_bucket: storageBucket,
                duration_seconds: durationSeconds,
                file_size: fileSize,
                processing_status: processingStatus,
            })
            .select()
            .single();

        if (error || !data) {
            throw new Error(error?.message || '创建视频集记录失败');
        }

        return NextResponse.json<ApiData<AddVideoToCollectionResponseDto>>({
            success: true,
            message: '已添加到视频集',
            data: { collection: data }
        });
    } catch (error: any) {
        console.error('add-video-to-collection error', error);
        return NextResponse.json({
            success: false,
            message: error?.message || '添加失败',
            data: null
        }, { status: 500 });
    }
}

