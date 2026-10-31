import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { getBeijingDateParts } from '@coachlink/core/src/beijingTime'
import { apiClient } from '../../api'
import { SectionCard } from '../../components/SectionCard'
import { colors, radius, spacing } from '../../theme'
import { InlineAvatar, errorMessage } from '../me/MeShared'
import type { BookExtras, MindMapNode } from './bookExtras'

export { bookExtras } from './bookExtras'

/**
 * 书籍详情的结构化内容与读者讨论，对应小程序 content/knowledge/book-detail。
 */

export function BookGuideSections({ extras }: { extras: BookExtras }) {
  const guide = extras.readingGuide
  return (
    <>
      {guide ? (
        <SectionCard title="阅读导航" description={guide.estimatedMinutes ? `约 ${guide.estimatedMinutes} 分钟` : undefined}>
          {guide.suitableFor?.length ? (
            <View style={styles.block}>
              <Text style={styles.label}>适合谁读</Text>
              <View style={styles.tags}>{guide.suitableFor.map((item) => <Text key={item} style={styles.tag}>{item}</Text>)}</View>
            </View>
          ) : null}
          {guide.goals?.length ? (
            <View style={styles.block}>
              <Text style={styles.label}>读完应带走什么</Text>
              {guide.goals.map((item, index) => <Text key={item} style={styles.body}>{index + 1}. {item}</Text>)}
            </View>
          ) : null}
        </SectionCard>
      ) : null}
      {extras.keyTakeaways.length > 0 ? (
        <SectionCard title="本页要点">
          {extras.keyTakeaways.map((item, index) => <NumberedRow key={`${item}-${index}`} index={index + 1} text={item} />)}
        </SectionCard>
      ) : null}
      {extras.mindMap ? (
        <SectionCard title={extras.mindMap.title || '思维导图'} description={extras.mindMap.description}>
          {extras.mindMap.data.map((node, index) => <MindMapNodeView key={node.id || `${node.title || 'root'}-${index}`} node={node} depth={0} />)}
        </SectionCard>
      ) : null}
    </>
  )
}

export function BookReferenceSections({ extras }: { extras: BookExtras }) {
  return (
    <>
      {extras.discussionPrompts.length > 0 ? (
        <SectionCard title="带着问题讨论" description="先选一个问题写下自己的训练经历，再和其他读者交流。">
          {extras.discussionPrompts.map((item, index) => <NumberedRow key={`${item}-${index}`} index={index + 1} text={item} />)}
        </SectionCard>
      ) : null}
      {extras.citations.length > 0 ? (
        <SectionCard title="来源与版本">
          {extras.citations.map((item, index) => (
            <Pressable
              key={`${item.title || 'citation'}-${index}`}
              accessibilityRole={item.url ? 'button' : 'text'}
              accessibilityLabel={item.url ? `复制来源链接：${item.title}` : item.title}
              disabled={!item.url}
              onPress={() => item.url && void Clipboard.setStringAsync(item.url).then(() => Alert.alert('链接已复制'))}
              style={styles.citation}
            >
              <Text style={styles.citationTitle}>{item.title || '未命名来源'}</Text>
              {item.note ? <Text style={styles.body}>{item.note}</Text> : null}
              <Text style={styles.meta}>{[item.license, item.accessedAt ? `访问于 ${item.accessedAt}` : '', item.url ? '点击复制链接' : ''].filter(Boolean).join(' · ')}</Text>
            </Pressable>
          ))}
        </SectionCard>
      ) : null}
    </>
  )
}

type BookComment = { id: string; parentId?: string | null; body: string; createdAt: string; isMine?: boolean; author: { name: string; avatarUrl?: string | null } }

function formatDiscussionTime(value: string) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return ''
  const parts = getBeijingDateParts(value)
  return `${parts.year}/${parts.month}/${parts.day}`
}

const COMMENT_PAGE_SIZE = 50

/** 读者讨论：评论当前这篇总览或章节，可回复、删除自己的评论。 */
export function BookDiscussion({ bookId, prompts }: { bookId: string; prompts: string[] }) {
  const [comments, setComments] = useState<BookComment[]>([])
  const [available, setAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<BookComment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  // 服务端翻到哪了；本地发布的评论不算，否则下一页会跳过一条
  const nextOffsetRef = useRef(0)

  const load = useCallback(async () => {
    if (!bookId) return
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<any>('/api/knowledge/book-comments/list', { method: 'POST', body: { bookId, limit: COMMENT_PAGE_SIZE, offset: 0 }, timeoutMs: 12000 })
      const rows: BookComment[] = Array.isArray(data?.comments) ? data.comments : []
      nextOffsetRef.current = rows.length
      setComments(rows)
      setTotal(Number(data?.total) || rows.length)
      setAvailable(data?.available ?? true)
    } catch {
      setError('讨论加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [bookId])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const data = await apiClient.request<any>('/api/knowledge/book-comments/list', { method: 'POST', body: { bookId, limit: COMMENT_PAGE_SIZE, offset: nextOffsetRef.current }, timeoutMs: 12000 })
      const rows: BookComment[] = Array.isArray(data?.comments) ? data.comments : []
      nextOffsetRef.current += rows.length
      setTotal(Number(data?.total) || nextOffsetRef.current)
      setComments((current) => [...current, ...rows.filter((row) => !current.some((item) => item.id === row.id))]
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))))
    } catch {
      setError('讨论加载失败，请稍后重试')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const childrenByParent = useMemo(() => {
    const map = new Map<string, BookComment[]>()
    comments.forEach((comment) => {
      if (!comment.parentId) return
      map.set(comment.parentId, [...(map.get(comment.parentId) || []), comment])
    })
    return map
  }, [comments])
  const roots = comments.filter((comment) => !comment.parentId || !comments.some((candidate) => candidate.id === comment.parentId))

  async function submit() {
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const data = await apiClient.request<any>('/api/knowledge/book-comments/create', { method: 'POST', body: { bookId, body, parentId: replyingTo?.id || null }, timeoutMs: 12000 })
      if (data?.comment) {
        setComments((current) => [...current, data.comment])
        setTotal((current) => current + 1)
      }
      setDraft('')
      setReplyingTo(null)
    } catch (submitError) {
      setError(errorMessage(submitError, '发布失败，请稍后重试'))
    } finally {
      setSubmitting(false)
    }
  }

  function remove(comment: BookComment) {
    if (!comment.isMine) return
    Alert.alert('删除评论', '确定删除这条评论吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.request('/api/knowledge/book-comments/delete', { method: 'POST', body: { commentId: comment.id }, timeoutMs: 12000 })
            setComments((current) => current.filter((candidate) => candidate.id !== comment.id))
            setTotal((current) => Math.max(0, current - 1))
            nextOffsetRef.current = Math.max(0, nextOffsetRef.current - 1)
          } catch (deleteError) {
            Alert.alert('删除失败', errorMessage(deleteError))
          }
        },
      },
    ])
  }

  function renderComment(comment: BookComment, depth: number): React.ReactNode {
    const children = childrenByParent.get(comment.id) || []
    return (
      <View key={comment.id} style={[styles.comment, depth > 0 && { marginLeft: Math.min(depth, 2) * spacing.md }]}>
        <View style={styles.commentRow}>
          <InlineAvatar uri={comment.author?.avatarUrl} label={comment.author?.name} size={32} />
          <View style={styles.commentMain}>
            <View style={styles.commentHead}>
              <Text style={styles.author}>{comment.author?.name || '读者'}</Text>
              {comment.isMine ? <Text style={styles.mine}>我</Text> : null}
              <Text style={styles.meta}>{formatDiscussionTime(comment.createdAt)}</Text>
            </View>
            <Text style={styles.body}>{comment.body}</Text>
            <View style={styles.commentActions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`回复${comment.author?.name || '读者'}`} onPress={() => setReplyingTo(comment)} style={styles.commentAction}>
                <Text style={styles.link}>回复</Text>
              </Pressable>
              {comment.isMine ? (
                <Pressable accessibilityRole="button" accessibilityLabel="删除这条评论" onPress={() => remove(comment)} style={styles.commentAction}>
                  <Text style={styles.danger}>删除</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
        {children.map((child) => renderComment(child, depth + 1))}
      </View>
    )
  }

  return (
    <SectionCard title="读者讨论" description="评论当前这篇总览或章节；回复会保留上下文。">
      {!available ? <Text style={styles.body}>讨论区暂未开放发布。</Text> : (
        <>
          {prompts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptRow}>
              {prompts.slice(0, 3).map((prompt) => (
                <Pressable key={prompt} accessibilityRole="button" accessibilityLabel={`用这个问题开始写：${prompt}`} onPress={() => setDraft(`${prompt}\n\n`)} style={styles.promptChip}>
                  <Text style={styles.promptText} numberOfLines={2}>{prompt}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {replyingTo ? (
            <View style={styles.replying}>
              <Text style={styles.body}>正在回复 {replyingTo.author?.name || '读者'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="取消回复" onPress={() => setReplyingTo(null)} style={styles.commentAction}>
                <Text style={styles.link}>取消</Text>
              </Pressable>
            </View>
          ) : null}
          <TextInput accessibilityLabel="写评论" value={draft} onChangeText={setDraft} maxLength={2000} multiline textAlignVertical="top" placeholder="写下你的理解、训练经历或问题…" placeholderTextColor={colors.textMuted} style={styles.input} />
          <View style={styles.submitRow}>
            <Text style={styles.meta}>{draft.trim().length}/2000</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={replyingTo ? '发布回复' : '发布评论'} accessibilityState={{ disabled: !draft.trim() || submitting, busy: submitting }} disabled={!draft.trim() || submitting} onPress={() => void submit()} style={[styles.submit, (!draft.trim() || submitting) && styles.disabled]}>
              <Text style={styles.submitText}>{submitting ? '发布中' : replyingTo ? '发布回复' : '发布评论'}</Text>
            </Pressable>
          </View>
        </>
      )}
      {error ? <Text style={styles.danger}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : roots.length > 0 ? roots.map((comment) => renderComment(comment, 0)) : available ? <Text style={styles.meta}>还没有评论，欢迎留下第一条有内容的讨论。</Text> : null}
      {!loading && comments.length < total ? (
        <Pressable accessibilityRole="button" accessibilityLabel="加载更多讨论" accessibilityState={{ disabled: loadingMore, busy: loadingMore }} disabled={loadingMore} onPress={() => void loadMore()} style={styles.commentAction}>
          <Text style={styles.link}>{loadingMore ? '加载中…' : '加载更多讨论'}</Text>
        </Pressable>
      ) : null}
    </SectionCard>
  )
}

function NumberedRow({ index, text }: { index: number; text: string }) {
  return (
    <View style={styles.numbered}>
      <Text style={styles.number}>{index}</Text>
      <Text style={[styles.body, styles.flex]}>{text}</Text>
    </View>
  )
}

function MindMapNodeView({ node, depth }: { node: MindMapNode; depth: number }) {
  const children = Array.isArray(node.children) ? node.children : []
  return (
    <View style={[styles.mindNode, depth > 0 && styles.mindChild]}>
      <Text style={styles.mindTitle}>{node.title || '未命名节点'}</Text>
      {node.description ? <Text style={styles.meta}>{node.description}</Text> : null}
      {children.map((child, index) => <MindMapNodeView key={child.id || `${child.title || 'node'}-${index}`} node={child} depth={depth + 1} />)}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { gap: spacing.xs },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 12 },
  body: { color: colors.text, fontSize: 14, lineHeight: 22 },
  meta: { color: colors.textTertiary, fontSize: 12 },
  link: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  danger: { color: colors.danger, fontSize: 13 },
  numbered: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  number: { width: 24, height: 24, textAlign: 'center', lineHeight: 24, borderRadius: radius.pill, overflow: 'hidden', color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '700' },
  mindNode: { gap: 2, paddingVertical: 4 },
  mindChild: { marginLeft: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  mindTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  citation: { gap: 2, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  citationTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  promptRow: { gap: spacing.xs },
  promptChip: { width: 220, minHeight: 48, justifyContent: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  promptText: { color: colors.brandDark, fontSize: 13, lineHeight: 18 },
  replying: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  input: { minHeight: 96, padding: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14, lineHeight: 20 },
  submitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  submit: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brand },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  comment: { gap: spacing.xs },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  commentMain: { flex: 1, gap: 2 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  author: { color: colors.text, fontSize: 13, fontWeight: '600' },
  mine: { overflow: 'hidden', paddingHorizontal: 6, borderRadius: radius.pill, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 11 },
  commentActions: { flexDirection: 'row', gap: spacing.sm },
  commentAction: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
})
