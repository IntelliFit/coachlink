import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { UpdateContentDto, UpdateContentResponseDto } from './entity';
import { getAuthUser } from '@/lib/auth';

export async function POST(req: Request) {
    const {
        id,
        title,
        content,
        content_type,
        required_tier,
        price_cents,
        column_id,
        column_sort_order,
        is_featured,
        tags,
        media_urls = [],
        thumbnail_url,
        isDraft = false,
        notifyAllStudents = false,
        knowledge_node_id
    } = await req.json() as UpdateContentDto & { knowledge_node_id?: string | null };

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

    if (!id) {
        return NextResponse.json({
            success: false,
            message: '缺少内容ID'
        }, { status: 400 });
    }

    // 构建更新数据对象
    const updateData: any = {
        updated_at: new Date().toISOString()
    };

    // 只有提供了值的字段才会被更新
    if (title !== undefined) updateData.title = title?.trim();
    if (content !== undefined) updateData.content = content?.trim();
    if (content_type !== undefined) updateData.content_type = content_type;
    if (required_tier !== undefined) updateData.required_tier = required_tier;
    if (price_cents !== undefined) updateData.price_cents = Math.max(0, Math.floor(Number(price_cents ?? 0)));
    if (column_id !== undefined) updateData.column_id = column_id || null;
    if (column_sort_order !== undefined) updateData.column_sort_order = column_sort_order == null ? null : Number(column_sort_order);
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (tags !== undefined) updateData.tags = tags;
    if (media_urls !== undefined) updateData.media_urls = media_urls;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;
    if (knowledge_node_id !== undefined) updateData.knowledge_node_id = knowledge_node_id;

    // 验证教练是否有权限更新此内容
    const { data: existingContent, error: contentError } = await supabase
        .from('coach_contents')
        .select('coach_id')
        .eq('id', id)
        .single();

    if (contentError || !existingContent) {
        return NextResponse.json({
            success: false,
            message: '内容不存在'
        }, { status: 404 });
    }

    // 验证教练身份
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', userId)
        .eq('id', existingContent.coach_id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: '无权限更新此内容'
        }, { status: 403 });
    }

    if (updateData.column_id) {
        const { data: column, error: columnError } = await supabase
            .from('coach_content_columns')
            .select('id')
            .eq('id', updateData.column_id)
            .eq('coach_id', coach.id)
            .single();

        if (columnError || !column) {
            return NextResponse.json({
                success: false,
                message: '所选专栏不存在或无权限'
            }, { status: 400 });
        }
    }

    // 更新内容记录
    const { data: updatedContent, error: updateError } = await supabase
        .from('coach_contents')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

    if (updateError) {
        console.error('更新内容失败:', updateError);
        return NextResponse.json({
            success: false,
            message: '更新失败，请重试'
        }, { status: 500 });
    }

    // 如果选中了"@全体学员"并且不是草稿，发送通知
    if (notifyAllStudents && !isDraft && updatedContent) {
        try {
            // 使用更新后的内容
            const notificationTitle = updatedContent.title;
            const notificationContent = updatedContent.content;

            // 生成内容预览（去除HTML标签，截取前100字）
            const plainTextContent = notificationContent
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const contentPreview = plainTextContent.length > 100 
                ? plainTextContent.substring(0, 100) + '...' 
                : plainTextContent;

            // 构建通知消息
            const notificationMessage = `${notificationTitle}\n\n${contentPreview}`;

            // 获取教练的 coach_id
            const { data: coachData } = await supabase
                .from('coaches')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (coachData) {
                // 获取所有活跃订阅的学员
                const { data: subscriptions, error: subsError } = await supabase
                    .from('coach_subscriptions')
                    .select('student_id')
                    .eq('coach_id', coachData.id)
                    .eq('status', 'active');

                if (!subsError && subscriptions && subscriptions.length > 0) {
                    const studentUserIds = subscriptions.map((s: any) => s.student_id).filter(Boolean);
                    const now = new Date().toISOString();

                    // 为每个学员创建聊天室并发送消息
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
                                        contentId: id,
                                        contentTitle: notificationTitle,
                                        contentLink: `/coach/content/${id}`
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
            }
        } catch (error) {
            console.error('发送全体学员通知失败:', error);
            // 不影响更新成功，只记录错误
        }
    }

    return NextResponse.json({
        success: true,
        message: isDraft ? '草稿更新成功' : '内容更新成功',
        data: updatedContent as UpdateContentResponseDto
    });
}
