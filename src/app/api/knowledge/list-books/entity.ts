export interface ListKnowledgeBooksDto {
  is_free?: boolean;
  is_published?: boolean;
  page?: number;
  limit?: number;
}

export interface ListKnowledgeBooksResponseDto {
  books: any[]; // KnowledgeBookRow[] after importing type
  total: number;
  page: number;
  limit: number;
}
