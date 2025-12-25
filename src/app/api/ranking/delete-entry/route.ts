import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { DeleteEntryDto, DeleteEntryResponseDto } from './entity';

export async function POST(req: Request) {
	const session = await getServerSession();
	if (!session?.user?.id) {
		return NextResponse.json<ApiData<DeleteEntryResponseDto>>({
			success: false,
			message: '用户未登录',
			data: null
		}, { status: 401 });
	}

	const body: DeleteEntryDto = await req.json();
	
	if (!body.id) {
		return NextResponse.json<ApiData<DeleteEntryResponseDto>>({
			success: false,
			message: '缺少必要字段: id',
			data: null
		});
	}

	// 获取要删除的条目
	const { data: entry, error: fetchError } = await supabase
		.from('leaderboard_entries')
		.select('*')
		.eq('id', body.id)
		.single();

	if (fetchError || !entry) {
		console.error('获取排行榜条目失败:', fetchError);
		return NextResponse.json<ApiData<DeleteEntryResponseDto>>({
			success: false,
			message: '找不到指定的排行榜条目',
			data: null
		});
	}

	// 验证用户权限 - 只能删除自己的条目
	if (entry.user_id !== session.user.id) {
		return NextResponse.json<ApiData<DeleteEntryResponseDto>>({
			success: false,
			message: '无权限删除此条目',
			data: null
		});
	}

	// 删除排行榜条目
	const { error } = await supabase
		.from('leaderboard_entries')
		.delete()
		.eq('id', body.id);

	if (error) {
		console.error('删除排行榜条目失败:', error);
		return NextResponse.json<ApiData<DeleteEntryResponseDto>>({
			success: false,
			message: error.message,
			data: null
		});
	}

	return NextResponse.json<ApiData<DeleteEntryResponseDto>>({
		success: true,
		message: '排行榜条目删除成功',
		data: {
			entry,
		}
	});
}