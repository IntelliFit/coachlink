import { NextResponse } from 'next/server';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type {
    ContentColumnDto,
    ContentColumnResponseDto,
    ContentColumnsResponseDto,
} from './entity';
import type { ApiData } from '@/types/api';

function buildSlug(name: string, slug?: string | null) {
    const raw = (slug || name).trim().toLowerCase();
    const normalized = raw
        .replace(/['"]/g, '')
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || null;
}

async function getCurrentCoach() {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return { error: NextResponse.json({ success: false, message: '缺少用户ID' }, { status: 401 }) };
    }

    const { data: coach, error } = await serviceRoleSupabase
        .from('coaches')
        .select('id,user_id,status')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .single();

    if (error || !coach) {
        return {
            error: NextResponse.json(
                { success: false, message: '教练不存在、未通过审核或无权限' },
                { status: 404 },
            ),
        };
    }

    return { coach };
}

export async function GET() {
    const { coach, error } = await getCurrentCoach();
    if (error) return error;

    const { data, error: queryError } = await serviceRoleSupabase
        .from('coach_content_columns')
        .select('*')
        .eq('coach_id', coach!.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (queryError) {
        console.error('[content-columns] list failed:', queryError);
        return NextResponse.json(
            {
                success: false,
                message:
                    queryError.code === '42P01'
                        ? '专栏表不存在，请先执行数据库迁移 20260420_coach_content_columns.sql'
                        : '获取专栏失败',
                data: null,
            },
            { status: 500 },
        );
    }

    return NextResponse.json<ApiData<ContentColumnsResponseDto>>({
        success: true,
        message: '获取成功',
        data: { columns: data || [] },
    });
}

export async function POST(req: Request) {
    const { coach, error } = await getCurrentCoach();
    if (error) return error;

    const body = (await req.json()) as ContentColumnDto;
    const name = (body.name || '').trim();
    if (!name) {
        return NextResponse.json(
            { success: false, message: '专栏名称不能为空', data: null },
            { status: 400 },
        );
    }

    const now = new Date().toISOString();
    const slug = buildSlug(name, body.slug);

    const { data, error: insertError } = await serviceRoleSupabase
        .from('coach_content_columns')
        .insert({
            coach_id: coach!.id,
            name,
            description: body.description?.trim() || null,
            cover_url: body.cover_url || null,
            slug,
            sort_order: Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0,
            is_visible: body.is_visible ?? true,
            created_at: now,
            updated_at: now,
        })
        .select('*')
        .single();

    if (insertError) {
        console.error('[content-columns] create failed:', insertError);

        if (insertError.code === '23505' && slug) {
            const { data: existing } = await serviceRoleSupabase
                .from('coach_content_columns')
                .select('*')
                .eq('coach_id', coach!.id)
                .eq('slug', slug)
                .maybeSingle();

            if (existing) {
                return NextResponse.json<ApiData<ContentColumnResponseDto>>({
                    success: true,
                    message: '专栏已存在',
                    data: { column: existing },
                });
            }
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    insertError.code === '42P01'
                        ? '专栏表不存在，请先执行数据库迁移 20260420_coach_content_columns.sql'
                        : insertError.code === '42501'
                            ? '没有专栏写入权限，请联系管理员检查数据库 RLS 策略'
                            : '创建专栏失败，请检查名称是否重复',
                data: null,
            },
            { status: 500 },
        );
    }

    return NextResponse.json<ApiData<ContentColumnResponseDto>>({
        success: true,
        message: '创建成功',
        data: { column: data },
    });
}

export async function PUT(req: Request) {
    const { coach, error } = await getCurrentCoach();
    if (error) return error;

    const body = (await req.json()) as ContentColumnDto;
    if (!body.id) {
        return NextResponse.json(
            { success: false, message: '缺少专栏ID', data: null },
            { status: 400 },
        );
    }

    const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
        const name = body.name.trim();
        if (!name) {
            return NextResponse.json(
                { success: false, message: '专栏名称不能为空', data: null },
                { status: 400 },
            );
        }
        updateData.name = name;
        updateData.slug = buildSlug(name, body.slug);
    }
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.cover_url !== undefined) updateData.cover_url = body.cover_url || null;
    if (body.sort_order !== undefined) updateData.sort_order = Number(body.sort_order) || 0;
    if (body.is_visible !== undefined) updateData.is_visible = body.is_visible;

    const { data, error: updateError } = await serviceRoleSupabase
        .from('coach_content_columns')
        .update(updateData)
        .eq('id', body.id)
        .eq('coach_id', coach!.id)
        .select('*')
        .single();

    if (updateError) {
        console.error('[content-columns] update failed:', updateError);
        return NextResponse.json(
            { success: false, message: '更新专栏失败', data: null },
            { status: 500 },
        );
    }

    return NextResponse.json<ApiData<ContentColumnResponseDto>>({
        success: true,
        message: '更新成功',
        data: { column: data },
    });
}
