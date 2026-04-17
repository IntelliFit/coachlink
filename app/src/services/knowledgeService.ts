import { BaseService } from '../utils/request'
import { request } from '../utils/request'

export interface KnowledgeSearchResult {
  id: string
  title: string
  description: string | null
  node_type: string
  slug: string
  body_region?: string[] | null
  is_free?: boolean
}

export interface KnowledgeTreeNode {
  id: string
  node_type: string
  title: string
  slug?: string | null
  description?: string | null
  icon?: string | null
  is_published?: boolean
  sort_order?: number
  is_coach_content?: boolean
  thumbnail_url?: string | null
  required_tier?: number | null
  coach?: {
    id?: string
    name?: string
    avatar_url?: string | null
  } | null
  children?: KnowledgeTreeNode[]
}

export interface KnowledgeNodeListItem {
  id: string
  node_type: string
  title: string
  description?: string | null
  icon?: string | null
  body_region?: string[] | null
  equipment?: string[] | null
  difficulty?: number
  is_free?: boolean
  is_collaborative?: boolean
  is_coach_content?: boolean
  thumbnail_url?: string | null
  created_at?: string | null
  required_tier?: number | null
  coach?: {
    id?: string
    name?: string
    avatar_url?: string | null
  } | null
  editors?: Array<{
    user_id: string
    user_name: string
    user_avatar?: string | null
    contributed_at?: string
    contribution_type?: string
  }>
}

interface ListKnowledgeBooksDto {
  is_free?: boolean
  is_published?: boolean
  page?: number
  limit?: number
}

interface ListKnowledgeBooksResponseDto {
  books: any[]
  total: number
  page: number
  limit: number
}

interface ListCoachContentsDto {
  limit?: number
  offset?: number
  content_type?: string
}

interface CoachContentListItem {
  content: any
  coach: {
    id: string
    name: string
    avatar_url: string | null
    status: string | null
  }
  accessTier: number
  canView: boolean
}

interface ListCoachContentsResponseDto {
  items: CoachContentListItem[]
  total: number
  limit: number
  offset: number
}

class KnowledgeService extends BaseService {
  /** 获取单本知识库书籍详情（含权限 hasAccess） */
  async getKnowledgeBook(params: { id: string }) {
    const res = await this.post<{ book: any; hasAccess: boolean }>('get-book', { id: params.id })
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取知识库书籍列表 */
  async listKnowledgeBooks(params?: ListKnowledgeBooksDto) {
    const res = await this.post<ListKnowledgeBooksResponseDto>('list-books', {
      is_free: params?.is_free,
      is_published: params?.is_published ?? true,
      page: params?.page ?? 0,
      limit: params?.limit ?? 20
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取知识节点详情（GET /api/knowledge/nodes/:id） */
  async getNode(nodeId: string): Promise<{ node: any; articles?: any[] } | null> {
    const res = await request<any>({
      url: `${this.baseUrl}/nodes/${nodeId}`,
      method: 'GET',
      showErrorToast: false
    })
    const payload = res?.data ?? res
    if (payload?.node) return payload
    return null
  }

  /** 知识库关键词搜索（GET /api/knowledge/search?q=xxx） */
  async search(keyword: string, limit = 20): Promise<KnowledgeSearchResult[]> {
    const q = (keyword || '').trim()
    if (!q) return []
    const res = await request<any>({
      url: `${this.baseUrl}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      method: 'GET',
      showErrorToast: false
    })
    const payload = res?.data ?? res
    const results = payload?.results
    return Array.isArray(results) ? results : []
  }

  /** 获取知识树 */
  async getTree(): Promise<KnowledgeTreeNode[]> {
    const res = await request<any>({
      url: `${this.baseUrl}/tree`,
      method: 'GET',
      showErrorToast: false
    })
    const payload = res?.data ?? res
    return Array.isArray(payload?.tree) ? payload.tree : []
  }

  /** 获取知识节点列表 */
  async listNodes(params?: {
    parentId?: string
    bodyRegion?: string
    published?: boolean
  }): Promise<{ nodes: KnowledgeNodeListItem[]; articles: KnowledgeNodeListItem[] }> {
    const query: string[] = []
    if (params?.parentId) {
      query.push(`parent_id=${encodeURIComponent(params.parentId)}`)
    }
    if (params?.bodyRegion) {
      query.push(`body_region=${encodeURIComponent(params.bodyRegion)}`)
    }
    if (params?.published === false) {
      query.push('published=false')
    }
    const queryString = query.length > 0 ? `?${query.join('&')}` : ''
    const res = await request<any>({
      url: `${this.baseUrl}/nodes${queryString}`,
      method: 'GET',
      showErrorToast: false
    })
    const payload = res?.data ?? res
    return {
      nodes: Array.isArray(payload?.nodes) ? payload.nodes : [],
      articles: Array.isArray(payload?.articles) ? payload.articles : []
    }
  }

  /** 获取教练内容列表（技术文章） */
  async listCoachContents(params?: ListCoachContentsDto) {
    const res = await this.post<ListCoachContentsResponseDto>('list-coach-contents', {
      limit: params?.limit ?? 20,
      offset: params?.offset ?? 0,
      content_type: params?.content_type
    })
    if (res.success && res.data) return res.data
    return null
  }
}

export const knowledgeService = new KnowledgeService('/api/knowledge')
