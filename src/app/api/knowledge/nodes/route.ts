import { NextRequest, NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

/**
 * GET /api/knowledge/nodes
 * List knowledge nodes with optional filters
 * Query params: parent_id, body_region, equipment, is_published
 * 
 * When parent_id is provided, also returns coach_contents linked to that node.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const parentId = searchParams.get('parent_id');
  const bodyRegion = searchParams.get('body_region');
  const equipment = searchParams.get('equipment');
  const publishedOnly = searchParams.get('published') !== 'false';

  let query = supabase
    .from('knowledge_nodes')
    .select('id, node_type, title, slug, description, icon, body_region, equipment, difficulty, is_free, view_count, sort_order, created_at');

  // Filter by published status
  if (publishedOnly) {
    query = query.eq('is_published', true);
  }

  // Filter by parent (via closure table)
  if (parentId) {
    const { data: childIds } = await supabase
      .from('knowledge_node_closures')
      .select('descendant_id')
      .eq('ancestor_id', parentId)
      .eq('depth', 1);

    if (childIds && childIds.length > 0) {
      query = query.in('id', childIds.map((c) => c.descendant_id));
    } else {
      // No knowledge_nodes children, but there might be coach_contents linked
      query = query.in('id', []); // Will return empty
    }
  }

  // Filter by body region (array contains)
  if (bodyRegion) {
    query = query.contains('body_region', [bodyRegion]);
  }

  // Filter by equipment (array contains)
  if (equipment) {
    query = query.contains('equipment', [equipment]);
  }

  query = query.order('sort_order', { ascending: true });

  const { data: nodes, error } = await query;

  if (error) {
    console.error('[GET /api/knowledge/nodes] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch coach_contents linked to this parent_id (if parent_id is provided)
  let articles: any[] = [];
  if (parentId) {
    const { data: coachContents, error: articlesError } = await serviceRoleSupabase
      .from('coach_contents')
      .select(`
        id,
        title,
        content,
        thumbnail_url,
        created_at,
        required_tier,
        coaches (
          id,
          name,
          avatar_url
        )
      `)
      .eq('knowledge_node_id', parentId)
      .order('created_at', { ascending: false });

    if (!articlesError && coachContents) {
      // Transform coach_contents to match node-like structure for unified rendering
      articles = coachContents.map((article) => ({
        id: article.id,
        node_type: 'coach_article', // Special type to distinguish from knowledge_nodes
        title: article.title,
        description: article.content?.substring(0, 100) + '...' || null,
        icon: null,
        thumbnail_url: article.thumbnail_url,
        created_at: article.created_at,
        required_tier: article.required_tier,
        coach: article.coaches, // Include coach info
        is_coach_content: true, // Flag to identify this is from coach_contents
      }));
    }
  }

  return NextResponse.json({ nodes: nodes || [], articles });
}

/**
 * POST /api/knowledge/nodes
 * Create a new knowledge node (admin/coach only)
 */
export async function POST(request: NextRequest) {
  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Add role check (admin or L3 coach)

  const body = await request.json();
  const { title, node_type, parent_id, description, icon, body_region, equipment, difficulty, is_free, content } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Create node
  const { data: node, error: insertError } = await supabase
    .from('knowledge_nodes')
    .insert({
      title,
      node_type: node_type || 'article',
      description,
      icon,
      body_region: body_region || [],
      equipment: equipment || [],
      difficulty: difficulty || 1,
      is_free: is_free ?? true,
      content,
      created_by: user.id,
      is_published: false,
    })
    .select('id')
    .single();

  if (insertError || !node) {
    console.error('[POST /api/knowledge/nodes] Insert error:', insertError);
    return NextResponse.json({ error: insertError?.message || 'Failed to create node' }, { status: 500 });
  }

  // Insert self-closure
  await supabase.from('knowledge_node_closures').insert({
    ancestor_id: node.id,
    descendant_id: node.id,
    depth: 0,
  });

  // Insert parent closures
  if (parent_id) {
    const { data: parentClosures } = await supabase
      .from('knowledge_node_closures')
      .select('ancestor_id, depth')
      .eq('descendant_id', parent_id);

    if (parentClosures && parentClosures.length > 0) {
      const newClosures = parentClosures.map((pc) => ({
        ancestor_id: pc.ancestor_id,
        descendant_id: node.id,
        depth: pc.depth + 1,
      }));
      await supabase.from('knowledge_node_closures').insert(newClosures);
    }
  }

  return NextResponse.json({ node }, { status: 201 });
}
