import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';
import type { UploadSetVideoDto, UploadSetVideoResponseDto } from './entity';

/**
 * POST /api/training/upload-set-video
 * 
 * 上传单组训练视频
 */
export async function POST(request: NextRequest) {
    try {
        // 1. 验证用户身份
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: '未登录' },
                { status: 401 }
            );
        }

        const userId = session.user.id;

        // 2. 解析请求参数
        const body: UploadSetVideoDto = await request.json();
        const {
            training_record_id,
            exercise_index,
            set_index,
            video_url,
            thumbnail_url,
            duration_seconds,
            file_size_bytes
        } = body;

        // 3. 验证必填参数
        if (!training_record_id || exercise_index === undefined || set_index === undefined || !video_url) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: '缺少必填参数' },
                { status: 400 }
            );
        }

        // 4. 使用 Supabase 客户端
        // const supabase = createClient(); // 已在顶部导入

        // 5. 验证训练记录是否属于当前用户
        const { data: record, error: recordError } = await supabase
            .from('training_records')
            .select('user_id')
            .eq('id', training_record_id)
            .single();

        if (recordError || !record) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: '训练记录不存在' },
                { status: 404 }
            );
        }

        if (record.user_id !== userId) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: '无权访问此训练记录' },
                { status: 403 }
            );
        }

        // 6. 检查是否已存在该组的视频
        const { data: existingVideo } = await supabase
            .from('set_videos')
            .select('id, video_url')
            .eq('training_record_id', training_record_id)
            .eq('exercise_index', exercise_index)
            .eq('set_index', set_index)
            .maybeSingle();

        if (existingVideo) {
            // 如果已存在且旧视频 URL 不同，尝试删除旧的 Storage 文件
            if (existingVideo.video_url && existingVideo.video_url !== video_url) {
                try {
                    const storageUrl = process.env.NEXT_SUPABASE_URL;
                    if (storageUrl && existingVideo.video_url.includes(storageUrl)) {
                        const urlParts = existingVideo.video_url.split('/videos/');
                        if (urlParts.length === 2) {
                            const oldFilePath = urlParts[1];
                            const { error: storageError } = await supabase.storage
                                .from('videos')
                                .remove([oldFilePath]);
                            
                            if (storageError) {
                                console.error('删除旧 Storage 文件失败:', storageError);
                            } else {
                                console.log('成功删除旧 Storage 文件:', oldFilePath);
                            }
                        }
                    }
                } catch (storageErr) {
                    console.error('处理旧 Storage 文件删除时出错:', storageErr);
                }
            }

            // 更新视频URL
            const { data: updatedVideo, error: updateError } = await supabase
                .from('set_videos')
                .update({
                    video_url,
                    thumbnail_url,
                    duration_seconds,
                    file_size_bytes,
                    upload_status: 'uploaded'
                })
                .eq('id', existingVideo.id)
                .select()
                .single();

            if (updateError) {
                console.error('更新视频失败:', updateError);
                return NextResponse.json<UploadSetVideoResponseDto>(
                    { success: false, message: '更新视频失败' },
                    { status: 500 }
                );
            }

            return NextResponse.json<UploadSetVideoResponseDto>({
                success: true,
                data: {
                    id: updatedVideo.id,
                    training_record_id: updatedVideo.training_record_id,
                    exercise_index: updatedVideo.exercise_index,
                    set_index: updatedVideo.set_index,
                    video_url: updatedVideo.video_url,
                    thumbnail_url: updatedVideo.thumbnail_url || undefined,
                    duration_seconds: updatedVideo.duration_seconds || undefined,
                    file_size_bytes: updatedVideo.file_size_bytes || undefined,
                    upload_status: updatedVideo.upload_status,
                    created_at: updatedVideo.created_at
                }
            });
        }

        // 7. 插入新的视频记录
        const { data: newVideo, error: insertError } = await supabase
            .from('set_videos')
            .insert({
                training_record_id,
                exercise_index,
                set_index,
                video_url,
                thumbnail_url,
                duration_seconds,
                file_size_bytes,
                upload_status: 'uploaded'
            })
            .select()
            .single();

        if (insertError) {
            console.error('插入视频失败:', insertError);
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: '上传视频失败' },
                { status: 500 }
            );
        }

        // 8. 返回成功响应
        return NextResponse.json<UploadSetVideoResponseDto>({
            success: true,
            data: {
                id: newVideo.id,
                training_record_id: newVideo.training_record_id,
                exercise_index: newVideo.exercise_index,
                set_index: newVideo.set_index,
                video_url: newVideo.video_url,
                thumbnail_url: newVideo.thumbnail_url || undefined,
                duration_seconds: newVideo.duration_seconds || undefined,
                file_size_bytes: newVideo.file_size_bytes || undefined,
                upload_status: newVideo.upload_status,
                created_at: newVideo.created_at
            }
        });

    } catch (error) {
        console.error('上传组视频失败:', error);
        return NextResponse.json<UploadSetVideoResponseDto>(
            { success: false, message: '服务器错误' },
            { status: 500 }
        );
    }
}

