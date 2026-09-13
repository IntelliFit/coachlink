import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';
import { NextRequest } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';

export const runtime = 'nodejs'; // ⚠️ 不能是 edge

export async function GET(req: NextRequest) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return new Response('Unauthorized', { status: 401 });
    }

    const roomId = req.nextUrl.searchParams.get('roomId');

    const { data: chatRoom, error: chatRoomError } = await supabase
        .from('chat_rooms')
        .select('members')
        .eq('id', roomId)
        .single();

    if (chatRoomError) {
        return new Response(chatRoomError.message, { status: 500 });
    }

    if (!chatRoom.members.includes(userId)) {
        return new Response('Unauthorized', { status: 401 });
    }

    if (!roomId) {
        return new Response('roomId required', { status: 400 });
    }

    const stream = new ReadableStream({
        start(controller) {
            const channel = serviceRoleSupabase
                .channel(`room:${roomId},user:${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages',
                        filter: `room_id=eq.${roomId}`,
                    },
                    payload => {                        
                        controller.enqueue(
                            `data: ${JSON.stringify(payload.new)}\n\n`
                        );
                    }
                )
                .subscribe();

            req.signal.addEventListener('abort', () => {
                supabase.removeChannel(channel);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
