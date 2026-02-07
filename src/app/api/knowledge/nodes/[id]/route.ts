import { NextRequest, NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

/**
 * GET /api/knowledge/nodes/[id]
 * Get a single knowledge node by ID
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const nodeId = params.id;

  if (!nodeId) {
    return NextResponse.json({ error: 'Node ID required' }, { status: 400 });
  }

  // Fetch node details and related articles in parallel
  // Use serviceRoleSupabase for articles to bypass RLS (e.g. required_tier > 0 hidden from anon)
  const [nodeResult, articlesResult] = await Promise.all([
    supabase
      .from('knowledge_nodes')
      .select('*')
      .eq('id', nodeId)
      .single(),
    serviceRoleSupabase
      .from('coach_contents')
      .select(`
        id, 
        title, 
        coach_id, 
        created_at, 
        views_count, 
        likes_count, 
        thumbnail_url, 
        coaches (
          name, 
          avatar_url
        )
      `)
      .eq('knowledge_node_id', nodeId)
      .order('created_at', { ascending: false })
  ]);

  const { data: node, error } = nodeResult;
  const { data: articles, error: articlesError } = articlesResult;

  if (error) {
    console.error('Error fetching node:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  return NextResponse.json({ node, articles: articles || [] });
}

/**
 * PATCH /api/knowledge/nodes/[id]
 * Update a knowledge node (admin/coach only)
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const nodeId = params.id;

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Check if user has permission to edit

  const body = await request.json();
  const { title, description, content, icon, is_published, body_region, metadata } = body;

  const updateData: Record<string, any> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (content !== undefined) updateData.content = content;
  if (icon !== undefined) updateData.icon = icon;
  if (is_published !== undefined) updateData.is_published = is_published;
  if (body_region !== undefined) updateData.body_region = body_region;
  if (metadata !== undefined) updateData.metadata = metadata;
  updateData.updated_at = new Date().toISOString();

  const { data: updatedNode, error } = await supabase
    .from('knowledge_nodes')
    .update(updateData)
    .eq('id', nodeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating node:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ node: updatedNode });
}

/**
 * DELETE /api/knowledge/nodes/[id]
 * Delete a knowledge node (admin only)
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const nodeId = params.id;

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Check if user is admin

  // Delete closure table entries first
  await supabase
    .from('knowledge_node_closures')
    .delete()
    .or(`ancestor_id.eq.${nodeId},descendant_id.eq.${nodeId}`);

  // Delete the node
  const { error } = await supabase
    .from('knowledge_nodes')
    .delete()
    .eq('id', nodeId);

  if (error) {
    console.error('Error deleting node:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
