// 请求参数的接口类型
export interface GetKnowledgeBooksDto {
  is_free?: boolean;
  is_published?: boolean;
}

export interface GetKnowledgeBookByIdDto {
  id: string;
}

export interface CreateKnowledgeBookDto {
  title: string;
  author?: string;
  cover_image?: string;
  summary?: string;
  audio_url?: string;
  content: any; // JSONB content
  is_free?: boolean;
  is_published?: boolean;
  sort_order?: number;
}

export interface UpdateKnowledgeBookDto extends CreateKnowledgeBookDto {
  id: string;
}

// 返回参数的接口类型
export interface GetKnowledgeBooksResponseDto {
  books: any[]; // KnowledgeBookRow[] after importing type
  total: number;
}

export interface GetKnowledgeBookByIdResponseDto {
  book: any | null; // KnowledgeBookRow | null after importing type
  hasAccess: boolean;
}

export interface CreateKnowledgeBookResponseDto {
  book: any | null; // KnowledgeBookRow | null after importing type
}

export interface UpdateKnowledgeBookResponseDto {
  book: any | null; // KnowledgeBookRow | null after importing type
}
