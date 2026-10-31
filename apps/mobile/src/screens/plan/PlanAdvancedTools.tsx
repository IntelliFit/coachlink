import { useMemo, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { COMPATIBLE_IMAGE_OPTIONS } from '../../imagePickerOptions'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { uploadFile } from '../../fileUpload'
import { SolidButton } from '../me/MeShared'
import { PlanActionPicker } from './PlanActionPicker'
import { applyAppendAction, applyDeleteAction, applyReplaceAction, getActionIdFromSet, normalizeItemType, normalizePlanDays } from './model/planEditor'
import { planImportFileError, planImportMimeType } from './model/planImportFile'
import { formatPlanToScript, getPlanScriptErrorMessage, parsePlanScript } from './model/planScript'
import type { PlanActionOption, PlanItemType, PlanTrainingDay } from './model/planTypes'

type BatchMode = 'replace' | 'delete' | 'append'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** 计划里已用到的动作（批量替换 / 删除的来源），与小程序 PlanEditorWorkbench usedActions 一致。 */
export function collectUsedActions(days: PlanTrainingDay[], actions: PlanActionOption[]) {
  const map = new Map<string, PlanActionOption>()
  const add = (set: any) => {
    const action = actions.find((item) => String(item.id) === String(getActionIdFromSet(set) || ''))
    if (action) map.set(String(action.id), action)
  }
  days.forEach((day) => {
    ;(day.actionSets || []).forEach((set: any) => {
      if (set.type === 'one-filter' && Array.isArray(set.actions)) set.actions.forEach(add)
      else add(set)
    })
  })
  return Array.from(map.values())
}

/** 脚本模式和批量操作，对应小程序 PlanEditorWorkbench 同名入口。改动只进编辑器，仍需保存。 */
export function PlanAdvancedTools({ days, description, actions, onApply }: {
  days: PlanTrainingDay[]
  description: string
  actions: PlanActionOption[]
  onApply: (next: { days: PlanTrainingDay[]; description?: string }) => void
}) {
  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [scriptError, setScriptError] = useState('')
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchMode, setBatchMode] = useState<BatchMode>('replace')
  const [fromActionId, setFromActionId] = useState('')
  const [toAction, setToAction] = useState<PlanActionOption | null>(null)
  const [appendAction, setAppendAction] = useState<PlanActionOption | null>(null)
  const [pickerFor, setPickerFor] = useState<'to' | 'append' | null>(null)
  const [weekStart, setWeekStart] = useState('1')
  const [weekEnd, setWeekEnd] = useState('1')
  const [weekdays, setWeekdays] = useState<number[]>(WEEKDAYS)

  const usedActions = useMemo(() => collectUsedActions(days, actions), [actions, days])
  const fromAction = usedActions.find((action) => String(action.id) === fromActionId)
  // 替换成同类型的动作；追加默认力量（与小程序动作列表一致的筛选由选择器负责）
  const toItemType: PlanItemType = normalizeItemType(fromAction?.type)

  function openScript() {
    try {
      setScriptText(formatPlanToScript({ description, days, actions }))
      setScriptError('')
      setScriptOpen(true)
    } catch (error) {
      Alert.alert('脚本生成失败', getPlanScriptErrorMessage(error))
    }
  }

  function applyScript() {
    if (!scriptText.trim()) {
      setScriptError('请输入计划脚本')
      return
    }
    try {
      const result = parsePlanScript({ script: scriptText, actions })
      if (!result.days.length) {
        setScriptError('脚本里没有解析出训练日')
        return
      }
      onApply({ days: normalizePlanDays(result.days), ...(result.description !== null ? { description: result.description } : {}) })
      setScriptOpen(false)
      Alert.alert('已应用脚本', '请检查后保存。')
    } catch (error) {
      setScriptError(getPlanScriptErrorMessage(error))
    }
  }

  function applyBatch() {
    let result: { days: PlanTrainingDay[]; affectedSets: number } | null = null
    if (batchMode === 'replace') {
      if (!fromActionId || !toAction) {
        Alert.alert('请选择替换动作')
        return
      }
      result = applyReplaceAction(days, fromActionId, toAction)
    } else if (batchMode === 'delete') {
      if (!fromActionId) {
        Alert.alert('请选择要删除的动作')
        return
      }
      result = applyDeleteAction(days, fromActionId)
    } else {
      if (!appendAction) {
        Alert.alert('请选择要追加的动作')
        return
      }
      const start = Math.max(1, Math.floor(Number(weekStart) || 1))
      result = applyAppendAction(days, appendAction, start, Math.max(start, Math.floor(Number(weekEnd) || start)), weekdays.length > 0 ? weekdays : WEEKDAYS)
    }
    if (!result || result.affectedSets <= 0) {
      Alert.alert('没有匹配到可处理内容')
      return
    }
    onApply({ days: result.days })
    setBatchOpen(false)
    Alert.alert(`已处理 ${result.affectedSets} 项`, '请检查后保存。')
  }

  return (
    <View style={styles.row}>
      <SolidButton label="脚本模式" variant="secondary" onPress={openScript} />
      <SolidButton label="批量操作" variant="secondary" onPress={() => setBatchOpen(true)} />

      <Modal visible={scriptOpen} transparent animationType="slide" onRequestClose={() => setScriptOpen(false)}>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>计划脚本</Text>
            <Text style={styles.hint}>支持 W1、D1、D2 off、动作 4x8 @9rm r180 #备注。应用后回写到当前编辑器，仍需保存。</Text>
            <TextInput
              accessibilityLabel="计划脚本"
              value={scriptText}
              onChangeText={(value) => { setScriptText(value); if (scriptError) setScriptError('') }}
              multiline
              maxLength={20000}
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
              placeholder={'W1\nD1\n深蹲 5x5 @8rm r180\nD2 off #主动恢复'}
              placeholderTextColor={colors.textMuted}
              style={styles.script}
            />
            {scriptError ? <Text style={styles.error}>{scriptError}</Text> : null}
            <View style={styles.row}>
              <SolidButton label="取消" variant="secondary" onPress={() => setScriptOpen(false)} />
              <SolidButton label="应用脚本" onPress={applyScript} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={batchOpen} transparent animationType="slide" onRequestClose={() => setBatchOpen(false)}>
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>批量操作</Text>
            <Text style={styles.label}>操作类型</Text>
            <View style={styles.chips}>
              {([['replace', '替换动作'], ['delete', '删除动作'], ['append', '批量追加']] as const).map(([value, label]) => (
                <Chip key={value} label={label} active={batchMode === value} onPress={() => setBatchMode(value)} />
              ))}
            </View>

            {batchMode !== 'append' ? (
              <>
                <Text style={styles.label}>{batchMode === 'replace' ? '原动作' : '要删除的动作'}</Text>
                {usedActions.length === 0 ? <Text style={styles.hint}>当前计划中还没有可批量处理的动作</Text> : null}
                <View style={styles.chips}>
                  {usedActions.map((action) => (
                    <Chip key={String(action.id)} label={action.name} active={fromActionId === String(action.id)} onPress={() => setFromActionId(String(action.id))} />
                  ))}
                </View>
              </>
            ) : null}

            {batchMode === 'replace' ? (
              <>
                <Text style={styles.label}>替换成</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="选择替换成的动作" disabled={!fromAction} onPress={() => setPickerFor('to')} style={[styles.pickerRow, !fromAction && styles.disabled]}>
                  <Text style={styles.pickerText}>{toAction?.name || (fromAction ? '请选择动作' : '先选原动作')}</Text>
                </Pressable>
              </>
            ) : null}

            {batchMode === 'append' ? (
              <>
                <Text style={styles.label}>追加动作</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="选择要追加的动作" onPress={() => setPickerFor('append')} style={styles.pickerRow}>
                  <Text style={styles.pickerText}>{appendAction?.name || '请选择动作'}</Text>
                </Pressable>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>起始周</Text>
                    <TextInput accessibilityLabel="起始周" value={weekStart} onChangeText={setWeekStart} keyboardType="number-pad" style={styles.input} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.label}>结束周</Text>
                    <TextInput accessibilityLabel="结束周" value={weekEnd} onChangeText={setWeekEnd} keyboardType="number-pad" style={styles.input} />
                  </View>
                </View>
                <Text style={styles.label}>每周第几天</Text>
                <View style={styles.chips}>
                  {WEEKDAYS.map((day) => (
                    <Chip key={day} label={`第 ${day} 天`} active={weekdays.includes(day)} onPress={() => setWeekdays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b)))} />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.row}>
              <SolidButton label="取消" variant="secondary" onPress={() => setBatchOpen(false)} />
              <SolidButton label="确认处理" onPress={applyBatch} />
            </View>
          </ScrollView>
        </View>
        <PlanActionPicker
          visible={pickerFor !== null}
          itemType={pickerFor === 'to' ? toItemType : 'STRENGTH'}
          actions={actions}
          onClose={() => setPickerFor(null)}
          onSelect={(action) => {
            if (pickerFor === 'to') setToAction(action)
            else setAppendAction(action)
            setPickerFor(null)
          }}
        />
      </Modal>
    </View>
  )
}

/**
 * 上传计划图片或文件，提取文字后填回文本框供核对（小程序 PlanEditorWorkbench uploadImportFile）。
 * 文件支持 txt / csv / md / Word / Excel / PDF，规则见 planImportFile.ts。
 */
export function PlanImportButtons({ onText }: { onText: (text: string) => void }) {
  const [uploading, setUploading] = useState(false)

  async function chooseImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, ...COMPATIBLE_IMAGE_OPTIONS })
    if (result.canceled || !result.assets[0]?.uri) return
    const asset = result.assets[0]
    await upload({ uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' })
  }

  async function chooseFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true })
      if (result.canceled || !result.assets?.[0]?.uri) return
      const asset = result.assets[0]
      const fileError = planImportFileError(asset.name, asset.size)
      if (fileError) {
        Alert.alert('不能导入这个文件', fileError)
        return
      }
      await upload({ uri: asset.uri, mimeType: planImportMimeType(asset.name, asset.mimeType) })
    } catch (error) {
      Alert.alert('选择文件失败', error instanceof Error ? error.message : '请稍后重试')
    }
  }

  async function upload(file: { uri: string; mimeType: string }) {
    setUploading(true)
    try {
      const { ok, json } = await uploadFile('/api/plan-lib/extract-file-text', file, { timeoutMs: 120_000 })
      if (!ok || !json?.success || !json?.data?.text) throw new Error(json?.message || '文件提取失败')
      onText(String(json.data.text))
      Alert.alert('已提取文字', '请核对关键数字后再解析。')
    } catch (error) {
      Alert.alert('提取文字失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.row}>
      <View style={styles.flex}><SolidButton label="上传计划图片" variant="secondary" loading={uploading} onPress={() => void chooseImage()} /></View>
      <View style={styles.flex}><SolidButton label="选择计划文件" variant="secondary" disabled={uploading} onPress={() => void chooseFile()} /></View>
    </View>
  )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  sheetBody: { gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },
  script: { minHeight: 280, padding: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 13, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  pickerRow: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pickerText: { color: colors.text, fontSize: 14 },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  disabled: { opacity: 0.5 },
})
