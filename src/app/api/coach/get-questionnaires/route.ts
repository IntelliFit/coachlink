import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';
import type { GetQuestionnairesDto, GetQuestionnairesResponseDto } from './entity';

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

    const {
    } = await req.json() as GetQuestionnairesDto;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: '用户不是教练',
            data: null
        }, { status: 403 });
    }

    // 获取问卷数据
    const { data: questionnaire, error: questionnaireError } = await supabase
        .from('coach_questionnaires')
        .select('id,questions')
        .eq('coach_id', userId)
        .maybeSingle();

    if (questionnaireError) {
        return NextResponse.json({
            success: false,
            message: '获取问卷失败',
            data: null
        }, { status: 500 });
    }

    const questionnairesData = questionnaire ?? {
        id: '',
        questions: []
    }

    return NextResponse.json<ApiData<GetQuestionnairesResponseDto>>({
        success: true,
        message: '获取问卷成功',
        data: {
            id: questionnairesData.id,
            questionnaires: questionnairesData.questions as string[]
        }
    });
}