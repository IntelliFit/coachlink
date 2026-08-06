import React, { useEffect, useMemo, useState } from 'react'
import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Search } from '@nutui/icons-react-taro'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { authService } from '@/services/authService'
import { knowledgeService } from '@/services/knowledgeService'
import { groupKnowledgeBooks, type KnowledgeBookCollection } from '@/utils/knowledgeBooks'
import { useTheme } from '@/hooks/useTheme'
import './index.scss'

export default function KnowledgeBooksPage() {
  const { effectiveTheme } = useTheme()
  const [collections, setCollections] = useState<KnowledgeBookCollection<any>[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authService.getAuthSession({ normalize: true }).isAuthenticated) {
      const returnTo = '/content/knowledge/books/index'
      Taro.redirectTo({ url: authService.buildLoginUrl(returnTo) })
      return
    }

    void (async () => {
      try {
        const result = await knowledgeService.listKnowledgeBooks({
          is_published: true,
          page: 0,
          limit: 1000
        })
        setCollections(groupKnowledgeBooks(result?.books || []))
      } catch (loadError) {
        console.error('[knowledge] load all books:', loadError)
        setError('书籍列表加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filteredCollections = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return collections
    return collections.filter((collection) => {
      const author = collection.representativeBook.author || ''
      return [collection.displayTitle, collection.summary, author]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [collections, keyword])

  return (
    <PageThemeRoot>
      <View className={`knowledge-books-page theme-${effectiveTheme}`}>
        <ScrollView scrollY className='books-scroll'>
          <View className='books-shell'>
            <View className='books-hero'>
              <Text className='books-title'>全部书籍笔记</Text>
              <Text className='books-subtitle'>按整本书聚合总览、章节、思维导图和讨论。</Text>
            </View>

            <View className='books-search'>
              <Search size={18} color='#9CA3AF' />
              <Input
                className='books-search-input'
                value={keyword}
                placeholder='搜索书名、作者或主题'
                onInput={(event) => setKeyword(event.detail.value)}
              />
            </View>

            <Text className='books-count'>
              {loading ? '正在整理书架' : `共 ${filteredCollections.length} 本`}
            </Text>

            {loading ? (
              <View className='books-state'><LoadingSpinner size={48} /></View>
            ) : error ? (
              <View className='books-state'><Text>{error}</Text></View>
            ) : filteredCollections.length > 0 ? (
              <View className='books-list'>
                {filteredCollections.map((collection) => (
                  <View
                    key={collection.slug}
                    className='books-card'
                    onClick={() => Taro.navigateTo({
                      url: `/content/knowledge/book-detail?id=${collection.representativeBook.id}`
                    })}
                  >
                    {collection.representativeBook.cover_image ? (
                      <Image
                        className='books-cover'
                        src={collection.representativeBook.cover_image}
                        mode='aspectFill'
                      />
                    ) : (
                      <View className='books-cover-placeholder'><Text>书</Text></View>
                    )}
                    <View className='books-card-main'>
                      <Text className='books-card-title' numberOfLines={2}>{collection.displayTitle}</Text>
                      {collection.representativeBook.author ? (
                        <Text className='books-author' numberOfLines={1}>{collection.representativeBook.author}</Text>
                      ) : null}
                      <Text className='books-summary' numberOfLines={2}>{collection.summary}</Text>
                      <View className='books-meta'>
                        <Text>{collection.chapterCount > 0 ? `${collection.chapterCount} 篇章节` : '单篇解读'}</Text>
                        <Text>{collection.representativeBook.is_free ? '免费' : '订阅'}</Text>
                      </View>
                    </View>
                    <Text className='books-arrow'>›</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className='books-state'><Text>没有找到匹配的书籍。</Text></View>
            )}
          </View>
        </ScrollView>
      </View>
    </PageThemeRoot>
  )
}
