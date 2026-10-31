import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../providers/AuthProvider'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { Card, EmptyState, FormField, LoadingState, ScreenShell, SolidButton, errorMessage, safeRequest, type RootNav } from '../me/MeShared'
import {
  SOCIAL_PLATFORMS,
  addListItem,
  buildCoachProfilePayload,
  coachProfileFormFromCoach,
  removeAt,
  validateCoachProfileForm,
  type CoachProfileForm,
  type SocialPlatformKey,
} from './coachProfileForm'

/** 教练公开主页编辑，对应小程序 coach/profile/[id]?edit=1（「个人设置」）。 */
export function CoachProfileEditScreen() {
  const navigation = useNavigation<RootNav>()
  const { user } = useAuth()
  const [coachId, setCoachId] = useState('')
  const [form, setForm] = useState<CoachProfileForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState({ specialty: '', achievement: '', caseStudy: '', credentialName: '', credentialUrl: '', socialUrl: '' })
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatformKey>('douyin')

  useEffect(() => {
    let alive = true
    async function load() {
      if (!user?.id) {
        setLoading(false)
        setLoadError('请先登录教练账号')
        return
      }
      setLoading(true)
      setLoadError('')
      try {
        const data = await safeRequest<{ coach?: any }>('/api/coach/get-coach', { body: { userId: user.id } })
        if (!alive) return
        if (!data?.coach?.id) throw new Error('未找到教练资料')
        setCoachId(String(data.coach.id))
        setForm(coachProfileFormFromCoach(data.coach))
      } catch (error) {
        // 读取失败时不显示空表单，避免保存时把已有资料清空
        if (alive) setLoadError(errorMessage(error, '教练资料加载失败'))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [user?.id])

  const patch = (next: Partial<CoachProfileForm>) => setForm((current) => (current ? { ...current, ...next } : current))
  const setDraft = (key: keyof typeof drafts, value: string) => setDrafts((current) => ({ ...current, [key]: value }))

  async function save() {
    if (!form || !coachId || saving) return
    const error = validateCoachProfileForm(form)
    if (error) {
      Alert.alert('还差一点', error)
      return
    }
    setSaving(true)
    try {
      await safeRequest('/api/coach/update-coach-profile', { body: buildCoachProfilePayload(coachId, form) })
      Alert.alert('保存成功', '学员在教练主页会看到最新资料。', [{ text: '好的', onPress: () => navigation.goBack() }])
    } catch (saveError) {
      Alert.alert('保存失败', errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenShell title="个人设置" subtitle="编辑教练介绍、专长、案例与联系方式" onBack={() => navigation.goBack()}>
      {loading ? <LoadingState title="正在读取教练资料" /> : null}
      {!loading && loadError ? <EmptyState title="加载失败" desc={loadError} /> : null}
      {!loading && form ? (
        <>
          <Card>
            <FormField label="教练名称" value={form.name} onChangeText={(name) => patch({ name })} placeholder="学员看到的名称" />
            <FormField label="头衔" value={form.title} onChangeText={(title) => patch({ title })} placeholder="例如：国家二级运动员 / 力量举教练" />
            <FormField label="从业年限" value={form.yearsExperience} keyboardType="numeric" onChangeText={(yearsExperience) => patch({ yearsExperience: yearsExperience.replace(/[^\d]/g, '') })} placeholder="年" />
            <FormField label="个人简介" value={form.bio} multiline onChangeText={(bio) => patch({ bio })} placeholder="介绍你的训练背景和擅长方向" />
          </Card>

          <Card>
            <ListEditor
              title="专业领域"
              items={form.specialties}
              draft={drafts.specialty}
              placeholder="例如：增肌、减脂、街头健身"
              onDraft={(value) => setDraft('specialty', value)}
              onAdd={() => { patch({ specialties: addListItem(form.specialties, drafts.specialty) }); setDraft('specialty', '') }}
              onRemove={(index) => patch({ specialties: removeAt(form.specialties, index) })}
              chips
            />
          </Card>

          <Card>
            <FormField label="教学理念" value={form.teachingPhilosophy} multiline onChangeText={(teachingPhilosophy) => patch({ teachingPhilosophy })} placeholder="你带学员的方式和原则" />
            <ListEditor
              title="成就"
              items={form.achievements}
              draft={drafts.achievement}
              placeholder="比赛成绩、认证等"
              onDraft={(value) => setDraft('achievement', value)}
              onAdd={() => { patch({ achievements: addListItem(form.achievements, drafts.achievement) }); setDraft('achievement', '') }}
              onRemove={(index) => patch({ achievements: removeAt(form.achievements, index) })}
            />
            <ListEditor
              title="学员案例"
              items={form.caseStudies}
              draft={drafts.caseStudy}
              placeholder="学员的变化和成果"
              onDraft={(value) => setDraft('caseStudy', value)}
              onAdd={() => { patch({ caseStudies: addListItem(form.caseStudies, drafts.caseStudy) }); setDraft('caseStudy', '') }}
              onRemove={(index) => patch({ caseStudies: removeAt(form.caseStudies, index) })}
            />
          </Card>

          <Card>
            <Text style={styles.groupTitle}>资质证书</Text>
            {form.credentials.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.listRow}>
                <View style={styles.listMain}>
                  <Text style={styles.listText}>{item.name}</Text>
                  {item.url ? <Text style={styles.listMeta} numberOfLines={1}>{item.url}</Text> : null}
                </View>
                <RemoveButton label={`删除证书${item.name}`} onPress={() => patch({ credentials: removeAt(form.credentials, index) })} />
              </View>
            ))}
            <TextInput accessibilityLabel="证书名称" value={drafts.credentialName} onChangeText={(value) => setDraft('credentialName', value)} placeholder="证书名称" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput accessibilityLabel="证书链接（可选）" value={drafts.credentialUrl} onChangeText={(value) => setDraft('credentialUrl', value)} placeholder="证书链接（可选）" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" style={styles.input} />
            <SolidButton
              label="添加证书"
              variant="secondary"
              disabled={!drafts.credentialName.trim()}
              onPress={() => {
                const url = drafts.credentialUrl.trim()
                patch({ credentials: [...form.credentials, { name: drafts.credentialName.trim(), ...(url ? { url } : {}) }] })
                setDrafts((current) => ({ ...current, credentialName: '', credentialUrl: '' }))
              }}
            />
          </Card>

          <Card>
            <FormField label="联系邮箱" value={form.contactEmail} keyboardType="email-address" onChangeText={(contactEmail) => patch({ contactEmail })} placeholder="可选" />
            <FormField label="联系电话" value={form.contactPhone} keyboardType="phone-pad" onChangeText={(contactPhone) => patch({ contactPhone })} placeholder="可选" />
            <Text style={styles.groupTitle}>社交平台</Text>
            {form.socialLinks.map((link, index) => (
              <View key={`${link.platform}-${index}`} style={styles.listRow}>
                <View style={styles.listMain}>
                  <Text style={styles.listText}>{SOCIAL_PLATFORMS.find((item) => item.key === link.platform)?.label}</Text>
                  <Text style={styles.listMeta} numberOfLines={1}>{link.url}</Text>
                </View>
                <RemoveButton label="删除这个社交平台" onPress={() => patch({ socialLinks: removeAt(form.socialLinks, index) })} />
              </View>
            ))}
            <View style={styles.chips}>
              {SOCIAL_PLATFORMS.map((platform) => {
                const active = socialPlatform === platform.key
                return (
                  <Pressable key={platform.key} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setSocialPlatform(platform.key)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{platform.label}</Text>
                  </Pressable>
                )
              })}
            </View>
            <TextInput accessibilityLabel="主页链接" value={drafts.socialUrl} onChangeText={(value) => setDraft('socialUrl', value)} placeholder="主页链接" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" style={styles.input} />
            <SolidButton
              label="添加社交平台"
              variant="secondary"
              disabled={!drafts.socialUrl.trim()}
              onPress={() => {
                // 每个平台只保留一个链接，与保存载荷（按平台为键）一致
                patch({ socialLinks: [...form.socialLinks.filter((item) => item.platform !== socialPlatform), { platform: socialPlatform, url: drafts.socialUrl.trim() }] })
                setDraft('socialUrl', '')
              }}
            />
          </Card>

          <SolidButton label="保存" loading={saving} onPress={() => void save()} />
        </>
      ) : null}
    </ScreenShell>
  )
}

function ListEditor(props: { title: string; items: string[]; draft: string; placeholder: string; onDraft: (value: string) => void; onAdd: () => void; onRemove: (index: number) => void; chips?: boolean }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{props.title}</Text>
      {props.chips ? (
        <View style={styles.chips}>
          {props.items.map((item, index) => (
            <Pressable key={`${item}-${index}`} accessibilityRole="button" accessibilityLabel={`删除${item}`} onPress={() => props.onRemove(index)} style={[styles.chip, styles.chipActive]}>
              <Text style={[styles.chipText, styles.chipTextActive]}>{item} ×</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        props.items.map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow}>
            <Text style={[styles.listText, styles.listMain]}>{item}</Text>
            <RemoveButton label={`删除${item}`} onPress={() => props.onRemove(index)} />
          </View>
        ))
      )}
      <View style={styles.addRow}>
        <TextInput accessibilityLabel={`添加${props.title}`} value={props.draft} onChangeText={props.onDraft} onSubmitEditing={props.onAdd} returnKeyType="done" placeholder={props.placeholder} placeholderTextColor={colors.textMuted} style={[styles.input, styles.addInput]} />
        <Pressable accessibilityRole="button" accessibilityLabel={`添加${props.title}`} accessibilityState={{ disabled: !props.draft.trim() }} disabled={!props.draft.trim()} onPress={props.onAdd} style={[styles.addButton, !props.draft.trim() && styles.disabled]}>
          <Text style={styles.addButtonText}>添加</Text>
        </Pressable>
      </View>
    </View>
  )
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.removeButton}>
      <Text style={styles.removeText}>删除</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  groupTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  listRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  listMain: { flex: 1, gap: 2 },
  listText: { color: colors.text, fontSize: 14 },
  listMeta: { color: colors.textTertiary, fontSize: 12 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addInput: { flex: 1 },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14 },
  addButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brand },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  removeButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: colors.danger, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
})
