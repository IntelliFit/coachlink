import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { LifestyleLogPayload } from './entity';

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                message: '用户未登录',
                data: null
            }, { status: 401 });
        }

        const payload = await request.json() as LifestyleLogPayload;
        const userId = session.user.id;

        const { data, error } = await supabase
            .from('lifestyle_logs')
            .insert({
                user_id: userId,
                log_date: payload.log_date || new Date().toISOString().slice(0, 10),
                sleep_hours: payload.sleep_hours ?? null,
                sleep_quality: payload.sleep_quality ?? null,
                diet_notes: payload.diet_notes ?? null,
                meal_photos: payload.meal_photos ?? []
            })
            .select()
            .single();

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            message: '提交生活记录成功',
            data
        });
    } catch (error: any) {
        console.error('提交生活记录失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '提交生活记录失败',
            data: null
        }, { status: 500 });
    }
}