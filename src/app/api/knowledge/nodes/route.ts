import { NextRequest, NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

/**
 * GET /api/knowledge/nodes
 * List knowledge nodes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const parentId = searchParams.get('parent_id');
    const bodyRegion = searchParams.get('body_region');
    const equipment = searchParams.get('equipment');
    const publishedOnly = searchParams.get('published') !== 'false';

    let query = supabase
      .from('knowledge_nodes')
      .select('id, node_type, title, slug, description, icon, body_region, equipment, difficulty, is_free, view_count, sort_order, created_at, is_collaborative, collaboration_enabled, created_by');

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
        query = query.in('id', []);
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

    // Simplified: don't fetch editors in list view for performance
    const nodesWithEditors = (nodes || []).map(node => ({
      ...node,
      editors: []
    }));

    // Also fetch coach_contents linked to this parent_id (if parent_id is provided)
    let articles: any[] = [];
    if (parentId) {
      try {
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
          articles = coachContents.map((article) => ({
            id: article.id,
            node_type: 'coach_article',
            title: article.title,
            description: article.content?.substring(0, 100) + '...' || null,
            icon: null,
            thumbnail_url: article.thumbnail_url,
            created_at: article.created_at,
            required_tier: article.required_tier,
            coach: article.coaches,
            is_coach_content: true,
            is_collaborative: false,
            editors: [],
          }));
        }
      } catch (coachError) {
        console.error('Failed to fetch coach contents:', coachError);
      }
    }

    return NextResponse.json({ nodes: nodesWithEditors, articles });
  } catch (error) {
    console.error('[GET /api/knowledge/nodes] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/knowledge/nodes
 * Create a new knowledge node (supports collaborative creation)
 */
export async function POST(request: NextRequest) {
  try {
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      title, 
      node_type, 
      parent_id, 
      description, 
      icon, 
      body_region, 
      equipment, 
      difficulty, 
      is_free, 
      content,
      is_collaborative = true,
      collaboration_enabled = true 
    } = body;

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
        is_published: true,
        is_collaborative,
        collaboration_enabled,
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

    // Add creator as the first editor (optional, ignore error if table doesn't exist)
    try {
      await supabase.from('knowledge_node_editors').insert({
        node_id: node.id,
        user_id: user.id,
        contribution_type: 'create',
      });
    } catch (editorError) {
      console.log('Note: knowledge_node_editors table may not exist yet');
    }

    return NextResponse.json({ node }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/knowledge/nodes] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/knowledge/nodes
 * Update a knowledge node (supports collaborative editing)
 */
export async function PUT(request: NextRequest) {
  try {
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Node ID is required' }, { status: 400 });
    }

    // Check if user has permission to edit
    const { data: existingEditors } = await supabase
      .from('knowledge_node_editors')
      .select('user_id')
      .eq('node_id', id)
      .eq('user_id', user.id);

    const { data: nodeData } = await supabase
      .from('knowledge_nodes')
      .select('created_by, collaboration_enabled')
      .eq('id', id)
      .single();

    const canEdit = nodeData?.created_by === user.id || 
                    existingEditors?.length > 0 || 
                    nodeData?.collaboration_enabled === true;

    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Update node
    const { data: node, error: updateError } = await supabase
      .from('knowledge_nodes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[PUT /api/knowledge/nodes] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Add user as editor (optional)
    try {
      await supabase.from('knowledge_node_editors').upsert({
        node_id: id,
        user_id: user.id,
        contribution_type: 'edit',
      }, {
        onConflict: 'node_id,user_id',
        ignoreDuplicates: false
      });
    } catch (editorError) {
      console.log('Note: knowledge_node_editors table may not exist yet');
    }

    return NextResponse.json({ node });
  } catch (error) {
    console.error('[PUT /api/knowledge/nodes] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
