import { NextRequest, NextResponse } from 'next/server';
import supabase, { serviceRoleSupabase } from '@/lib/supabaseClient';

/**
 * GET /api/knowledge/tree
 * Get the full knowledge tree structure (for admin/editor views)
 * Now also includes coach_contents as leaf nodes under their linked knowledge nodes.
 */
export async function GET(request: NextRequest) {

  // Get all nodes
  const { data: nodes, error: nodesError } = await supabase
    .from('knowledge_nodes')
    .select('id, node_type, title, slug, description, icon, is_published, sort_order')
    .order('sort_order', { ascending: true });

  if (nodesError) {
    console.error('[GET /api/knowledge/tree] Nodes error:', nodesError);
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  // Get all closures (depth = 1 for direct parent-child)
  const { data: closures, error: closuresError } = await supabase
    .from('knowledge_node_closures')
    .select('ancestor_id, descendant_id, depth')
    .eq('depth', 1);

  if (closuresError) {
    console.error('[GET /api/knowledge/tree] Closures error:', closuresError);
    return NextResponse.json({ error: closuresError.message }, { status: 500 });
  }

  // Fetch all coach_contents that have a knowledge_node_id
  const { data: coachContents, error: contentsError } = await serviceRoleSupabase
    .from('coach_contents')
    .select(`
      id,
      title,
      thumbnail_url,
      knowledge_node_id,
      created_at,
      required_tier,
      coaches (
        id,
        name,
        avatar_url
      )
    `)
    .not('knowledge_node_id', 'is', null)
    .order('created_at', { ascending: false });

  if (contentsError) {
    console.error('[GET /api/knowledge/tree] Coach contents error:', contentsError);
    // Don't fail the whole request, just log and continue without coach contents
  }

  // Build parent-child map
  const parentMap: Record<string, string> = {};
  closures?.forEach((c) => {
    parentMap[c.descendant_id] = c.ancestor_id;
  });

  // Build tree structure
  type TreeNode = {
    id: string;
    node_type: string;
    title: string;
    slug: string | null;
    description: string | null;
    icon: string | null;
    is_published: boolean;
    sort_order: number;
    children: TreeNode[];
    is_coach_content?: boolean;
    thumbnail_url?: string;
    coach?: { id: string; name: string; avatar_url?: string };
    required_tier?: number;
  };

  const nodeMap: Record<string, TreeNode> = {};
  const roots: TreeNode[] = [];

  nodes?.forEach((n) => {
    nodeMap[n.id] = { ...n, children: [] };
  });

  nodes?.forEach((n) => {
    const parentId = parentMap[n.id];
    if (parentId && nodeMap[parentId]) {
      nodeMap[parentId].children.push(nodeMap[n.id]);
    } else if (!parentId) {
      roots.push(nodeMap[n.id]);
    }
  });

  // Attach coach_contents as children to their linked knowledge nodes
  coachContents?.forEach((content) => {
    if (content.knowledge_node_id && nodeMap[content.knowledge_node_id]) {
      const coachArticleNode: TreeNode = {
        id: content.id,
        node_type: 'coach_article',
        title: content.title,
        slug: null,
        description: null,
        icon: null,
        is_published: true,
        sort_order: 9999, // Put at end
        children: [],
        is_coach_content: true,
        thumbnail_url: content.thumbnail_url,
        coach: content.coaches as any,
        required_tier: content.required_tier,
      };
      nodeMap[content.knowledge_node_id].children.push(coachArticleNode);
    }
  });

  return NextResponse.json({ tree: roots });
}
