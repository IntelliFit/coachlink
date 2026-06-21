import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { PublishContentDto, PublishContentResponseDto } from './entity';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {

    const {
        title,
        content,
        content_type,
        required_tier,
        price_cents,
        column_id = null,
        column_sort_order = null,
        is_featured,
        tags,
        media_urls = [],
        thumbnail_url,
        isDraft = false,
        notifyAllStudents = false,
        knowledge_node_id = null
    } = await req.json() as PublishContentDto & { knowledge_node_id?: string | null };

    // 获取当前登录用户
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    const userId = authResult.userId || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '缺少用户ID'
        }, { status: 401 });
    }

    if (!title || !content) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数'
        }, { status: 400 });
    }

    if (![0, 1, 2, 3].includes(required_tier)) {
        return NextResponse.json({
            success: false,
            message: '无效的权限等级'
        }, { status: 400 });
    }

    if (!['text', 'video', 'image', 'live', 'plan'].includes(content_type)) {
        return NextResponse.json({
            success: false,
            message: '无效的内容类型'
        }, { status: 400 });
    }

    const resolvedPriceCents = Math.max(0, Math.floor(Number(price_cents ?? 0)));
    const resolvedColumnId = column_id || null;

    // 验证教练是否存在、状态为 approved 且属于当前用户
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id, user_id, status')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .single();


    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: '教练不存在、未通过审核或无权限'
        }, { status: 404 });
    }

    if (resolvedColumnId) {
        const { data: column, error: columnError } = await supabase
            .from('coach_content_columns')
            .select('id')
            .eq('id', resolvedColumnId)
            .eq('coach_id', coach.id)
            .single();

        if (columnError || !column) {
            return NextResponse.json({
                success: false,
                message: '所选专栏不存在或无权限'
            }, { status: 400 });
        }
    }

    // 插入内容记录
    const contentData = {
        coach_id: coach.id,
        column_id: resolvedColumnId,
        column_sort_order: column_sort_order == null ? null : Number(column_sort_order),
        title: title.trim(),
        content: content.trim(),
        content_type,
        required_tier,
        price_cents: resolvedPriceCents,
        is_featured: is_featured ?? false,
        tags: tags ?? [],
        media_urls: media_urls ?? [],
        thumbnail_url: thumbnail_url ?? null,
        knowledge_node_id: knowledge_node_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data: publishedContent, error: publishError } = await supabase
        .from('coach_contents')
        .insert([contentData])
        .select('*')
        .single();

    if (publishError) {
        console.error('发布内容失败:', publishError);
        return NextResponse.json({
            success: false,
            message: '发布失败，请重试'
        }, { status: 500 });
    }

    // 如果选中了"@全体学员"并且不是草稿，发送通知
    if (notifyAllStudents && !isDraft) {
        try {
            // 生成内容预览（去除HTML标签，截取前100字）
            const plainTextContent = content
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const contentPreview = plainTextContent.length > 100 
                ? plainTextContent.substring(0, 100) + '...' 
                : plainTextContent;

            // 构建通知消息
            const notificationMessage = `${title}\n\n${contentPreview}`;

            // 获取所有活跃订阅的学员
            const { data: subscriptions, error: subsError } = await supabase
                .from('coach_subscriptions')
                .select('student_id')
                .eq('coach_id', coach.id)
                .eq('status', 'active');

            if (subsError) {
                console.error('获取订阅学员失败:', subsError);
            } else if (subscriptions && subscriptions.length > 0) {
                const studentUserIds = subscriptions.map((s: any) => s.student_id).filter(Boolean);

                // 为每个学员创建聊天室并发送消息
                const now = new Date().toISOString();
                for (const studentUserId of studentUserIds) {
                    try {
                        // 获取或创建聊天室
                        const { data: existingRoom } = await supabase
                            .from('chat_rooms')
                            .select('id')
                            .contains('members', [userId, studentUserId])
                            .maybeSingle();

                        let roomId = existingRoom?.id;

                        if (!roomId) {
                            const { data: newRoom, error: roomError } = await supabase
                                .from('chat_rooms')
                                .insert({
                                    members: [userId, studentUserId],
                                    type: 'private',
                                    unread_members: [],
                                    is_archived: false,
                                    created_at: now,
                                    updated_at: now,
                                })
                                .select('id')
                                .single();

                            if (roomError) {
                                console.error('创建聊天室失败:', roomError);
                                continue;
                            }
                            roomId = newRoom.id;
                        }

                        // 插入消息，包含内容链接
                        const { error: messageError } = await supabase
                            .from('chat_messages')
                            .insert({
                                room_id: roomId,
                                sender_id: userId,
                                message_type: 'text',
                                content: notificationMessage,
                                created_at: now,
                                content_metadata: {
                                    broadcast: true,
                                    contentId: publishedContent.id,
                                    contentTitle: title,
                                    contentLink: `/coach/content/${publishedContent.id}`
                                }
                            } as any);

                        if (messageError) {
                            console.error('发送消息失败:', messageError);
                            continue;
                        }

                        // 更新聊天室
                        await supabase
                            .from('chat_rooms')
                            .update({
                                last_message: notificationMessage,
                                last_message_at: now,
                                unread_members: [studentUserId],
                                updated_at: now,
                            })
                            .eq('id', roomId);

                    } catch (error) {
                        console.error('发送通知给学员失败:', error);
                    }
                }
            }
        } catch (error) {
            console.error('发送全体学员通知失败:', error);
            // 不影响发布成功，只记录错误
        }
    }

    return NextResponse.json({
        success: true,
        message: isDraft ? '草稿保存成功' : '内容发布成功',
        data: publishedContent as PublishContentResponseDto
    });
}
