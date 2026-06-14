import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image, Button as TaroButton } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ConfigProvider, Dialog, Input, Picker, Popup } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'

type ProfileFieldKey = 'avatar_url' | 'nickname' | 'gender' | 'height' | 'weight' | 'fitness_goal' | 'fitness_level'
type QuestionnaireFieldKey = 'fitness_goals' | 'target_body_parts' | 'equipment' | 'weekly_frequency' | 'session_duration'
type FieldKey = ProfileFieldKey | QuestionnaireFieldKey

interface FitnessProfile {
  nickname?: string
  avatar_url?: string | null
  gender?: string
  height?: number | null
  weight?: number | null
  fitness_goal?: string
  fitness_level?: string
}

interface QuestionnaireAnswers {
  flow_version?: string
  fitness_goals?: string[]
  interest_tags?: string[]
  equipment?: string[]
  weekly_frequency?: number
  session_duration?: number
  target_body_parts?: string[]
}

interface FitnessCardData {
  profile: FitnessProfile
  answers: QuestionnaireAnswers
}

interface OptionItem {
  text: string
  value: string
}

const text = {
  title: '\u5065\u8eab\u8d44\u6599\u5361',
  desc: '\u8fd9\u91cc\u4fdd\u7559\u4f60\u6ce8\u518c\u5f15\u5bfc\u91cc\u586b\u8fc7\u7684\u5b8c\u6574\u5065\u8eab\u6863\u6848\uff0c\u70b9\u51fb\u4efb\u4f55\u4e00\u9879\u5c31\u53ef\u4ee5\u5355\u72ec\u4fee\u6539\u3002',
  empty: '\u672a\u586b\u5199',
  loading: '\u52a0\u8f7d\u4e2d...',
  loadFailed: '\u8d44\u6599\u52a0\u8f7d\u5931\u8d25',
  saved: '\u5df2\u4fdd\u5b58',
  saving: '\u4fdd\u5b58\u4e2d...',
  save: '\u4fdd\u5b58',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  uploading: '\u4e0a\u4f20\u4e2d...',
  avatarPlaceholder: '\u70b9\u51fb\u66f4\u6362\u5934\u50cf',
  avatarFailed: '\u5934\u50cf\u4e0a\u4f20\u5931\u8d25',
  cancel: '\u53d6\u6d88',
  edit: '\u7f16\u8f91',
  inputPrefix: '\u8bf7\u8f93\u5165',
  multiHint: '\u53ef\u591a\u9009\uff0c\u518d\u70b9\u4e00\u6b21\u53d6\u6d88',
  chooseOne: '\u8bf7\u9009\u62e9\u4e00\u9879'
}

const GENDER_OPTIONS: OptionItem[] = [
  { text: '\u7537\u6027', value: 'male' },
  { text: '\u5973\u6027', value: 'female' },
  { text: '\u6682\u65f6\u4e0d\u586b', value: 'unknown' }
]

const FITNESS_GOAL_OPTIONS: OptionItem[] = [
  { text: '\u51cf\u8102\u5851\u5f62', value: '\u51cf\u8102' },
  { text: '\u589e\u808c\u5f3a\u8eab', value: '\u589e\u808c' },
  { text: '\u529b\u91cf\u63d0\u5347', value: '\u529b\u91cf\u63d0\u5347' },
  { text: '\u4f53\u80fd\u6539\u5584', value: '\u4f53\u80fd\u6539\u5584' },
  { text: '\u4f53\u6001\u77eb\u6b63', value: '\u4f53\u6001\u77eb\u6b63' },
  { text: '\u8fd0\u52a8\u6062\u590d', value: '\u8fd0\u52a8\u6062\u590d' },
  { text: '\u7efc\u5408\u4f53\u9002\u80fd', value: '\u7efc\u5408\u4f53\u9002\u80fd' },
  { text: '\u7075\u6d3b\u67d4\u97e7', value: '\u7075\u6d3b\u67d4\u97e7' }
]

const FITNESS_LEVEL_OPTIONS: OptionItem[] = [
  { text: '\u96f6\u57fa\u7840', value: 'beginner' },
  { text: '\u5165\u95e8', value: 'novice' },
  { text: '\u8fdb\u9636', value: 'intermediate' },
  { text: '\u9ad8\u9636', value: 'advanced' },
  { text: '\u7cbe\u82f1 / \u804c\u4e1a', value: 'elite' }
]

const TARGET_BODY_PART_OPTIONS = [
  '\u80f8\u90e8',
  '\u80cc\u90e8',
  '\u80a9\u90e8',
  '\u5927\u81c2',
  '\u5c0f\u81c2',
  '\u8179\u90e8 / \u6838\u5fc3',
  '\u8170\u90e8',
  '\u81c0\u90e8',
  '\u5927\u817f',
  '\u5c0f\u817f',
  '\u5168\u8eab'
]

const EQUIPMENT_OPTIONS = [
  '\u5f92\u624b',
  '\u5355\u6760',
  '\u53cc\u6760',
  '\u54d1\u94c3',
  '\u6760\u94c3 / \u6760\u94c3\u7247',
  '\u58f6\u94c3',
  '\u5f39\u529b\u5e26 / \u62c9\u529b\u5668',
  '\u56fa\u5b9a\u5668\u68b0 / \u5668\u68b0\u533a'
]

const WEEKLY_FREQUENCY_OPTIONS = [1, 2, 3, 4, 5, 6]
const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90]

const LEGACY_GOAL_MAP: Record<string, string> = {
  gain_muscle: '\u589e\u808c',
  lose_weight: '\u51cf\u8102',
  improve_fitness: '\u4f53\u80fd\u6539\u5584',
  rehabilitation: '\u8fd0\u52a8\u6062\u590d',
  maintain_health: '\u7efc\u5408\u4f53\u9002\u80fd'
}

const FIELD_LABELS: Record<FieldKey, string> = {
  avatar_url: '\u5934\u50cf',
  nickname: '\u6635\u79f0',
  gender: '\u6027\u522b',
  height: '\u8eab\u9ad8',
  weight: '\u4f53\u91cd',
  fitness_goals: '\u5065\u8eab\u76ee\u6807',
  target_body_parts: '\u76ee\u6807\u90e8\u4f4d',
  fitness_goal: '\u5065\u8eab\u76ee\u6807',
  fitness_level: '\u8bad\u7ec3\u6c34\u5e73',
  equipment: '\u5e38\u7528\u5668\u68b0',
  weekly_frequency: '\u6bcf\u5468\u8bad\u7ec3\u9891\u7387',
  session_duration: '\u5355\u6b21\u8bad\u7ec3\u65f6\u957f'
}

function findOptionText(options: OptionItem[], value?: string) {
  if (!value) return ''
  return options.find((option) => option.value === value)?.text || value
}

function normalizeStringArray(value: any): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function normalizeFitnessGoal(value: any) {
  const raw = String(value || '').trim()
  return LEGACY_GOAL_MAP[raw] || raw
}

function normalizeFitnessGoals(value: any, fallback?: any) {
  const source = Array.isArray(value) ? value : (fallback ? [fallback] : [])
  const validValues = new Set(FITNESS_GOAL_OPTIONS.map((option) => option.value))
  return Array.from(new Set(
    source
      .map(normalizeFitnessGoal)
      .filter((item) => item && validValues.has(item))
  )).slice(0, 3)
}

function deriveLegacyInterestTags(goals: string[]) {
  const map: Record<string, string> = {
    '\u51cf\u8102': '\u51cf\u8102\u71c3\u8102',
    '\u4f53\u6001\u77eb\u6b63': '\u4f53\u6001\u7ea0\u6b63',
    '\u7075\u6d3b\u67d4\u97e7': '\u7075\u6d3b\u6027',
    '\u529b\u91cf\u63d0\u5347': '\u529b\u91cf\u4e3e',
    '\u4f53\u80fd\u6539\u5584': '\u5fc3\u80ba\u6709\u6c27'
  }
  return goals.map((goal) => map[goal]).filter(Boolean)
}

function isProfileField(field: FieldKey): field is ProfileFieldKey {
  return ['nickname', 'gender', 'height', 'weight', 'fitness_goal', 'fitness_level'].includes(field)
}

function getFieldValue(data: FitnessCardData | null, field: FieldKey) {
  if (!data) return ''
  if (field === 'fitness_goals') {
    return normalizeFitnessGoals(data.answers.fitness_goals, data.profile.fitness_goal)
  }
  if (isProfileField(field)) return data.profile[field]
  return data.answers[field]
}

function formatArrayValue(value: string[]) {
  return value.length ? value.join('\u3001') : text.empty
}

function formatFieldValue(data: FitnessCardData | null, field: FieldKey) {
  if (!data) return text.empty
  const value = getFieldValue(data, field)
  if (field === 'avatar_url') return value ? text.avatarPlaceholder : text.empty
  if (field === 'gender') return findOptionText(GENDER_OPTIONS, String(value || '')) || text.empty
  if (field === 'height') return value ? `${value} cm` : text.empty
  if (field === 'weight') return value ? `${value} kg` : text.empty
  if (field === 'fitness_goals') {
    const list = normalizeFitnessGoals(value, data.profile.fitness_goal)
    return list.length ? list.map((item) => findOptionText(FITNESS_GOAL_OPTIONS, item)).join('\u3001') : text.empty
  }
  if (field === 'fitness_level') return findOptionText(FITNESS_LEVEL_OPTIONS, String(value || '')) || text.empty
  if (field === 'target_body_parts' || field === 'equipment') {
    return formatArrayValue(normalizeStringArray(value))
  }
  if (field === 'weekly_frequency') return value ? (Number(value) >= 6 ? '6 \u5929\u53ca\u4ee5\u4e0a' : `${value} \u5929`) : text.empty
  if (field === 'session_duration') return value ? `${value} \u5206\u949f` : text.empty
  return String(value || '').trim() || text.empty
}

function FitnessCardPage() {
  const { effectiveTheme } = useTheme()
  const [data, setData] = useState<FitnessCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [editingField, setEditingField] = useState<FieldKey | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [draftList, setDraftList] = useState<string[]>([])
  const [pickerVisible, setPickerVisible] = useState(false)
  const [multiVisible, setMultiVisible] = useState(false)

  const fields = useMemo<FieldKey[]>(
    () => [
      'avatar_url',
      'nickname',
      'gender',
      'height',
      'weight',
      'fitness_goals',
      'fitness_level',
      'target_body_parts',
      'weekly_frequency',
      'equipment',
      'session_duration'
    ],
    []
  )

  const loadProfile = async () => {
    const session = authService.getAuthSession({ normalize: true })
    if (!session.isAuthenticated || !session.userId) {
      Taro.redirectTo({
        url: authService.buildLoginUrl('/me/profile/fitness-card/index')
      })
      return
    }

    try {
      setLoading(true)
      const res = await studentService.getStudentProfile(session.userId)
      const answers = (res?.questionnaire?.answers || {}) as QuestionnaireAnswers
      setData({
        profile: (res?.profile || {}) as FitnessProfile,
        answers: {
          flow_version: String(answers.flow_version || 'registration_unified_v2'),
          fitness_goals: normalizeFitnessGoals(answers.fitness_goals, res?.profile?.fitness_goal),
          interest_tags: normalizeStringArray(answers.interest_tags),
          equipment: normalizeStringArray(answers.equipment),
          weekly_frequency: Number(answers.weekly_frequency || 0) || undefined,
          session_duration: Number(answers.session_duration || 30),
          target_body_parts: normalizeStringArray(answers.target_body_parts)
        }
      })
    } catch (error: any) {
      console.error('[fitness-card] load profile failed:', error)
      Taro.showToast({ title: error?.message || text.loadFailed, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  useDidShow(() => {
    void loadProfile()
  })

  const openEditor = (field: FieldKey) => {
    if (field === 'avatar_url') return
    const value = getFieldValue(data, field)
    setEditingField(field)
    setDraftValue(value == null ? '' : String(value))
    setDraftList(normalizeStringArray(value))
    if (field === 'gender' || field === 'fitness_goal' || field === 'fitness_level' || field === 'weekly_frequency' || field === 'session_duration') {
      setPickerVisible(true)
    }
    if (field === 'fitness_goals' || field === 'target_body_parts' || field === 'equipment') {
      setMultiVisible(true)
    }
  }

  const closeEditor = () => {
    setEditingField(null)
    setDraftValue('')
    setDraftList([])
    setPickerVisible(false)
    setMultiVisible(false)
  }

  const handleChooseAvatar = async (event: any) => {
    const avatarUrl = String(event?.detail?.avatarUrl || '').trim()
    if (!avatarUrl || !data) return

    try {
      setAvatarUploading(true)
      const uploadedUrl = await studentService.uploadAvatar(avatarUrl)
      const updated = await studentService.updateProfile({ avatar_url: uploadedUrl })
      if (!updated) throw new Error(text.avatarFailed)
      setData((prev) => prev ? { ...prev, profile: { ...prev.profile, avatar_url: uploadedUrl } } : prev)
      authService.mergeCurrentUser({ avatar_url: uploadedUrl })
      Taro.showToast({ title: text.saved, icon: 'success' })
    } catch (error: any) {
      console.error('[fitness-card] upload avatar failed:', error)
      Taro.showToast({ title: error?.message || text.avatarFailed, icon: 'none' })
    } finally {
      setAvatarUploading(false)
    }
  }

  const buildNextAnswers = (field: QuestionnaireFieldKey, value: any) => ({
    ...(data?.answers || {}),
    flow_version: 'registration_unified_v2',
    [field]: value
  })

  const saveField = async (value: any = draftValue) => {
    if (!editingField || !data) return

    try {
      setSaving(true)
      if (editingField === 'fitness_goals') {
        const goals = normalizeFitnessGoals(value)
        if (goals.length === 0) {
          throw new Error('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u5065\u8eab\u76ee\u6807')
        }
        const profilePayload = { fitness_goal: goals[0] }
        const updated = await studentService.updateProfile(profilePayload)
        if (!updated) throw new Error(text.saveFailed)

        const nextAnswers = buildNextAnswers(editingField, goals)
        nextAnswers.interest_tags = deriveLegacyInterestTags(goals)
        const saved = await studentService.submitOnboarding({
          answers: nextAnswers,
          baseline_video_urls: []
        })
        if (!saved) throw new Error(text.saveFailed)
        setData((prev) => prev ? { ...prev, profile: { ...prev.profile, ...profilePayload }, answers: nextAnswers } : prev)
      } else if (isProfileField(editingField)) {
        const payload: Record<string, any> = {}
        if (editingField === 'height' || editingField === 'weight') {
          const parsed = Number(value)
          payload[editingField] = Number.isFinite(parsed) && parsed > 0 ? parsed : null
        } else {
          payload[editingField] = String(value || '').trim()
        }

        const updated = await studentService.updateProfile(payload)
        if (!updated) throw new Error(text.saveFailed)

        setData((prev) => prev ? { ...prev, profile: { ...prev.profile, ...payload } } : prev)
        if (editingField === 'nickname') {
          authService.mergeCurrentUser({ nickname: payload.nickname || '' })
        }
      } else {
        const normalizedValue = editingField === 'session_duration'
          ? Number(value || 30)
          : editingField === 'weekly_frequency'
            ? Number(value || 0)
            : normalizeStringArray(value)
        const nextAnswers = buildNextAnswers(editingField, normalizedValue)
        const saved = await studentService.submitOnboarding({
          answers: nextAnswers,
          baseline_video_urls: []
        })
        if (!saved) throw new Error(text.saveFailed)
        setData((prev) => prev ? { ...prev, answers: nextAnswers } : prev)
      }

      Taro.showToast({ title: text.saved, icon: 'success' })
      closeEditor()
    } catch (error: any) {
      console.error('[fitness-card] save field failed:', error)
      Taro.showToast({ title: error?.message || text.saveFailed, icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const toggleDraftItem = (item: string) => {
    setDraftList((prev) => (
      prev.includes(item)
        ? prev.filter((value) => value !== item)
        : editingField === 'fitness_goals' && prev.length >= 3
          ? prev
        : [...prev, item]
    ))
    if (editingField === 'fitness_goals' && !draftList.includes(item) && draftList.length >= 3) {
      Taro.showToast({ title: '\u5065\u8eab\u76ee\u6807\u6700\u591a\u9009\u62e9 3 \u4e2a', icon: 'none' })
    }
  }

  const pickerOptions: OptionItem[] =
    editingField === 'gender'
      ? GENDER_OPTIONS
      : editingField === 'fitness_goal'
        ? FITNESS_GOAL_OPTIONS
        : editingField === 'fitness_level'
          ? FITNESS_LEVEL_OPTIONS
          : editingField === 'weekly_frequency'
            ? WEEKLY_FREQUENCY_OPTIONS.map((option) => ({ text: option >= 6 ? '6 \u5929\u53ca\u4ee5\u4e0a' : `${option} \u5929`, value: String(option) }))
            : DURATION_OPTIONS.map((option) => ({ text: `${option} \u5206\u949f`, value: String(option) }))

  const multiOptions =
    editingField === 'fitness_goals'
      ? FITNESS_GOAL_OPTIONS.map((option) => option.value)
      : editingField === 'target_body_parts'
        ? TARGET_BODY_PART_OPTIONS
        : EQUIPMENT_OPTIONS

  return (
    <ConfigProvider locale={zhCN}>
      <View className='fitness-card-page'>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-inner'>
            <View className='profile-preview'>
              <Text className='preview-title'>{text.title}</Text>
              <Text className='preview-desc'>{text.desc}</Text>
            </View>

            <View className='field-list'>
              {fields.map((field) => {
                const value = formatFieldValue(data, field)
                if (field === 'avatar_url') {
                  return (
                    <View key={field} className='field-row field-row--avatar'>
                      <View className='field-row-main'>
                        <Text className='field-label'>{FIELD_LABELS[field]}</Text>
                        <Text className='field-value'>{avatarUploading ? text.uploading : text.avatarPlaceholder}</Text>
                      </View>
                      <TaroButton
                        className='avatar-button'
                        openType='chooseAvatar'
                        onChooseAvatar={handleChooseAvatar}
                        disabled={avatarUploading || loading}
                      >
                        {data?.profile?.avatar_url ? (
                          <Image className='avatar-image' src={data.profile.avatar_url} mode='aspectFill' />
                        ) : (
                          <View className='avatar-empty'>
                            <Text className='avatar-empty-text'>{FIELD_LABELS.avatar_url}</Text>
                          </View>
                        )}
                      </TaroButton>
                    </View>
                  )
                }
                return (
                  <View key={field} className='field-row' onClick={() => openEditor(field)}>
                    <View className='field-row-main'>
                      <Text className='field-label'>{FIELD_LABELS[field]}</Text>
                      <Text className={`field-value ${value === text.empty ? 'field-value--empty' : ''}`}>
                        {loading ? text.loading : value}
                      </Text>
                    </View>
                    <Text className='field-arrow'>&gt;</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </ScrollView>

        <Dialog
          visible={!!editingField && !pickerVisible && !multiVisible}
          title={editingField ? `${text.edit}${FIELD_LABELS[editingField]}` : ''}
          onClose={closeEditor}
          onCancel={closeEditor}
          onConfirm={() => saveField()}
          closeOnOverlayClick
          confirmText={saving ? text.saving : text.save}
          cancelText={text.cancel}
        >
          <View className='dialog-body'>
            <Input
              type={editingField === 'height' || editingField === 'weight' ? 'digit' : 'text'}
              value={draftValue}
              placeholder={editingField ? `${text.inputPrefix}${FIELD_LABELS[editingField]}` : ''}
              onChange={(value) => setDraftValue(value)}
            />
          </View>
        </Dialog>

        <Popup
          visible={pickerVisible}
          position='bottom'
          onClose={closeEditor}
          className='fitness-picker-popup'
        >
          <Picker
            visible={pickerVisible}
            options={pickerOptions}
            value={draftValue ? [draftValue] : []}
            onConfirm={(_options, values) => {
              void saveField(String(values?.[0] || ''))
            }}
            onCancel={closeEditor}
          />
        </Popup>

        <Dialog
          visible={multiVisible}
          title={editingField ? `${text.edit}${FIELD_LABELS[editingField]}` : ''}
          onClose={closeEditor}
          onCancel={closeEditor}
          onConfirm={() => saveField(draftList)}
          closeOnOverlayClick
          confirmText={saving ? text.saving : text.save}
          cancelText={text.cancel}
        >
          <View className='multi-dialog-body'>
            <Text className='multi-hint'>{text.multiHint}</Text>
            <View className='tag-grid'>
              {multiOptions.map((option) => (
                <View
                  key={option}
                  className={`tag-chip ${draftList.includes(option) ? 'tag-chip--active' : ''}`}
                  onClick={() => toggleDraftItem(option)}
                >
                  <Text className='tag-chip-text'>{option}</Text>
                </View>
              ))}
            </View>
          </View>
        </Dialog>
      </View>
    </ConfigProvider>
  )
}

export default FitnessCardPage
