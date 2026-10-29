import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { fetchWithTimeout, getStoredToken, persistSession } from '../../api'
import { API_BASE_URL } from '../../config'
import { useAuth } from '../../providers/AuthProvider'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { Card, FormField, InlineAvatar, ScreenShell, SolidButton, errorMessage, safeRequest, type RootNav } from '../me/MeShared'
import {
  BODY_PART_OPTIONS,
  DEFAULT_ONBOARDING_FORM,
  DURATION_OPTIONS,
  EQUIPMENT_OPTIONS,
  FITNESS_GOAL_OPTIONS,
  FITNESS_LEVEL_OPTIONS,
  GENDER_OPTIONS,
  ONBOARDING_STEPS,
  WEEKLY_FREQUENCY_OPTIONS,
  buildOnboardingPayloads,
  toggleGoal,
  validateOnboardingStep,
  type OnboardingForm,
} from './onboardingModel'

/** 新用户引导（5 步），对应小程序 auth/student-onboarding。可中途「先这样」，已填部分保存，其余稍后在资料里补。 */
export function StudentOnboardingScreen() {
  const navigation = useNavigation<RootNav>()
  const { user, setLocalUser } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<OnboardingForm>({ ...DEFAULT_ONBOARDING_FORM, nickname: String(user?.nickname || ''), avatarUrl: String(user?.avatar_url || '') })
  const [heightText, setHeightText] = useState(String(DEFAULT_ONBOARDING_FORM.height))
  const [weightText, setWeightText] = useState(String(DEFAULT_ONBOARDING_FORM.weight))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 已有资料时预填（例如之前跳过过一部分）
  useEffect(() => {
    if (!user?.id) return
    safeRequest<{ profile?: Record<string, any> | null }>('/api/user/get-student-profile', { body: { userId: user.id } })
      .then((data) => {
        const profile = data?.profile
        if (!profile) return
        setForm((current) => ({
          ...current,
          nickname: profile.nickname || current.nickname,
          avatarUrl: profile.avatar_url || current.avatarUrl,
          gender: profile.gender || current.gender,
          height: Number(profile.height) || current.height,
          weight: Number(profile.weight) || current.weight,
          fitnessLevel: profile.fitness_level || current.fitnessLevel,
          fitnessGoals: profile.fitness_goal ? [String(profile.fitness_goal)] : current.fitnessGoals,
        }))
        if (Number(profile.height)) setHeightText(String(profile.height))
        if (Number(profile.weight)) setWeightText(String(profile.weight))
      })
      .catch(() => undefined)
  }, [user?.id])

  const patch = (next: Partial<OnboardingForm>) => setForm((current) => ({ ...current, ...next }))
  const toggleList = (key: 'equipments' | 'targetBodyParts', value: string) => {
    setForm((current) => {
      const list = current[key]
      return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] }
    })
  }

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
      patch({ avatarUrl: json.data.url })
    } catch (error) {
      Alert.alert('头像上传失败', errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  async function submit(complete: boolean) {
    const firstError = validateOnboardingStep(1, form) || (complete ? validateOnboardingStep(step, form) : null)
    if (firstError) {
      Alert.alert('还差一点', firstError)
      if (validateOnboardingStep(1, form)) setStep(1)
      return
    }
    setSaving(true)
    try {
      const { profile, questionnaire } = buildOnboardingPayloads(form, step, complete)
      await safeRequest('/api/user/update-profile', { body: profile })
      let questionnaireSaved = true
      if (questionnaire) {
        questionnaireSaved = await safeRequest('/api/user/submit-onboarding', { body: questionnaire }).then(() => true, () => false)
      }
      const nextUser = { ...(user || {}), nickname: form.nickname.trim(), avatar_url: form.avatarUrl || null }
      const token = await getStoredToken()
      if (user?.id && token) await persistSession({ user: nextUser as any, token })
      setLocalUser(nextUser as any)
      Alert.alert(
        complete && questionnaireSaved ? '档案已完善' : '基础信息已保存',
        complete && questionnaireSaved ? '接下来可以开始训练了。' : '其余资料可以稍后在「我的」里补充。',
        [{ text: '好的', onPress: () => navigation.goBack() }],
      )
    } catch (error) {
      Alert.alert('保存失败', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function next() {
    const error = validateOnboardingStep(step, form)
    if (error) {
      Alert.alert('还差一点', error)
      return
    }
    if (step < ONBOARDING_STEPS.length) setStep(step + 1)
    else void submit(true)
  }

  const meta = ONBOARDING_STEPS[step - 1]

  return (
    <ScreenShell title="完善训练档案" onBack={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}>
      <View style={styles.progressHeader}>
        <Text style={styles.stepIndicator}>第 {step} 步 / 共 {ONBOARDING_STEPS.length} 步</Text>
        <Text style={styles.stepTitle}>{meta.title}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / ONBOARDING_STEPS.length) * 100}%` }]} />
      </View>
      <Text style={styles.desc}>{meta.desc}</Text>

      <Card>
        {step === 1 ? (
          <>
            <Pressable accessibilityRole="button" accessibilityLabel="上传头像" disabled={uploading} onPress={() => void uploadAvatar()} style={styles.avatarRow}>
              <InlineAvatar uri={form.avatarUrl || undefined} label={form.nickname || user?.phone} size={80} />
              <Text style={styles.link}>{uploading ? '上传中…' : '上传头像（可选）'}</Text>
            </Pressable>
            <FormField label="昵称" value={form.nickname} onChangeText={(nickname) => patch({ nickname })} placeholder="最多 24 个字" />
            <Choices label="性别" options={GENDER_OPTIONS} selected={[form.gender]} onPress={(gender) => patch({ gender })} />
          </>
        ) : null}

        {step === 2 ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <FormField label="身高 cm" value={heightText} keyboardType="numeric" onChangeText={(text) => { setHeightText(text); patch({ height: Number(text) || 0 }) }} />
            </View>
            <View style={styles.flex}>
              <FormField label="体重 kg" value={weightText} keyboardType="numeric" onChangeText={(text) => { const normalized = text.replace(',', '.'); setWeightText(normalized); patch({ weight: Number(normalized) || 0 }) }} />
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <>
            <Choices
              label="健身目标（最多 3 个，第一个是主目标）"
              options={FITNESS_GOAL_OPTIONS}
              selected={form.fitnessGoals}
              onPress={(value) => {
                const result = toggleGoal(form.fitnessGoals, value)
                if (result.error) Alert.alert('提示', result.error)
                else patch({ fitnessGoals: result.goals })
              }}
            />
            <Choices label="训练水平" options={FITNESS_LEVEL_OPTIONS} selected={[form.fitnessLevel]} onPress={(fitnessLevel) => patch({ fitnessLevel })} />
          </>
        ) : null}

        {step === 4 ? (
          <Choices label="重点部位（可多选，可跳过）" options={BODY_PART_OPTIONS.map((value) => ({ label: value, value }))} selected={form.targetBodyParts} onPress={(value) => toggleList('targetBodyParts', value)} />
        ) : null}

        {step === 5 ? (
          <>
            <Choices label="每周可训练" options={WEEKLY_FREQUENCY_OPTIONS.map((value) => ({ label: `${value} 次`, value: String(value) }))} selected={[String(form.weeklyFrequency || '')]} onPress={(value) => patch({ weeklyFrequency: Number(value) })} />
            <Choices label="单次训练时长" options={DURATION_OPTIONS.map((value) => ({ label: `${value} 分钟`, value: String(value) }))} selected={[String(form.sessionDuration)]} onPress={(value) => patch({ sessionDuration: Number(value) })} />
            <Choices label="可用器械（可多选）" options={EQUIPMENT_OPTIONS.map((value) => ({ label: value, value }))} selected={form.equipments} onPress={(value) => toggleList('equipments', value)} />
          </>
        ) : null}
      </Card>

      <SolidButton label={step < ONBOARDING_STEPS.length ? '下一步' : '完成'} loading={saving} onPress={next} />
      {step > 1 ? <SolidButton label="先这样，其余稍后补充" variant="secondary" disabled={saving} onPress={() => void submit(false)} /> : null}
    </ScreenShell>
  )
}

function Choices({ label, options, selected, onPress }: { label: string; options: Array<{ label: string; value: string; desc?: string }>; selected: string[]; onPress: (value: string) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option.value)
          return (
            <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityHint={option.desc} onPress={() => onPress(option.value)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  progressHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stepIndicator: { color: colors.textTertiary, ...typography.meta },
  stepTitle: { color: colors.text, ...typography.card },
  progressTrack: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.brand },
  desc: { color: colors.textSecondary, ...typography.meta },
  avatarRow: { alignItems: 'center', gap: spacing.xs },
  link: { color: colors.link, ...typography.meta, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
  group: { gap: spacing.xs },
  groupLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
})
