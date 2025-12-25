import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { CreateEntryDto, CreateEntryResponseDto } from './entity';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
	const session = await getServerSession();
	if (!session?.user?.id) {
		return NextResponse.json<ApiData<CreateEntryResponseDto>>({
			success: false,
			message: '用户未登录',
			data: null
		}, { status: 401 });
	}

	const body: CreateEntryDto = await req.json();
	
	// 验证必要字段
	if (!body.template_id) {
		return NextResponse.json<ApiData<CreateEntryResponseDto>>({
			success: false,
			message: '缺少必要字段: template_id',
			data: null
		});
	}

	// 插入排行榜条目
	const { data, error } = await supabase
		.from('leaderboard_entries')
		.insert({
			id: randomUUID(),
			template_id: body.template_id,
			form_data: body.form_data,
			score: body.score,
			evidence_url: body.evidence_url,
			status: body.status || 'pending', // 默认状态为pending
			user_id: body.user_id || session.user.id, // 如果未提供用户ID，则使用当前用户ID
		})
		.select()
		.single();

	if (error) {
		console.error('创建排行榜条目失败:', error);
		return NextResponse.json<ApiData<CreateEntryResponseDto>>({
			success: false,
			message: error.message,
			data: null
		});
	}

	return NextResponse.json<ApiData<CreateEntryResponseDto>>({
		success: true,
		message: '排行榜条目创建成功',
		data: {
			entry: data,
		}
	});
}