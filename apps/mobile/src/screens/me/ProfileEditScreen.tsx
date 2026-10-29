import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { fetchWithTimeout, getStoredToken, persistSession } from '../../api'
import { API_BASE_URL } from '../../config'
import { useAuth } from '../../providers/AuthProvider'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { Card, FormField, InlineAvatar, LoadingState, ScreenShell, SolidButton, errorMessage, safeRequest, type RootNav } from './MeShared'
import { getEmptySportCards, getTotalWeight, showTotalWeight, typicalActionMaps, type SportCards } from './sportsCollections'

// 选项与小程序 me/profile/edit 一致
const GENDER_OPTIONS = [
  { text: '男', value: 'male' },
  { text: '女', value: 'female' },
]
const FITNESS_GOAL_OPTIONS = [
  { text: '减脂塑形', value: '减脂' },
  { text: '增肌强身', value: '增肌' },
  { text: '力量提升', value: '力量提升' },
  { text: '体能改善', value: '体能改善' },
]
const FITNESS_LEVEL_OPTIONS = [
  { text: '零基础', value: 'beginner' },
  { text: '入门', value: 'novice' },
  { text: '进阶', value: 'intermediate' },
  { text: '高阶', value: 'advanced' },
  { text: '精英 / 职业', value: 'elite' },
]
const SPORT_TYPES = [
  { key: 'powerlifting', label: '力量举' },
  { key: 'streetlifting', label: '街头力量' },
  { key: 'calisthenics', label: '街头健身' },
  { key: 'weightlifting', label: '举重' },
  { key: 'bodybuilding', label: '健美/形体' },
  { key: 'running', label: '跑步' },
  { key: 'cycling', label: '骑行' },
]
const STEP_TITLES = ['基本信息', '练习领域', '历史成绩']

type FormState = {
  nickname: string
  avatar_url: string
  age: string
  gender: string
  height: string
  weight: string
  lifestyle: string
  fitness_goal: string
  fitness_level: string
  sport_cards: SportCards
}

function numberOrNull(text: string) {
  const value = Number(text)
  return text.trim() && Number.isFinite(value) && value >= 0 ? value : null
}

/** 与小程序 handleSave 同一组字段；保存时只提交和加载时不同的字段，避免误清空已有资料。 */
function buildProfilePayload(form: FormState) {
  return {
    nickname: form.nickname.trim(),
    avatar_url: form.avatar_url || null,
    age: numberOrNull(form.age),
    gender: form.gender,
    height: numberOrNull(form.height),
    weight: numberOrNull(form.weight),
    lifestyle: form.lifestyle,
    fitness_goal: form.fitness_goal,
    fitness_level: form.fitness_level,
    sport_cards: form.sport_cards,
  }
}

const DECIMAL = /^\d+(\.\d+)?$/

function numberText(value: unknown) {
  return value === null || value === undefined || value === '' ? '' : String(value)
}

/** 编辑资料：与小程序一致的三步（基本信息 → 练习领域 → 历史成绩），进入时回显已有资料。 */
export function ProfileEditScreen() {
  const navigation = useNavigation<RootNav>()
  const { user, setLocalUser } = useAuth()
  const [step, setStep] = useState(1)
  const [booting, setBooting] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  // 成绩输入的原始文本（保留「62.」这类中间态），合法数值才写回表单。
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({})
  const [loadError, setLoadError] = useState('')
  const loadedPayloadRef = useRef<Record<string, unknown> | null>(null)
  const [form, setForm] = useState<FormState>({
    nickname: String(user?.nickname || user?.name || ''),
    avatar_url: String(user?.avatar_url || user?.avatar || ''),
    age: '',
    gender: '',
    height: '',
    weight: '',
    lifestyle: '',
    fitness_goal: '',
    fitness_level: '',
    sport_cards: getEmptySportCards(),
  })

  const patch = (next: Partial<FormState>) => setForm((current) => ({ ...current, ...next }))

  const loadProfile = useCallback(() => {
    if (!user?.id) {
      setBooting(false)
      return
    }
    setBooting(true)
    setLoadError('')
    safeRequest<{ profile?: Record<string, any> | null }>('/api/user/get-student-profile', { body: { userId: user.id } })
      .then((data) => {
        const profile = data?.profile
        if (!profile) {
          setForm((current) => {
            loadedPayloadRef.current = buildProfilePayload(current)
            return current
          })
          return
        }
        setForm((current) => {
          const next: FormState = {
          nickname: profile.nickname || current.nickname,
          avatar_url: profile.avatar_url || current.avatar_url,
          age: numberText(profile.age),
          gender: profile.gender || '',
          height: numberText(profile.height),
          weight: numberText(profile.weight),
          lifestyle: profile.lifestyle || '',
          fitness_goal: profile.fitness_goal || '',
          fitness_level: profile.fitness_level || '',
          sport_cards: { ...getEmptySportCards(), ...((profile.sport_cards as SportCards) || {}) },
          }
          loadedPayloadRef.current = buildProfilePayload(next)
          return next
        })
      })
      // 加载失败时不能让用户在空表单上保存，否则会把服务端已有资料覆盖成空值。
      .catch((error) => setLoadError(errorMessage(error, '资料加载失败')))
      .finally(() => setBooting(false))
  }, [user?.id])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function uploadAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82 })
    if (result.canceled || !result.assets[0]?.uri) return
    setUploading(true)
    try {
      const token = await getStoredToken()
      const body = new FormData()
      body.append('file', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' } as any)
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/upload/avatar`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success || !json?.data?.url) throw new Error(json?.message || '头像上传失败')
      patch({ avatar_url: json.data.url })
    } catch (error) {
      Alert.alert('头像上传失败', errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  function toggleCard(key: string) {
    const active = form.sport_cards.activeCards || []
    const activeCards = active.includes(key) ? active.filter((item) => item !== key) : [...active, key]
    patch({ sport_cards: { ...form.sport_cards, activeCards } })
  }

  function updateCardField(cardKey: string, field: string, text: string) {
    // 部分安卓键盘的小数点是逗号
    const normalized = text.replace(/，|,/g, '.')
    setCardDrafts((current) => ({ ...current, [`${cardKey}.${field}`]: normalized }))
    if (normalized.trim() && !DECIMAL.test(normalized.trim())) return
    text = normalized
    setForm((current) => {
      const card = (current.sport_cards as any)[cardKey] || {}
      return { ...current, sport_cards: { ...current.sport_cards, [cardKey]: { ...card, [field]: numberOrNull(text) } } }
    })
  }

  async function save() {
    if (loadError || !loadedPayloadRef.current) {
      Alert.alert('资料还没加载成功', '请先重新加载资料再保存。')
      return
    }
    const invalid = Object.entries(cardDrafts).find(([, text]) => text.trim() && !DECIMAL.test(text.trim()))
    if (invalid) {
      Alert.alert('成绩格式不对', '请输入数字，例如 62.5。')
      return
    }
    const payload = buildProfilePayload(form)
    const baseline = loadedPayloadRef.current
    const changed = Object.fromEntries(Object.entries(payload).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key])))
    if (Object.keys(changed).length === 0) {
      navigation.goBack()
      return
    }
    setSaving(true)
    try {
      await safeRequest('/api/user/update-profile', { body: changed })
      const nextUser = { ...(user || {}), nickname: form.nickname.trim() || user?.nickname, avatar_url: form.avatar_url || null }
      const token = await getStoredToken()
      if (user?.id && token) await persistSession({ user: nextUser as any, token })
      setLocalUser(nextUser as any)
      Alert.alert('保存成功', '个人资料已更新。', [{ text: '好的', onPress: () => navigation.goBack() }])
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  if (booting) {
    return (
      <ScreenShell title="编辑资料" onBack={navigation.goBack}>
        <LoadingState title="正在加载资料" />
      </ScreenShell>
    )
  }

  if (loadError) {
    return (
      <ScreenShell title="编辑资料" onBack={navigation.goBack}>
        <Card>
          <Text style={styles.cardHint}>资料加载失败：{loadError}。为避免覆盖已有资料，加载成功后才能编辑。</Text>
          <SolidButton label="重新加载" onPress={loadProfile} />
        </Card>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="编辑资料" onBack={navigation.goBack}>
      <View style={styles.progressHeader}>
        <Text style={styles.stepIndicator}>第 {step} 步 / 共 3 步</Text>
        <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>

      {step === 1 ? (
        <Card>
          <Pressable accessibilityRole="button" accessibilityLabel="更换头像" disabled={uploading} onPress={() => void uploadAvatar()} style={styles.avatarRow}>
            <InlineAvatar uri={form.avatar_url || undefined} label={form.nickname || user?.phone} size={80} />
            <Text style={styles.avatarLink}>{uploading ? '上传中…' : '更换头像'}</Text>
          </Pressable>
          <FormField label="昵称" value={form.nickname} onChangeText={(nickname) => patch({ nickname })} placeholder="如何称呼您？" />
          <OptionGroup label="性别" options={GENDER_OPTIONS} value={form.gender} onChange={(gender) => patch({ gender })} />
          <View style={styles.row}>
            <View style={styles.flex}><FormField label="年龄" value={form.age} onChangeText={(age) => patch({ age })} keyboardType="numeric" /></View>
            <View style={styles.flex}><FormField label="身高 cm" value={form.height} onChangeText={(height) => patch({ height })} keyboardType="numeric" /></View>
            <View style={styles.flex}><FormField label="体重 kg" value={form.weight} onChangeText={(weight) => patch({ weight })} keyboardType="numeric" /></View>
          </View>
          <OptionGroup label="健身目标" options={FITNESS_GOAL_OPTIONS} value={form.fitness_goal} onChange={(fitness_goal) => patch({ fitness_goal })} />
          <OptionGroup label="健身水平" options={FITNESS_LEVEL_OPTIONS} value={form.fitness_level} onChange={(fitness_level) => patch({ fitness_level })} />
          <FormField label="生活作息" value={form.lifestyle} onChangeText={(lifestyle) => patch({ lifestyle })} placeholder="如：朝九晚五" />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Text style={styles.cardHint}>选择你练习的领域，下一步可以填写历史成绩。</Text>
          <View style={styles.chips}>
            {SPORT_TYPES.map((sport) => {
              const active = (form.sport_cards.activeCards || []).includes(sport.key)
              return (
                <Pressable key={sport.key} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggleCard(sport.key)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{sport.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </Card>
      ) : null}

      {step === 3 ? (
        (form.sport_cards.activeCards || []).length === 0 ? (
          <Card><Text style={styles.cardHint}>还没有选择练习领域，可以返回上一步选择，或直接保存。</Text></Card>
        ) : (
          (form.sport_cards.activeCards || []).map((cardKey) => {
            const config = SPORT_TYPES.find((sport) => sport.key === cardKey)
            if (!config) return null
            const cardData = (form.sport_cards as any)[cardKey] || {}
            return (
              <Card key={cardKey}>
                <View style={styles.sportHeader}>
                  <Text style={styles.sportTitle}>{config.label}</Text>
                  {showTotalWeight(cardKey) ? <Text style={styles.sportTotal}>总计 {getTotalWeight(cardKey, cardData)} KG</Text> : null}
                </View>
                {Object.keys(cardData).map((field) => {
                  const fieldConfig = typicalActionMaps[field]
                  if (!fieldConfig) return null
                  return (
                    <View key={field} style={styles.sportRow}>
                      <Text style={styles.sportLabel}>{fieldConfig.nameCn}</Text>
                      <TextInput
                        accessibilityLabel={fieldConfig.nameCn}
                        value={cardDrafts[`${cardKey}.${field}`] ?? numberText(cardData[field])}
                        onChangeText={(text) => updateCardField(cardKey, field, text)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        style={styles.sportInput}
                      />
                      <Text style={styles.sportUnit}>{fieldConfig.unit}</Text>
                    </View>
                  )
                })}
              </Card>
            )
          })
        )
      ) : null}

      <View style={styles.footer}>
        <View style={styles.flex}>
          <SolidButton label={step === 1 ? '取消' : '上一步'} variant="secondary" onPress={() => (step === 1 ? navigation.goBack() : setStep(step - 1))} />
        </View>
        <View style={styles.flex}>
          {step < 3 ? <SolidButton label="下一步" onPress={() => setStep(step + 1)} /> : <SolidButton label="保存" loading={saving} onPress={() => void save()} />}
        </View>
      </View>
    </ScreenShell>
  )
}

function OptionGroup({ label, options, value, onChange }: { label: string; options: Array<{ text: string; value: string }>; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = option.value === value
          return (
            <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => onChange(active ? '' : option.value)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.text}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    color: colors.textTertiary,
    ...typography.meta,
  },
  stepTitle: {
    color: colors.text,
    ...typography.card,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  avatarRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarLink: {
    color: colors.link,
    ...typography.meta,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
  },
  optionGroup: {
    gap: spacing.xs,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  // 与小程序 ClChip 一致：灰底胶囊，选中深色底白字
  chip: {
    minHeight: controlHeight.chip,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: colors.selected,
  },
  chipText: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  chipTextActive: {
    color: colors.selectedText,
    fontWeight: '500',
  },
  cardHint: {
    color: colors.textTertiary,
    ...typography.meta,
  },
  sportHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sportTitle: {
    color: colors.text,
    ...typography.card,
  },
  sportTotal: {
    color: colors.brandText,
    ...typography.meta,
    fontWeight: '600',
  },
  sportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sportLabel: {
    flex: 1,
    color: colors.textSecondary,
    ...typography.body,
  },
  sportInput: {
    width: 96,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    color: colors.text,
    textAlign: 'right',
    fontSize: 15,
    backgroundColor: colors.surface,
  },
  sportUnit: {
    width: 32,
    color: colors.textTertiary,
    ...typography.meta,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
})
