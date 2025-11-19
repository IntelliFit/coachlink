import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';

export async function POST() {
	const session = await getServerSession();
	if (!session?.user?.id) {
		return NextResponse.json({ success: false, message: '未登录用户', data: null }, { status: 401 });
	}

	// 找到教练行
	const { data: coachRow, error: coachErr } = await supabase
		.from('coaches')
		.select('id')
		.eq('user_id', session.user.id)
		.maybeSingle();

	if (coachErr || !coachRow?.id) {
		return NextResponse.json({ success: false, message: '未找到教练身份', data: null }, { status: 400 });
	}

	// 活跃订阅
	const { data: subs, error: subsErr } = await supabase
		.from('coach_subscriptions')
		.select('id, student_id, tier, status, start_date, end_date, updated_at')
		.eq('coach_id', coachRow.id)
		.eq('status', 'active')
		.order('updated_at', { ascending: false });

	if (subsErr) {
		return NextResponse.json({ success: false, message: subsErr.message, data: null }, { status: 500 });
	}

	const studentIds = Array.from(new Set((subs || []).map((s) => s.student_id))).filter(Boolean);

	// 用户与档案
	let users: any[] = [];
	let profiles: any[] = [];
	if (studentIds.length > 0) {
		const [{ data: usersRows }, { data: profilesRows }] = await Promise.all([
			supabase.from('users').select('id, email, nickname, primary_role').in('id', studentIds as string[]),
			supabase.from('user_profiles').select('user_id, nickname, avatar_url, fitness_level').in('user_id', studentIds as string[])
		]);
		users = usersRows || [];
		profiles = profilesRows || [];
	}

	const userMap = new Map(users.map((u) => [u.id, u]));
	const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

	const students = (subs || []).map((s) => ({
		...s,
		user: userMap.get(s.student_id) || null,
		profile: profileMap.get(s.student_id) || null
	}));

	return NextResponse.json({
		success: true,
		message: 'ok',
		data: {
            students
        }
	});
}
