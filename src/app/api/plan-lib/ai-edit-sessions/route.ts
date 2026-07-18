import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { serviceRoleSupabase as supabase } from '@/lib/supabaseClient';

const MAX_MESSAGES = 240;
const MAX_TRAINING_DAYS = 400;
const MAX_MODIFICATIONS = 6000;

function asArray(value: unknown, max: number, name: string): any[] {
    if (!Array.isArray(value)) throw new Error(`${name} 必须是数组`);
    if (value.length > max) throw new Error(`${name} 超过保存上限`);
    return value;
}

function cleanScopeKey(value: unknown): string {
    const scopeKey = String(value || '').trim();
    if (!scopeKey || scopeKey.length > 240) throw new Error('scopeKey 无效');
    return scopeKey;
}

function cleanTitle(value: unknown): string {
    const title = String(value || 'AI 计划修改').trim() || 'AI 计划修改';
    return title.slice(0, 160);
}

function cleanMessages(value: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
    return asArray(value, MAX_MESSAGES, 'messages').map((item) => {
        const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
        const content = typeof item?.content === 'string' ? item.content.trim() : '';
        if (!role || !content || content.length > 30_000) throw new Error('messages 包含无效消息');
        return { role, content };
    });
}

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const id = req.nextUrl.searchParams.get('id')?.trim();
    const scopeKey = req.nextUrl.searchParams.get('scopeKey')?.trim();
    try {
        if (id) {
            const { data, error } = await supabase
                .from('plan_ai_edit_sessions')
                .select('*')
                .eq('id', id)
                .eq('user_id', userId)
                .single();
            if (error || !data) {
                return NextResponse.json({ success: false, message: '历史会话不存在' }, { status: 404 });
            }
            return NextResponse.json({ success: true, data });
        }

        const resolvedScopeKey = cleanScopeKey(scopeKey);
        const { data, error } = await supabase
            .from('plan_ai_edit_sessions')
            .select('id,scope_key,target_action_type,title,status,messages,modifications,created_at,updated_at,applied_at')
            .eq('user_id', userId)
            .eq('scope_key', resolvedScopeKey)
            .neq('status', 'archived')
            .order('updated_at', { ascending: false })
            .limit(30);
        if (error) throw error;
        return NextResponse.json({
            success: true,
            data: (data || []).map((item: any) => ({
                id: item.id,
                scopeKey: item.scope_key,
                targetActionType: item.target_action_type,
                title: item.title,
                status: item.status,
                messageCount: Array.isArray(item.messages) ? item.messages.length : 0,
                modificationCount: Array.isArray(item.modifications) ? item.modifications.length : 0,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
                appliedAt: item.applied_at,
            })),
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || '读取历史失败' }, { status: 400 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const id = body.id ? String(body.id) : null;
        const status = ['draft', 'applied', 'archived'].includes(body.status) ? body.status : 'draft';
        const payload = {
            user_id: userId,
            scope_key: cleanScopeKey(body.scopeKey),
            target_action_type: body.targetActionType === 'student' ? 'student' : 'coach',
            title: cleanTitle(body.title),
            status,
            messages: cleanMessages(body.messages || []),
            baseline_training_days: asArray(body.baselineTrainingDays || [], MAX_TRAINING_DAYS, 'baselineTrainingDays'),
            draft_training_days: asArray(body.draftTrainingDays || [], MAX_TRAINING_DAYS, 'draftTrainingDays'),
            modifications: asArray(body.modifications || [], MAX_MODIFICATIONS, 'modifications'),
            pending_actions: asArray(body.pendingActions || [], 500, 'pendingActions'),
            one_rm_adjustments: asArray(body.oneRmAdjustments || [], 500, 'oneRmAdjustments'),
            context_options: body.contextOptions && typeof body.contextOptions === 'object' ? body.contextOptions : {},
            applied_at: status === 'applied' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        };

        if (id) {
            const { data, error } = await supabase
                .from('plan_ai_edit_sessions')
                .update(payload)
                .eq('id', id)
                .eq('user_id', userId)
                .select('id,status,updated_at')
                .single();
            if (error || !data) throw error || new Error('历史会话不存在');
            return NextResponse.json({ success: true, data });
        }

        const { data, error } = await supabase
            .from('plan_ai_edit_sessions')
            .insert(payload)
            .select('id,status,updated_at')
            .single();
        if (error || !data) throw error || new Error('创建历史会话失败');
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message || '保存历史失败' }, { status: 400 });
    }
}
