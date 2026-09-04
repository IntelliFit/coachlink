import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/knowledge/nodes/[id]
 * Get a single knowledge node with editors
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const auth = await getAuthUser(request);
        // Fetch node (兼容旧表结构，不强制要求 is_collaborative 列)
        let nodeQuery = supabase
            .from('knowledge_nodes')
            .select('id, node_type, title, slug, description, icon, body_region, equipment, difficulty, is_free, is_published, content, created_by, created_at, updated_at')
            .eq('id', id);

        if (!auth.user?.is_admin) {
            nodeQuery = nodeQuery.eq('is_published', true);
        }

        const { data: node, error } = await nodeQuery.single();

        if (error && error.code !== 'PGRST116') {
            console.error('[GET /api/knowledge/nodes/[id]] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!node) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        let hasAccess = Boolean(node.is_free || auth.user?.is_admin);
        if (!hasAccess && auth.userId) {
            const { data: subscription } = await supabase
                .from('knowledge_subscriptions')
                .select('id')
                .eq('user_id', auth.userId)
                .eq('status', 'active')
                .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
                .maybeSingle();
            hasAccess = Boolean(subscription);
        }

        // Fetch editors (兼容模式，如果表不存在则忽略)
        let editors = [];
        try {
            const { data: editorsData, error: editorsError } = await supabase
                .from('knowledge_node_editors')
                .select(`
                    user_id,
                    contributed_at,
                    contribution_type
                `)
                .eq('node_id', id)
                .order('contributed_at', { ascending: true });

            if (!editorsError && editorsData) {
                // Fetch user info separately to avoid auth.users join issues
                for (const editor of editorsData) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('name, avatar_url')
                        .eq('id', editor.user_id)
                        .single();
                    
                    editors.push({
                        user_id: editor.user_id,
                        contributed_at: editor.contributed_at,
                        contribution_type: editor.contribution_type,
                        user_name: userData?.name || '匿名用户',
                        user_avatar: userData?.avatar_url,
                    });
                }
            }
        } catch (editorError) {
            // 表不存在或查询失败，忽略编辑器信息
            console.log('Editors fetch skipped (table may not exist)');
        }

        return NextResponse.json({ 
            node: { 
                ...node,
                content: hasAccess ? node.content : null,
                is_collaborative: editors.length > 0,
                editors 
            },
            hasAccess,
        });
    } catch (error) {
        console.error('[GET /api/knowledge/nodes/[id]] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/knowledge/nodes/[id]
 * Delete a knowledge node (only creator or admin)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check permission (creator or existing editor)
        const { data: node, error: nodeError } = await supabase
            .from('knowledge_nodes')
            .select('created_by')
            .eq('id', id)
            .single();

        if (nodeError || !node) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        // Only creator can delete
        if (node.created_by !== user.id) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        // Delete node (cascades to closures and editors via FK)
        const { error } = await supabase
            .from('knowledge_nodes')
            .delete()
            .eq('id', id);

        if (error && error.code !== 'PGRST116') {
            console.error('[DELETE /api/knowledge/nodes/[id]] Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[DELETE /api/knowledge/nodes/[id]] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
