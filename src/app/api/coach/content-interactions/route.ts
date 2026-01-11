import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { ApiData } from '@/types/api';
import type { ContentInteractionDto, ContentInteractionResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;
    const { contentId, interactionType, commentContent }: ContentInteractionDto = await req.json();

    if (!contentId || !interactionType) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数',
            data: null,
        }, { status: 400 });
    }

    try {
        // Check if user already has this type of interaction with this content
        const { data: existingInteraction } = await supabase
            .from('content_interactions')
            .select('id')
            .eq('content_id', contentId)
            .eq('user_id', userId)
            .eq('interaction_type', interactionType)
            .single();

        let resultData: any = {};
        
        if (existingInteraction) {
            // If interaction already exists, remove it (toggle behavior for likes)
            const { error: deleteError } = await supabase
                .from('content_interactions')
                .delete()
                .eq('id', existingInteraction.id);

            if (deleteError) {
                throw deleteError;
            }

            resultData.action = 'removed';
            
            // If it's a like interaction, update the likes_count in coach_contents
            if (interactionType === 'like') {
                // Count all likes for this content
                const { count, error: countError } = await supabase
                    .from('content_interactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', contentId)
                    .eq('interaction_type', 'like');

                if (countError) {
                    console.error('Error counting likes:', countError);
                } else {
                    resultData.updatedLikesCount = count;

                    // Update the likes_count in coach_contents table
                    const { error: updateError } = await supabase
                        .from('coach_contents')
                        .update({ likes_count: count })
                        .eq('id', contentId);

                    if (updateError) {
                        console.error('Error updating likes count:', updateError);
                    }
                }
            }

            return NextResponse.json<ApiData<ContentInteractionResponseDto>>({
                success: true,
                message: '互动已移除',
                data: {
                    interactionId: existingInteraction.id,
                    updatedLikesCount: resultData.updatedLikesCount,
                    action: 'removed'
                },
            });
        } else {
            // Insert the new interaction
            const { data: newInteraction, error: insertError } = await supabase
                .from('content_interactions')
                .insert({
                    content_id: contentId,
                    user_id: userId,
                    interaction_type: interactionType,
                    comment_content: commentContent || null
                })
                .select()
                .single();

            if (insertError) {
                throw insertError;
            }

            resultData.action = 'added';
            
            // If it's a like interaction, update the likes_count in coach_contents
            if (interactionType === 'like') {
                // Count all likes for this content
                const { count, error: countError } = await supabase
                    .from('content_interactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('content_id', contentId)
                    .eq('interaction_type', 'like');

                if (countError) {
                    console.error('Error counting likes:', countError);
                } else {
                    resultData.updatedLikesCount = count;

                    // Update the likes_count in coach_contents table
                    const { error: updateError } = await supabase
                        .from('coach_contents')
                        .update({ likes_count: count })
                        .eq('id', contentId);

                    if (updateError) {
                        console.error('Error updating likes count:', updateError);
                    }
                }
            }

            return NextResponse.json<ApiData<ContentInteractionResponseDto>>({
                success: true,
                message: '互动创建成功',
                data: {
                    interactionId: newInteraction.id,
                    updatedLikesCount: resultData.updatedLikesCount,
                    action: 'added'
                },
            });
        }
    } catch (error) {
        console.error('Error processing content interaction:', error);
        return NextResponse.json({
            success: false,
            message: '处理互动时发生错误',
            data: null,
        }, { status: 500 });
    }
}