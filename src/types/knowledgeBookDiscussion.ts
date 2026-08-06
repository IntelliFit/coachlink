export type KnowledgeBookDiscussionAuthor = {
  name: string;
  avatarUrl: string | null;
};
export type KnowledgeBookDiscussionComment = {
  id: string;
  bookId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: KnowledgeBookDiscussionAuthor;
  isMine: boolean;
};

export type ListKnowledgeBookCommentsResponse = {
  comments: KnowledgeBookDiscussionComment[];
  total: number;
  limit: number;
  offset: number;
  available: boolean;
};
