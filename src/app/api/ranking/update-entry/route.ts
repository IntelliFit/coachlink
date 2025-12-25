import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { UpdateEntryDto, UpdateEntryResponseDto } from './entity';

export async function POST(req: Request) {
	const session = await getServerSession();
	if (!session?.user?.id) {
		return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
			success: false,
			message: '用户未登录',
			data: null
		}, { status: 401 });
	}

	const body: UpdateEntryDto = await req.json();
	
	if (!body.id) {
		return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
			success: false,
			message: '缺少必要字段: id',
			data: null
		});
	}

	// 获取要更新的条目
	const { data: entry, error: fetchError } = await supabase
		.from('leaderboard_entries')
		.select('*')
		.eq('id', body.id)
		.single();

	if (fetchError || !entry) {
		console.error('获取排行榜条目失败:', fetchError);
		return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
			success: false,
			message: '找不到指定的排行榜条目',
			data: null
		});
	}

	// 验证用户权限 - 只能更新自己的条目
	if (entry.user_id !== session.user.id) {
		return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
			success: false,
			message: '无权限更新此条目',
			data: null
		});
	}

	// 更新排行榜条目
	const updateData: any = {};
	if (body.form_data !== undefined) updateData.form_data = body.form_data;
	if (body.score !== undefined) updateData.score = body.score;
	if (body.evidence_url !== undefined) updateData.evidence_url = body.evidence_url;
	if (body.status !== undefined) updateData.status = body.status;

	const { data, error } = await supabase
		.from('leaderboard_entries')
		.update(updateData)
		.eq('id', body.id)
		.select()
		.single();

	if (error) {
		console.error('更新排行榜条目失败:', error);
		return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
			success: false,
			message: error.message,
			data: null
		});
	}

	return NextResponse.json<ApiData<UpdateEntryResponseDto>>({
		success: true,
		message: '排行榜条目更新成功',
		data: {
			entry: data,
		},
	});
}