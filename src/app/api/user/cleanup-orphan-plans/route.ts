import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';

export async function POST() {
	const session = await getServerSession();

	if (!session?.user?.id) {
		return NextResponse.json(
			{ success: false, message: '未登录用户', data: null },
			{ status: 401 }
		);
	}

	const userId = session.user.id;

	// 删除当前用户下 coach_id 为空的训练计划
	const { data, error } = await supabase
		.from('training_plans')
		.delete()
		.eq('user_id', userId)
		.is('coach_id', null)
		.select('id');

	if (error) {
		return NextResponse.json({
			success: false,
			message: error.message,
			data: null
		}, { status: 500 });
	}

	return NextResponse.json({
		success: true,
		message: '清理完成',
		data: { deleted: (data || []).length }
	});
}

