import { useMemo, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getHuifuRegionCities,
  huifuBankOptions,
  huifuRegionOptions,
} from '../../../../wechat/src/config/huifuAccountOptions'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, shadow, spacing } from '../../theme'
import { Card, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>

type Step = 0 | 1
type CertValidityType = '1' | '0'
type PickerKind = 'bank' | 'province' | 'city'

type FormState = {
  name: string
  certNo: string
  mobileNo: string
  certValidityType: CertValidityType
  certBeginDate: string
  certEndDate: string
  idCardFront: string
  idCardBack: string
  idCardFrontUri: string
  idCardBackUri: string
  cardNo: string
  cardName: string
  bankCode: string
  branchCode: string
  branchName: string
  provId: string
  areaId: string
}

const initialForm: FormState = {
  name: '',
  certNo: '',
  mobileNo: '',
  certValidityType: '1',
  certBeginDate: '',
  certEndDate: '',
  idCardFront: '',
  idCardBack: '',
  idCardFrontUri: '',
  idCardBackUri: '',
  cardNo: '',
  cardName: '',
  bankCode: '',
  branchCode: '',
  branchName: '',
  provId: '',
  areaId: '',
}

function normalizeDate(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 8)
}

function digits(value: string, maxLength?: number) {
  const next = value.replace(/\D/g, '')
  return typeof maxLength === 'number' ? next.slice(0, maxLength) : next
}

export function CoachWalletMerchantScreen() {
  const navigation = useNavigation<Navigation>()
  const [step, setStep] = useState<Step>(0)
  const [form, setForm] = useState<FormState>(initialForm)
  const [picker, setPicker] = useState<PickerKind | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const cityOptions = useMemo(() => getHuifuRegionCities(form.provId), [form.provId])
  const selectedBank = huifuBankOptions.find((option) => option.code === form.bankCode)
  const selectedProvince = huifuRegionOptions.find((option) => option.code === form.provId)
  const selectedCity = cityOptions.find((option) => option.code === form.areaId)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function chooseIdCard(side: 'front' | 'back') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请允许访问相册后再上传证件照片。')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      base64: true,
      quality: 0.7,
    })
    if (result.canceled || !result.assets[0]?.base64) return
    const asset = result.assets[0]
    const base64 = String(asset.base64 || '')
    if (!base64) return
    if (side === 'front') {
      update('idCardFrontUri', asset.uri)
      update('idCardFront', base64)
    } else {
      update('idCardBackUri', asset.uri)
      update('idCardBack', base64)
    }
  }

  function canNext() {
    if (!form.name.trim() || !form.certNo.trim() || !form.mobileNo.trim()) return false
    if (!form.certBeginDate.trim()) return false
    if (form.certValidityType === '0' && !form.certEndDate.trim()) return false
    return Boolean(form.idCardFront && form.idCardBack)
  }

  function canSubmit() {
    return Boolean(
      form.cardNo.trim()
      && form.cardName.trim()
      && form.bankCode.trim()
      && form.branchCode.trim()
      && form.branchName.trim()
      && form.provId.trim()
      && form.areaId.trim(),
    )
  }

  async function submit() {
    if (!canSubmit()) {
      Alert.alert('资料不完整', '请补充银行卡、开户行和地区编码信息。')
      return
    }
    try {
      setSubmitting(true)
      const res = await safeRequest<any>('/api/coach/merchant/open-huifu-account', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          certNo: form.certNo.trim(),
          mobileNo: form.mobileNo.trim(),
          certValidityType: form.certValidityType,
          certBeginDate: normalizeDate(form.certBeginDate),
          certEndDate: form.certValidityType === '1' ? undefined : normalizeDate(form.certEndDate),
          idCardFront: form.idCardFront,
          idCardBack: form.idCardBack,
          cardNo: form.cardNo.trim(),
          cardName: form.cardName.trim(),
          bankCode: form.bankCode.trim(),
          branchCode: form.branchCode.trim(),
          branchName: form.branchName.trim(),
          provId: form.provId.trim(),
          areaId: form.areaId.trim(),
        },
      })
      Alert.alert('提交成功', res?.message || '收款账户资料已提交', [
        { text: '确定', onPress: () => navigation.goBack() },
      ])
    } catch (e) {
      Alert.alert('提交失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenShell title="开通收款账户" subtitle="汇付个人用户开户和业务入驻。" onBack={() => navigation.goBack()}>
      <ScrollView horizontal={false} contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.noticeCard}>
          <IconFont name="icon-goumaijilu" size={28} color={colors.surface} />
          <View style={styles.noticeBody}>
            <Text style={styles.noticeTitle}>汇付收款账户</Text>
            <Text style={styles.noticeDesc}>用于接收教练订阅和内容分账，并提现到本人银行卡。请填写与身份证、银行卡一致的信息。</Text>
          </View>
        </View>

        <View style={styles.stepTabs}>
          <StepTab active={step === 0} done={step > 0} label="1 身份信息" onPress={() => setStep(0)} />
          <View style={[styles.stepLine, step > 0 && styles.stepLineDone]} />
          <StepTab active={step === 1} label="2 提现银行卡" onPress={() => canNext() && setStep(1)} />
        </View>

        {step === 0 ? (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>身份信息</Text>
            <MerchantField label="姓名 *" value={form.name} onChangeText={(value) => update('name', value)} placeholder="与身份证一致" />
            <MerchantField label="身份证号 *" value={form.certNo} onChangeText={(value) => update('certNo', value.slice(0, 18))} placeholder="请输入身份证号" />
            <MerchantField label="手机号 *" value={form.mobileNo} onChangeText={(value) => update('mobileNo', digits(value, 11))} placeholder="银行预留或本人手机号" keyboardType="phone-pad" />

            <View style={styles.field}>
              <Text style={styles.label}>证件有效期类型 *</Text>
              <View style={styles.segmented}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => update('certValidityType', '1')}
                  style={[styles.segment, form.certValidityType === '1' && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, form.certValidityType === '1' && styles.segmentTextActive]}>长期有效</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => update('certValidityType', '0')}
                  style={[styles.segment, form.certValidityType === '0' && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, form.certValidityType === '0' && styles.segmentTextActive]}>非长期</Text>
                </Pressable>
              </View>
            </View>

            <MerchantField label="有效期开始日期 *" value={form.certBeginDate} onChangeText={(value) => update('certBeginDate', normalizeDate(value))} placeholder="例如 20200101" keyboardType="numeric" />
            {form.certValidityType === '0' ? (
              <MerchantField label="有效期截止日期 *" value={form.certEndDate} onChangeText={(value) => update('certEndDate', normalizeDate(value))} placeholder="例如 20400101" keyboardType="numeric" />
            ) : null}

            <View style={styles.photoGrid}>
              <PhotoUploader label="上传人像面" uri={form.idCardFrontUri} onPress={() => void chooseIdCard('front')} />
              <PhotoUploader label="上传国徽面" uri={form.idCardBackUri} onPress={() => void chooseIdCard('back')} />
            </View>

            <SolidButton label="下一步" onPress={() => setStep(1)} disabled={!canNext()} />
          </Card>
        ) : (
          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>提现银行卡</Text>
            <Text style={styles.sectionHint}>个人教练固定绑定本人对私银行卡。支行联行号是具体开户支行的 12 位清算编号。</Text>

            <MerchantField label="银行卡户名 *" value={form.cardName} onChangeText={(value) => update('cardName', value)} placeholder="通常与身份证姓名一致" />
            <MerchantField label="银行卡号 *" value={form.cardNo} onChangeText={(value) => update('cardNo', digits(value))} placeholder="请输入银行卡号" keyboardType="numeric" />
            <PickerField label="开户银行 *" value={selectedBank?.name || '请选择银行卡所属银行'} selected={Boolean(selectedBank)} onPress={() => setPicker('bank')} />
            <CodePreview label="开户银行编码" value={form.bankCode || '选择银行后自动生成'} selected={Boolean(form.bankCode)} />
            <MerchantField label="具体支行联行号 *" value={form.branchCode} onChangeText={(value) => update('branchCode', digits(value, 12))} placeholder="请输入 12 位支行联行号" keyboardType="numeric" />
            <MerchantField label="支行名称 *" value={form.branchName} onChangeText={(value) => update('branchName', value)} placeholder="例如 中国农业银行xx支行" />

            <View style={styles.helpCard}>
              <Text style={styles.helpTitle}>不知道支行联行号怎么找？</Text>
              <Text style={styles.helpText}>优先在银行 App/网银查看开户网点，或拨打银行卡背面的银行客服电话，询问开户支行名称和 12 位支行联行号/CNAPS 号。</Text>
              <Text style={styles.helpText}>银行卡所属银行、开户银行选择、支行联行号必须属于同一家银行。</Text>
            </View>

            <PickerField label="开户省份 *" value={selectedProvince?.name || '请选择开户省份'} selected={Boolean(selectedProvince)} onPress={() => setPicker('province')} />
            <PickerField label="开户城市/区县 *" value={selectedCity?.name || (form.provId ? '请选择开户城市/区县' : '请先选择省份')} selected={Boolean(selectedCity)} onPress={() => form.provId && setPicker('city')} />
            <CodePreview label="地区编码" value={form.provId && form.areaId ? `${form.provId} / ${form.areaId}` : '选择省份和城市/区县后自动生成'} selected={Boolean(form.provId && form.areaId)} />

            <View style={styles.actionRow}>
              <SolidButton label="上一步" variant="secondary" onPress={() => setStep(0)} disabled={submitting} />
              <SolidButton label="提交开通" onPress={submit} loading={submitting} disabled={!canSubmit()} />
            </View>
          </Card>
        )}
      </ScrollView>

      <OptionPicker
        kind={picker}
        cityOptions={cityOptions}
        onClose={() => setPicker(null)}
        onPick={(code) => {
          if (picker === 'bank') update('bankCode', code)
          if (picker === 'province') setForm((prev) => ({ ...prev, provId: code, areaId: '' }))
          if (picker === 'city') update('areaId', code)
          setPicker(null)
        }}
      />
    </ScreenShell>
  )
}

function StepTab({ label, active, done, onPress }: { label: string; active?: boolean; done?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.stepTab, active && styles.stepTabActive, done && styles.stepTabDone]}>
      <Text style={[styles.stepTabText, active && styles.stepTabTextActive, done && styles.stepTabTextDone]}>{label}</Text>
    </Pressable>
  )
}

function MerchantField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  keyboardType?: 'default' | 'numeric' | 'phone-pad'
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} style={styles.input} />
    </View>
  )
}

function PhotoUploader({ label, uri, onPress }: { label: string; uri?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.photoUploader, pressed && styles.pressed]}>
      {uri ? <Image source={{ uri }} style={styles.photoPreview} /> : <Text style={styles.photoPlaceholder}>{label}</Text>}
    </Pressable>
  )
}

function PickerField({ label, value, selected, onPress }: { label: string; value: string; selected: boolean; onPress: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}>
        <Text style={[styles.pickerText, !selected && styles.placeholderText]}>{value}</Text>
        <IconFont name="icon-right-arrow" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

function CodePreview({ label, value, selected }: { label: string; value: string; selected: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.codePreview}>
        <Text style={[styles.codeText, !selected && styles.placeholderText]}>{value}</Text>
      </View>
    </View>
  )
}

function OptionPicker({
  kind,
  cityOptions,
  onPick,
  onClose,
}: {
  kind: PickerKind | null
  cityOptions: Array<{ name: string; code: string }>
  onPick: (code: string) => void
  onClose: () => void
}) {
  const options = kind === 'bank' ? huifuBankOptions : kind === 'province' ? huifuRegionOptions : kind === 'city' ? cityOptions : []
  const title = kind === 'bank' ? '选择开户银行' : kind === 'province' ? '选择开户省份' : '选择开户城市/区县'
  return (
    <Modal animationType="slide" transparent visible={Boolean(kind)} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView horizontal={false} style={styles.optionList}>
            {options.map((option) => (
              <Pressable key={option.code} accessibilityRole="button" onPress={() => onPick(option.code)} style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}>
                <Text style={styles.optionName}>{option.name}</Text>
                <Text style={styles.optionCode}>{option.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  inner: {
    gap: spacing.sm,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    ...shadow,
  },
  noticeBody: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  noticeDesc: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 20,
  },
  stepTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepTab: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  stepTabActive: {
    backgroundColor: colors.brand,
  },
  stepTabDone: {
    backgroundColor: '#E8F6EF',
  },
  stepTabText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
  },
  stepTabTextActive: {
    color: colors.surface,
  },
  stepTabTextDone: {
    color: colors.success,
  },
  stepLine: {
    flex: 1,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  stepLineDone: {
    backgroundColor: colors.success,
  },
  formCard: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.surface,
  },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.brand,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoUploader: {
    flex: 1,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  pickerField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pickerText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  codePreview: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  codeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  helpCard: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#FFF7ED',
  },
  helpTitle: {
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  helpText: {
    color: '#9A3412',
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    gap: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17,24,39,0.35)',
  },
  modalPanel: {
    maxHeight: '72%',
    padding: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
  },
  closeText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
  optionList: {
    maxHeight: 520,
  },
  optionRow: {
    gap: 2,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  optionName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionCode: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.74,
  },
})
