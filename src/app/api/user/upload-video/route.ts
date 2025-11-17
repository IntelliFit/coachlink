import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 以 form-data 接收并上传视频到 Supabase Storage，同时写入 training_videos
export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    let formData: FormData;
    try {
        // 立即读取并存储 formData，避免 Next.js 内部重复读取
        formData = await request.formData();
    } catch (err) {
        console.error('❌ 读取 formData 失败:', err);
        return NextResponse.json({
            success: false,
            message: '无法读取上传数据',
            data: null
        }, { status: 400 });
    }

    try {
        const file = formData.get('file') as File | null;
        const contextRaw = formData.get('context');
        const context = contextRaw ? JSON.parse(contextRaw as string) : {};

        if (!file) {
            return NextResponse.json({
                success: false,
                message: '未提供文件',
                data: null
            }, { status: 400 });
        }

        const userId = session.user.id;
        // 生成安全的文件名：使用时间戳 + 随机字符串，保留原始扩展名
        const ext = file.name.split('.').pop() || 'mp4';
        const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${ext}`;
        const folderPrefix = userId || 'anonymous';
        const filePath = `${folderPrefix}/${safeFileName}`;

        const { error: uploadError } = await supabase.storage.from('videos').upload(filePath, file);
        if (uploadError) {
            console.error('上传失败:', uploadError);
            return NextResponse.json({
                success: false,
                message: '上传视频失败',
                data: null
            });
        }

        const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(filePath);

        // 解析教练信息（若有）→ 方案A：统一使用 coaches.id
        // 目标：得到 coachIdForInsert（coaches.id），若无法确定则为 null
        let coachIdForInsert: string | null = null;

        // 1) 优先从订阅关系获取（coach_subscriptions.coach_id → coaches.id）
        const { data: subRow, error: subErr } = await supabase
            .from('coach_subscriptions')
            .select('coach_id')
            .eq('student_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (subErr) {
            console.warn('查询订阅关系失败:', subErr);
        }
        if (subRow?.coach_id) {
            coachIdForInsert = subRow.coach_id;
        }

        // 2) 若前端显式传入 coach_id，尝试识别其类型并转换为 coaches.id
        const ctxCoachId = (context as any)?.coach_id as string | undefined;
        if (!coachIdForInsert && ctxCoachId) {
            // 2.1 先当作 coaches.id 直接验证
            const { data: coachById } = await supabase
                .from('coaches')
                .select('id')
                .eq('id', ctxCoachId)
                .maybeSingle();
            if (coachById?.id) {
                coachIdForInsert = coachById.id;
            } else {
                // 2.2 再当作 users.id，尝试通过 user_id 反查 coaches.id
                const { data: coachByUser } = await supabase
                    .from('coaches')
                    .select('id')
                    .eq('user_id', ctxCoachId)
                    .maybeSingle();
                if (coachByUser?.id) {
                    coachIdForInsert = coachByUser.id;
                }
            }
        }

        // 3) 可选：仅允许已审核通过的教练
        if (coachIdForInsert) {
            const { data: approvedCoach, error: approveErr } = await supabase
                .from('coaches')
                .select('id, status')
                .eq('id', coachIdForInsert)
                .eq('status', 'approved')
                .maybeSingle();
            if (approveErr || !approvedCoach) {
                console.warn(`coach_id=${coachIdForInsert} 不存在或未审核通过，置为 null`);
                coachIdForInsert = null;
            }
        }

        const insertPayload = {
            user_id: userId,
            coach_id: coachIdForInsert,
            type: context.type,
            training_plan_id: context.training_plan_id ?? null,
            training_session_id: context.training_session_id ?? null,
            exercise_name: context.exercise_name ?? null,
            week_number: context.week_number ?? null,
            day_of_week: context.day_of_week ?? null,
            video_url: publicUrl,
            thumbnail_url: publicUrl,
            file_size: (file as any)?.size ?? null,
            requires_review: context.requires_review ?? true,
            review_status: 'pending' as const,
            user_notes: context.user_notes ?? null,
            processing_status: 'ready' as const,
            tags: [],
            metadata: {
                storage_folder: folderPrefix,
                submission_source: 'file_upload',
            },
        };

        console.log('准备插入视频记录，payload:', JSON.stringify({
            user_id: insertPayload.user_id,
            coach_id: insertPayload.coach_id,
            type: insertPayload.type,
            video_url: insertPayload.video_url.substring(0, 50) + '...'
        }));

        const { data, error } = await supabase
            .from('training_videos')
            .insert(insertPayload)
            .select()
            .single();

        if (error) {
            console.error('❌ 数据库记录创建失败:', error);
            return NextResponse.json({
                success: false,
                message: `创建视频记录失败: ${error.message}`,
                data: null
            }, { status: 500 });
        }

        console.log('✅ 视频上传成功！视频ID:', data?.id);

        return NextResponse.json({
            success: true,
            message: '上传视频成功',
            data
        });
    } catch (err) {
        console.error('❌ 上传视频异常:', err);
        return NextResponse.json({
            success: false,
            message: '服务器内部错误',
            data: null
        }, { status: 500 });
    }
}