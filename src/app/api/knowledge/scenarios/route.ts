import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

/**
 * GET /api/knowledge/scenarios
 * List all published scenario quick fixes
 */
export async function GET() {

  const { data, error } = await supabase
    .from('knowledge_scenarios')
    .select('id, title, slug, icon, description, node_ids, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[GET /api/knowledge/scenarios] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scenarios: data });
}

/**
 * POST /api/knowledge/scenarios
 * Create a new scenario (admin only)
 */
export async function POST(request: NextRequest) {

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, slug, icon, description, node_ids } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('knowledge_scenarios')
    .insert({
      title,
      slug,
      icon,
      description,
      node_ids: node_ids || [],
      is_published: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[POST /api/knowledge/scenarios] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scenario: data }, { status: 201 });
}
