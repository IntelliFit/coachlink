import { NextRequest, NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

type BodyMapMode = 'screening' | 'training';

type KnowledgeNodeContent = {
  body?: string;
  tags?: unknown;
  source?: string;
  source_topic?: string;
  content_level?: string;
  body_map_modes?: unknown;
  pending_body_map_hitbox?: boolean;
};

const BODY_MAP_SOURCE_MATERIAL_LEVELS = new Set(['transcript-pack']);

function asContent(value: unknown): KnowledgeNodeContent {
  return value && typeof value === 'object' ? (value as KnowledgeNodeContent) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getContentLevel(content: KnowledgeNodeContent) {
  const tags = asStringArray(content.tags);
  if (typeof content.content_level === 'string') return content.content_level;
  if (tags.includes('transcript-pack') || tags.includes('source-material')) return 'transcript-pack';
  if (content.source === 'body-map-system/articles') return 'article-guide';
  return 'knowledge-node';
}

function getBodyMapModes(content: KnowledgeNodeContent): BodyMapMode[] {
  return asStringArray(content.body_map_modes).filter(
    (mode): mode is BodyMapMode => mode === 'screening' || mode === 'training',
  );
}

function getModeRank(node: any, mode: BodyMapMode | null) {
  const content = asContent(node.content);
  const contentLevel = getContentLevel(content);
  const title = String(node.title || '');
  const sourceTopic = String(content.source_topic || '');

  if (contentLevel === 'formal-guide') return 0;
  if (!mode) return contentLevel === 'article-guide' ? 1 : 2;

  const screeningSignals = [
    '筛查',
    '评估',
    '疼痛',
    '受限',
    '体态',
    '管理',
    '圆肩',
    '骨盆',
    '膝内扣',
    '扁平足',
    '网球肘',
    '高尔夫球肘',
    '伤病',
  ];
  const trainingSignals = ['训练', '发力', '动作', '力量', '激活', '拉伸', '强化', '推类', '拉类', '硬拉', '深蹲'];
  const haystack = `${title} ${sourceTopic}`;

  if (mode === 'screening' && screeningSignals.some((signal) => haystack.includes(signal))) return 1;
  if (mode === 'training' && trainingSignals.some((signal) => haystack.includes(signal))) return 1;
  return contentLevel === 'article-guide' ? 2 : 3;
}

function compactNode(node: any, mode: BodyMapMode | null) {
  const content = asContent(node.content);
  const contentLevel = getContentLevel(content);
  const bodyMapModes = getBodyMapModes(content);

  const { content: _content, ...rest } = node;
  return {
    ...rest,
    content_summary: {
      content_level: contentLevel,
      body_map_modes: bodyMapModes,
      source: content.source || null,
      source_topic: content.source_topic || null,
      mode_rank: getModeRank(node, mode),
    },
  };
}

/**
 * GET /api/knowledge/nodes
 * List knowledge nodes with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const parentId = searchParams.get('parent_id');
    const bodyRegion = searchParams.get('body_region');
    const modeParam = searchParams.get('mode');
    const mode: BodyMapMode | null = modeParam === 'screening' || modeParam === 'training' ? modeParam : null;
    const equipment = searchParams.get('equipment');
    const publishedOnly = searchParams.get('published') !== 'false';
    const includeSourceMaterial = searchParams.get('include_source_material') === 'true';
    const limitParam = Number(searchParams.get('limit') || '');
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 30) : bodyRegion ? 8 : null;

    let query = supabase
      .from('knowledge_nodes')
      .select('id, node_type, title, slug, description, icon, body_region, equipment, difficulty, is_free, view_count, sort_order, created_at, created_by, content');

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
    let filteredNodes = nodes || [];

    if (bodyRegion) {
      filteredNodes = filteredNodes.filter((node) => {
        const content = asContent((node as any).content);
        const contentLevel = getContentLevel(content);
        const bodyMapModes = getBodyMapModes(content);

        if (!includeSourceMaterial && BODY_MAP_SOURCE_MATERIAL_LEVELS.has(contentLevel)) return false;
        if (content.pending_body_map_hitbox) return false;
        if (mode && bodyMapModes.length > 0 && !bodyMapModes.includes(mode)) return false;
        return true;
      });

      filteredNodes.sort((a, b) => {
        const rankDiff = getModeRank(a, mode) - getModeRank(b, mode);
        if (rankDiff !== 0) return rankDiff;
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      });

      if (limit) {
        filteredNodes = filteredNodes.slice(0, limit);
      }
    }

    // Simplified: don't fetch editors in list view for performance. Also strip long HTML content.
    const nodesWithEditors = filteredNodes.map((node) => ({
      ...compactNode(node, mode),
      editors: [],
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
