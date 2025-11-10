import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';

export async function POST(request: Request) {
    try {
        // ✅ 鉴权
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ success: false, message: '未登录或会话已过期' }, { status: 401 });
        }

        const userId = session.user.id;

        // ✅ 获取当前用户对应的教练记录（仅限已审核通过的教练）
        const { data: coachRow, error: coachErr } = await supabase
            .from('coaches')
            .select('id, name, status')
            .eq('user_id', userId)
            .maybeSingle();

        if (coachErr) {
            console.error('查询教练失败:', coachErr);
            return NextResponse.json({ success: false, message: '查询教练失败' }, { status: 500 });
        }

        if (!coachRow) {
            return NextResponse.json({
                success: false,
                message: '未找到对应教练记录，无法获取学员列表'
            }, { status: 403 });
        }

        // ✅ 拉取该教练的活跃学员订阅
        const { data: subs, error: subsErr } = await supabase
            .from('coach_subscriptions')
            .select('id, student_id, tier, status, start_date, end_date, updated_at')
            .eq('coach_id', coachRow.id)
            .eq('status', 'active')
            .order('updated_at', { ascending: false });

        if (subsErr) {
            console.error('获取学员订阅失败:', subsErr);
            return NextResponse.json({ success: false, message: '获取学员订阅失败' }, { status: 500 });
        }

        const studentIds = (subs || []).map(s => s.student_id).filter(Boolean);
        const uniqueIds = Array.from(new Set(studentIds));

        let usersMap: Record<string, any> = {};
        let profilesMap: Record<string, any> = {};

        // ✅ 查询用户基本信息
        if (uniqueIds.length > 0) {
            const { data: usersRows, error: usersErr } = await supabase
                .from('users')
                .select('id, phone, last_login_at')
                .in('id', uniqueIds);

            if (usersErr) {
                console.warn('获取用户基本信息失败（忽略继续）:', usersErr);
            } else {
                usersMap = Object.fromEntries(
                    (usersRows || []).map(u => [u.id, u])
                );
            }

            // ✅ 查询用户档案信息
            const { data: profilesRows, error: profilesErr } = await supabase
                .from('user_profiles')
                .select('user_id, nickname, avatar_url')
                .in('user_id', uniqueIds);

            if (profilesErr) {
                console.warn('获取用户档案失败（忽略继续）:', profilesErr);
            } else {
                profilesMap = Object.fromEntries(
                    (profilesRows || []).map(p => [p.user_id, p])
                );
            }
        }

        // ✅ 合并结果
        const enriched = (subs || []).map(s => ({
            ...s,
            student: usersMap[s.student_id] || null,
            profile: profilesMap[s.student_id] || null,
        }));

        return NextResponse.json({
            success: true,
            data: enriched,
        });

    } catch (error) {
        console.error('获取订阅错误:', error);
        return NextResponse.json({
            success: false,
            message: '服务器错误',
        }, { status: 500 });
    }
}
