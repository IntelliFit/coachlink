import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { callDeepSeekChat } from '@/lib/deepseek';

/**
 * POST /api/knowledge/ai/ask
 * AI Q&A endpoint using DeepSeek with RAG (Retrieval-Augmented Generation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, conversationId } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Get current user (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Extract keywords and search for relevant nodes
    const keywords = extractKeywords(question);
    const relevantNodes = await searchKnowledgeNodes(keywords);

    // 2. Build context from retrieved nodes
    const contextParts: string[] = [];
    const sources: { id: string; title: string; slug: string | null }[] = [];

    relevantNodes.slice(0, 5).forEach((node, idx) => {
      sources.push({ id: node.id, title: node.title, slug: node.slug });
      
      let nodeContent = `[${idx + 1}] 《${node.title}》`;
      if (node.description) {
        nodeContent += `\n简介：${node.description}`;
      }
      if (node.content?.body) {
        // Strip HTML tags and limit content length
        const plainText = node.content.body.replace(/<[^>]*>/g, ' ').trim();
        const excerpt = plainText.slice(0, 800);
        nodeContent += `\n内容：${excerpt}${plainText.length > 800 ? '...' : ''}`;
      }
      contextParts.push(nodeContent);
    });

    // 3. Generate AI response - ALWAYS call DeepSeek
    let answer: string;
    let systemPrompt: string;
    
    if (contextParts.length === 0) {
      // No relevant content found - still call AI as general assistant
      systemPrompt = `你是一位专业的健身教练和运动康复专家，名叫"知识库小助手"。

你的职责：
1. 回答用户关于运动训练、体态评估、动作纠正、康复训练等方面的问题
2. 如果用户问的问题超出你的专业领域，请友好地引导他们回到健身相关话题
3. 如果用户问"你是谁"，介绍自己是智健教链平台的AI知识助手
4. 回答应简洁实用，控制在 200 字以内
5. 使用友好、专业的语气

注意：当前知识库中没有找到与用户问题直接相关的内容，请基于你的专业知识回答，并建议用户浏览知识库分类或使用更具体的关键词。`;
    } else {
      // Build RAG prompt with retrieved context
      systemPrompt = `你是一位专业的健身教练和运动康复专家。请基于以下知识库内容回答用户的问题。

回答要求：
1. 使用通俗易懂的语言，避免过于专业的术语
2. 结合知识库中的具体内容给出建议
3. 在回答中使用 [1]、[2] 等标记引用来源
4. 如果知识库内容不足以完整回答，可以补充你的专业知识
5. 回答应简洁实用，控制在 300 字以内

【知识库内容】
${contextParts.join('\n\n')}`;
    }

    const userMessage = `用户问题：${question}`;

    try {
      answer = await callDeepSeekChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ], { maxTokens: 1000, temperature: 0.7 });
    } catch (aiError) {
      console.error('[AI Q&A] DeepSeek error:', aiError);
      // Fallback only if API call fails
      if (relevantNodes.length > 0) {
        answer = `根据知识库内容，关于"${question}"的相关信息：\n\n${relevantNodes.slice(0, 3).map((n, i) => 
          `${i + 1}. **${n.title}**\n${n.description || ''}`
        ).join('\n\n')}\n\n请点击下方链接查看详细内容。`;
      } else {
        answer = `抱歉，AI 服务暂时不可用。请稍后重试，或浏览知识库分类查找相关信息。`;
      }
    }

    // 4. Save conversation (optional)
    if (user && conversationId) {
      await saveConversation(user.id, question, answer, conversationId);
    }

    return NextResponse.json({
      answer,
      sources: sources.map(s => s.title),
      relatedNodes: sources.map(s => ({
        id: s.id,
        title: s.title,
        slug: s.slug,
      })),
    });
  } catch (error) {
    console.error('AI Q&A error:', error);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}

// Simple keyword extraction from Chinese text
function extractKeywords(text: string): string[] {
  const keyTerms = [
    '深蹲', '硬拉', '卧推', '引体', '俯卧撑', '平板支撑',
    '肩', '颈', '腰', '背', '膝', '髋', '踝', '手腕', '肘',
    '拉伸', '放松', '灵活', '力量', '耐力', '核心', '稳定',
    '评估', '筛查', '体态', '圆肩', '驼背', '骨盆', '前倾',
    '代偿', '疼痛', '不适', '酸痛', '紧张',
    '办公', '久坐', '跑步', '训练', '健身',
    '上交叉', '下交叉', '肌力', '柔韧',
    '动作', '模式', '铰链', '推', '拉', '蹲',
  ];

  const foundTerms: string[] = [];
  
  for (const term of keyTerms) {
    if (text.includes(term)) {
      foundTerms.push(term);
    }
  }

  // Also split by common delimiters
  const words = text.split(/[，。？！、\s]+/).filter(w => w.length >= 2);
  
  return [...new Set([...foundTerms, ...words])];
}

// Search knowledge nodes by keywords
async function searchKnowledgeNodes(keywords: string[]): Promise<any[]> {
  if (keywords.length === 0) {
    return [];
  }

  // Build OR conditions for title, description, and content
  const searchConditions = keywords.slice(0, 10).map(k => 
    `title.ilike.%${k}%,description.ilike.%${k}%`
  ).join(',');

  const { data, error } = await supabase
    .from('knowledge_nodes')
    .select('id, title, slug, description, content, body_region, node_type')
    .eq('is_published', true)
    .in('node_type', ['article', 'topic', 'category'])
    .or(searchConditions)
    .limit(10);

  if (error) {
    console.error('Search error:', error);
    return [];
  }

  return data || [];
}

// Save conversation to database
async function saveConversation(
  userId: string, 
  question: string, 
  answer: string, 
  conversationId: string
) {
  try {
    // Check if conversation exists
    const { data: existing } = await supabase
      .from('knowledge_ai_conversations')
      .select('id, messages')
      .eq('conversation_id', conversationId)
      .single();

    const newMessages = [
      { role: 'user', content: question, timestamp: new Date().toISOString() },
      { role: 'assistant', content: answer, timestamp: new Date().toISOString() },
    ];

    if (existing) {
      // Append to existing conversation
      const updatedMessages = [...(existing.messages || []), ...newMessages];
      await supabase
        .from('knowledge_ai_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      // Create new conversation
      await supabase.from('knowledge_ai_conversations').insert({
        user_id: userId,
        conversation_id: conversationId,
        messages: newMessages,
      });
    }
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
}
