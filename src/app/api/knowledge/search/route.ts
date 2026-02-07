import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

/**
 * GET /api/knowledge/search
 * Search knowledge nodes by keyword
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ results: [], error: 'Query required' }, { status: 400 });
  }

  const searchTerm = query.trim();

  // Search in title, description using ILIKE for case-insensitive matching
  const { data, error } = await supabase
    .from('knowledge_nodes')
    .select('id, title, description, node_type, slug, body_region, is_free')
    .eq('is_published', true)
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order('node_type', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error.message, results: [] }, { status: 500 });
  }

  // Sort results: exact matches first, then partial matches
  const sortedResults = (data || []).sort((a, b) => {
    const aExact = a.title.toLowerCase().includes(searchTerm.toLowerCase()) ? 0 : 1;
    const bExact = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ? 0 : 1;
    return aExact - bExact;
  });

  return NextResponse.json({ results: sortedResults, query: searchTerm });
}
