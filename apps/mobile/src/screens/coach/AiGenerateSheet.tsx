import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'
import { aiStartHint, parseAiGenerationConfig, type AiGenerationConfig } from './aiGenerateConfig'

/** AI 生成配置弹层，对应小程序 coach/students 的「AI 生成配置 / 批量 AI 生成配置」。 */
export function AiGenerateSheet(props: {
  visible: boolean
  title: string
  subtitle: string
  busy: boolean
  onClose: () => void
  onConfirm: (config: AiGenerationConfig) => void
}) {
  const [week, setWeek] = useState('1')
  const [day, setDay] = useState('1')
  const [useLLM, setUseLLM] = useState(false)

  useEffect(() => {
    if (!props.visible) return
    setWeek('1')
    setDay('1')
    setUseLLM(false)
  }, [props.visible])

  const config = parseAiGenerationConfig(week, day, useLLM)
  const hint = aiStartHint(config)
  const close = () => { if (!props.busy) props.onClose() }

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭" style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.subtitle}>{props.subtitle}</Text>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>起始周</Text>
            <TextInput accessibilityLabel="起始周" value={week} onChangeText={setWeek} keyboardType="number-pad" style={styles.input} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>起始天</Text>
            <TextInput accessibilityLabel="起始天" value={day} onChangeText={setDay} keyboardType="number-pad" style={styles.input} />
          </View>
        </View>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: useLLM }} accessibilityLabel="启用 LLM 深度个性化" onPress={() => setUseLLM((current) => !current)} style={[styles.toggle, useLLM && styles.toggleActive]}>
          <View style={[styles.dot, useLLM && styles.dotActive]} />
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>启用 LLM 深度个性化</Text>
            <Text style={styles.toggleDesc}>开启后会让大模型分析学员问卷、档案和 PR 记录，先选参考骨架，再用脚本模式生成更个性化的计划。</Text>
          </View>
        </Pressable>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消" disabled={props.busy} onPress={close} style={[styles.button, styles.secondary]}>
            <Text style={styles.secondaryText}>取消</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="开始生成" accessibilityState={{ busy: props.busy, disabled: props.busy }} disabled={props.busy} onPress={() => props.onConfirm(config)} style={[styles.button, styles.primary, props.busy && styles.disabled]}>
            {props.busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>开始生成</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)' },
  sheet: { gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1, gap: spacing.xs },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.lg, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  hint: { padding: spacing.sm, borderRadius: radius.md, color: colors.brandDark, backgroundColor: colors.brandSoft, fontSize: 12, lineHeight: 18 },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  dot: { width: 24, height: 24, marginTop: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  dotActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  toggleCopy: { flex: 1, gap: 4 },
  toggleTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  toggleDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  primary: { backgroundColor: colors.brand },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
