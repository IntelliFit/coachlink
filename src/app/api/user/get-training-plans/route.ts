import { NextResponse } from 'next/server'
import supabase from '@/lib/supabaseClient'
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth'
import { GetTrainingPlansDto } from './entity'

export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: '未登录用户', data: null },
            { status: 401 }
        )
    }

    const userId = session.user.id;
    const {
        coachId = '',
        id = '',
    } = await req.json() as GetTrainingPlansDto;

    if (id) {

        const { data: plans, error } = await supabase
            .from('training_plans')
            .select('*')
            .eq('id', id)
            .order('created_at', { ascending: false });
        
        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message,
                data: null
            })
        }

        return NextResponse.json({
            success: true,
            message: '成功获取训练计划',
            data: {
                plans: plans || []
            }
        });

    } else {

        let query = supabase
            .from('training_plans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (coachId) {
            query = query.eq('coach_id', coachId);
        }

        const { data: plans, error } = await query

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message,
                data: null
            })
        }

        return NextResponse.json({
            success: true,
            message: '成功获取训练计划',
            data: {
                plans: plans || []
            }
        });
    }

}
