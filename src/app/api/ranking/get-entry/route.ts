import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { GetEntryDto, GetEntryResponseDto } from './entity';

export async function POST(req: Request) {
	const session = await getServerSession();
	if (!session?.user?.id) {
		return NextResponse.json<ApiData<GetEntryResponseDto>>({
			success: false,
			message: '用户未登录',
			data: null
		}, { status: 401 });
	}

	const body: GetEntryDto = await req.json();
	
	if (!body.id) {
		return NextResponse.json<ApiData<GetEntryResponseDto>>({
			success: false,
			message: '缺少必要字段: id',
			data: null
		});
	}

	// 获取排行榜条目
	const { data, error } = await supabase
		.from('leaderboard_entries')
		.select('*')
		.eq('id', body.id)
		.single();

	if (error) {
		console.error('获取排行榜条目失败:', error);
		return NextResponse.json<ApiData<GetEntryResponseDto>>({
			success: false,
			message: error.message,
			data: null
		});
	}

	if (!data) {
		return NextResponse.json<ApiData<GetEntryResponseDto>>({
			success: false,
			message: '找不到指定的排行榜条目',
			data: null
		});
	}

	return NextResponse.json<ApiData<GetEntryResponseDto>>({
		success: true,
		message: '获取排行榜条目成功',
		data: {
			entry: data,
		}
	});
}