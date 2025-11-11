import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import { GetPullupLeaderboardDto } from './entity';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '未登录用户', data: null }, { status: 401 });
    }

    const body = (await req.json()) as GetPullupLeaderboardDto;

    const { data, error } = await supabase.rpc('get_pullup_leaderboard_details', body);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: '获取成功', data }, { status: 200 });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, message: error?.message ?? '服务器错误', data: null }, { status: 500 });
  }
}
