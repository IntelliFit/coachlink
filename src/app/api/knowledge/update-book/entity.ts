export interface UpdateKnowledgeBookDto {
  id: string;
  title?: string;
  author?: string;
  cover_image?: string;
  summary?: string;
  audio_url?: string;
  content?: any; // JSONB content
  is_free?: boolean;
  is_published?: boolean;
  sort_order?: number;
}

export interface UpdateKnowledgeBookResponseDto {
  book: any | null; // KnowledgeBookRow | null after importing type
}
