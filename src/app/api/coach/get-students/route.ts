import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import { GetStudentsDto } from './entity';
import { UserProfilesRow } from '@/types';

export async function POST(req: Request) {
	const session = await getServerSession();
	if (!session?.user?.id) {
		return NextResponse.json({ success: false, message: '未登录用户', data: null }, { status: 401 });
	}

    const {
        pagination,
        needTrainingDetails = false
    } = await req.json() as GetStudentsDto;

	// 找到教练行
	const { data: coachRow, error: coachErr } = await supabase
		.from('coaches')
		.select('id')
		.eq('user_id', session.user.id)
		.maybeSingle();

	if (coachErr || !coachRow?.id) {
		return NextResponse.json({ success: false, message: '未找到教练身份', data: null }, { status: 400 });
	}

	// 构建查询
	const query = supabase
		.from('coach_subscriptions')
		.select('id, student_id, tier, status, start_date, end_date, updated_at', { count: 'exact' })
		.eq('coach_id', coachRow.id)
		.eq('status', 'active')
		.order('updated_at', { ascending: false });

	// 添加分页
	const page = pagination?.page || 0;
	const limit = pagination?.limit || 20;
	const from = page * limit;
	const to = from + limit - 1;
	
	query.range(from, to);

	// 活跃订阅
	const { data: subs, error: subsErr, count } = await query;

	if (subsErr) {
		return NextResponse.json({ success: false, message: subsErr.message, data: null }, { status: 500 });
	}

	const studentIds = Array.from(new Set((subs || []).map((s) => s.student_id))).filter(Boolean);

	// 用户与档案
	let profiles: UserProfilesRow[] = [];
	if (studentIds.length > 0) {
		const { data: profilesRows } = await supabase
            .from('user_profiles')
            .select('*')
            .in('user_id', studentIds as string[]);

		profiles = profilesRows || [];
	}

	const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

	const students = (subs || []).map((s) => ({
		...s,
		profile: profileMap.get(s.student_id) || null
	}));

	return NextResponse.json({
		success: true,
		message: 'ok',
		data: {
            students,
			pagination: {
				page,
				limit,
				total: count || 0
			}
        }
	});
}