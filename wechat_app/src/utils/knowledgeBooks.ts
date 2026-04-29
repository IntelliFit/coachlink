type SourceShape = {
  title?: string
  authors?: string[]
  collectionSlug?: string
  collectionTitle?: string
  noteType?: 'overview' | 'chapter'
  chapterOrder?: number
  chapterTitle?: string
}

type KnowledgeBook = {
  id: string
  title: string
  summary?: string | null
  sort_order?: number | null
  is_free?: boolean | null
  content?: unknown
}

export type KnowledgeBookCollection<TBook extends KnowledgeBook = KnowledgeBook> = {
  slug: string
  displayTitle: string
  representativeBook: TBook
  overviewBook: TBook | null
  books: TBook[]
  chapterBooks: TBook[]
  chapterCount: number
  summary: string
}

function extractBookTitle(text?: string | null) {
  if (!text) return null
  const matched = text.match(/《([^》]+)》/)
  if (matched?.[1]) return matched[1].trim()

  return text
    .replace(/专题解读/g, '')
    .replace(/深度阅读笔记/g, '')
    .replace(/专题\d+[:：].*$/g, '')
    .trim() || null
}

export function getKnowledgeBookSource(content: unknown): SourceShape | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return null
  }

  const maybeSource = (content as { source?: unknown }).source
  if (!maybeSource || typeof maybeSource !== 'object' || Array.isArray(maybeSource)) {
    return null
  }

  return maybeSource as SourceShape
}

function compareBooks<TBook extends KnowledgeBook>(a: TBook, b: TBook) {
  const sourceA = getKnowledgeBookSource(a.content)
  const sourceB = getKnowledgeBookSource(b.content)
  const orderA = sourceA?.noteType === 'overview' ? -1 : sourceA?.chapterOrder ?? 999
  const orderB = sourceB?.noteType === 'overview' ? -1 : sourceB?.chapterOrder ?? 999

  if (orderA !== orderB) {
    return orderA - orderB
  }

  const sortA = a.sort_order ?? 999
  const sortB = b.sort_order ?? 999
  if (sortA !== sortB) {
    return sortA - sortB
  }

  return a.title.localeCompare(b.title, 'zh-CN')
}

export function groupKnowledgeBooks<TBook extends KnowledgeBook>(books: TBook[]) {
  const groups = new Map<string, TBook[]>()

  for (const book of books) {
    const source = getKnowledgeBookSource(book.content)
    const slug = source?.collectionSlug || `standalone:${book.id}`
    const bucket = groups.get(slug) || []
    bucket.push(book)
    groups.set(slug, bucket)
  }

  const collections: KnowledgeBookCollection<TBook>[] = []

  for (const [slug, items] of groups.entries()) {
    const sortedBooks = [...items].sort(compareBooks)
    const overviewBook =
      sortedBooks.find((item) => getKnowledgeBookSource(item.content)?.noteType === 'overview') || null
    const representativeBook = overviewBook || sortedBooks[0]
    const representativeSource = getKnowledgeBookSource(representativeBook.content)
    const displayTitle =
      representativeSource?.title ||
      extractBookTitle(representativeSource?.collectionTitle) ||
      extractBookTitle(representativeBook.title) ||
      representativeBook.title
    const chapterBooks = sortedBooks.filter(
      (item) => getKnowledgeBookSource(item.content)?.noteType === 'chapter'
    )

    collections.push({
      slug,
      displayTitle,
      representativeBook,
      overviewBook,
      books: sortedBooks,
      chapterBooks,
      chapterCount: chapterBooks.length,
      summary: overviewBook?.summary || representativeBook.summary || '暂无简介'
    })
  }

  return collections.sort((a, b) => compareBooks(a.representativeBook, b.representativeBook))
}
