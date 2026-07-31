export interface GetKnowledgeBookDto {
  id: string;
}

export interface GetKnowledgeBookResponseDto {
  book: any | null; // KnowledgeBookRow | null after importing type
  hasAccess: boolean;
  collectionBooks: any[];
}
