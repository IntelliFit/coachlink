import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { COMPATIBLE_IMAGE_OPTIONS } from '../../imagePickerOptions'
import { inferLocationEquipment, normalizeLocationEquipment, type LocationEquipmentType, type LocationSearchResult, type LocationSelection } from '@coachlink/core'
import { apiClient } from '../../api'
import { uploadFile } from '../../fileUpload'
import { IconFont } from '../../components/IconFont'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import { EquipmentSelector } from './LocationEquipment'
import { LocationMapPickerModal } from './LocationMapPickerModal'
import {
  COUNTRY_OPTIONS,
  EMPTY_LOCATION_FORM,
  MAX_LOCATION_IMAGES,
  applyPlaceSelection,
  buildLocationPayload,
  currentContributorContact,
  formHasPosition,
  formRegionLabel,
  getLocationImages,
  initialEquipment,
  locationFormFromLocation,
  validateLocationForm,
  parseFormPosition,
  type LocationAutoFields,
  type LocationForm,
  type StreetliftingLocation,
  locationDraftSnapshot,
  markLocationsChanged,
} from './locationModel'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const DRAFT_KEY = 'streetlifting_location_draft_v1'

type Draft = { id: string | null; form: LocationForm; imageUrls: string[]; equipment: LocationEquipmentType[]; touched: boolean; autoFilled: LocationAutoFields }

/**
 * 分享 / 编辑单杠点位，对应小程序 locations 页的表单。
 * APP 没有微信地图选点，用地点搜索带回位置和地址；地图用不了时可手动填写。
 * 表单内容实时存草稿：提交失败或被打断后再打开还在，提交成功才清除。
 */
export function StreetliftingLocationFormModal({ visible, editing, onClose, onSaved }: {
  visible: boolean
  editing: StreetliftingLocation | null
  onClose: () => void
  onSaved: (location: StreetliftingLocation) => void
}) {
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : ''
  // 每个点位一份草稿，新增的草稿不会被打开编辑覆盖
  const draftKey = `${DRAFT_KEY}:${userId}:${editing?.id ?? 'new'}`
  const [form, setForm] = useState<LocationForm>(EMPTY_LOCATION_FORM)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [equipment, setEquipment] = useState<LocationEquipmentType[]>([])
  const [overseas, setOverseas] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [coordinatesOpen, setCoordinatesOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [searchMessage, setSearchMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [ready, setReady] = useState(false)
  const equipmentTouchedRef = useRef(false)
  const autoFilledRef = useRef<LocationAutoFields>({})
  const baselineRef = useRef('')
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!visible) {
      setReady(false)
      return
    }
    let alive = true
    async function init() {
      const raw = await AsyncStorage.getItem(draftKey).catch(() => null)
      if (!alive) return
      let draft: Draft | null = null
      try {
        draft = raw ? (JSON.parse(raw) as Draft) : null
      } catch {
        draft = null
      }
      const baseForm = editing ? locationFormFromLocation(editing) : EMPTY_LOCATION_FORM
      const baseImages = editing ? getLocationImages(editing) : []
      const baseEquipment = initialEquipment(editing, baseForm)
      baselineRef.current = locationDraftSnapshot(baseForm, baseImages, baseEquipment.touched, baseEquipment.types)

      const apply = (usable: Draft | null) => {
        if (!alive) return
        const nextForm = usable ? usable.form : baseForm
        setForm(nextForm)
        setImageUrls(usable ? usable.imageUrls || [] : baseImages)
        equipmentTouchedRef.current = usable ? Boolean(usable.touched) : baseEquipment.touched
        setEquipment(usable ? normalizeLocationEquipment(usable.equipment) : baseEquipment.types)
        // 编辑时地址也算「自动带入」：换了位置要跟着换，不能留着旧地址配新坐标。名称不算，那是用户起的
        autoFilledRef.current = usable
          ? usable.autoFilled || {}
          : editing ? { address: baseForm.address, province: baseForm.province, city: baseForm.city, county: baseForm.county } : {}
        // 与小程序一致：不是中国就按海外显示，否则国家为空时必填项是藏起来的
        setOverseas(nextForm.country !== '中国')
        setManualOpen(Boolean(editing) || Boolean(usable && (usable.form.name || usable.form.address || formHasPosition(usable.form))))
        setRegionOpen(false)
        setCoordinatesOpen(false)
        setQuery('')
        setResults([])
        setSearchMessage('')
        setReady(true)
      }

      const usable = draft && draft.id === (editing?.id ?? null) && draft.form ? draft : null
      if (usable && editing) {
        // 点位是共享数据：旧草稿保存时会覆盖所有字段，不能悄悄恢复
        Alert.alert('恢复未保存的修改？', '上次编辑这个点位时有修改没有保存。如果别人之后更新过，恢复并保存会覆盖他们的修改。', [
          { text: '放弃', style: 'cancel', onPress: () => { void AsyncStorage.removeItem(draftKey).catch(() => undefined); apply(null) } },
          { text: '恢复', onPress: () => apply(usable) },
        ], { cancelable: false })
        return
      }
      apply(usable)
    }
    void init()
    return () => {
      alive = false
    }
  }, [draftKey, editing, visible])

  // 名称或描述变化时预选器材，用户动过之后不再覆盖
  useEffect(() => {
    if (ready && !equipmentTouchedRef.current) setEquipment(inferLocationEquipment(form))
  }, [form.description, form.name, ready])

  useEffect(() => {
    if (!visible || !ready || !userId) return
    if (locationDraftSnapshot(form, imageUrls, equipmentTouchedRef.current, equipment) === baselineRef.current) {
      void AsyncStorage.removeItem(draftKey).catch(() => undefined)
      return
    }
    const draft: Draft = { id: editing?.id ?? null, form, imageUrls, equipment, touched: equipmentTouchedRef.current, autoFilled: autoFilledRef.current }
    void AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => undefined)
  }, [draftKey, editing?.id, equipment, form, imageUrls, ready, userId, visible])

  const hasPosition = formHasPosition(form)
  const showDetails = hasPosition || manualOpen
  // 编辑时点取消就是放弃修改；新增的草稿保留，下次还能接着填
  const cancel = () => {
    if (editing) void AsyncStorage.removeItem(draftKey).catch(() => undefined)
    onClose()
  }
  const patch = (next: Partial<LocationForm>) => setForm((current) => ({ ...current, ...next }))

  const changeCountry = (country: string) => {
    // 换国家后原来的位置不再对应（与小程序 changeLocationCountry 一致）
    setForm((current) => (current.country === country ? current : { ...current, country, latitudeText: '', longitudeText: '', coordinate_system: null }))
    if (country === '中国') setOverseas(false)
  }

  async function searchPlaces() {
    const text = query.trim()
    if (!text || searching) return
    setSearching(true)
    setSearchMessage('')
    try {
      const data = await apiClient.request<LocationSearchResult[]>('/api/streetlifting-index/locations/search-places', { method: 'POST', body: { query: text }, timeoutMs: 12000 })
      const rows = Array.isArray(data) ? data : []
      setResults(rows)
      if (rows.length === 0) setSearchMessage('没有找到这个地点，可以换个关键词，或手动填写。')
    } catch (error) {
      setResults([])
      setSearchMessage(error instanceof Error ? error.message : '地点搜索失败，可以手动填写。')
    } finally {
      setSearching(false)
    }
  }

  const formPosition = parseFormPosition(form)
  const pickerInitial = formPosition.latitude !== null && formPosition.longitude !== null
    ? { latitude: formPosition.latitude, longitude: formPosition.longitude, coordinate_system: form.coordinate_system, country: form.country }
    : null

  function selectPlace(place: LocationSelection) {
    const merged = applyPlaceSelection(form, place, autoFilledRef.current)
    autoFilledRef.current = merged.autoFilled
    setForm(merged.form)
    // 地图选点可能不知道国家，这时不动用户已选的状态
    if (place.country) setOverseas(merged.form.country !== '中国')
    setResults([])
    setQuery('')
    setSearchMessage('')
  }

  async function uploadImageAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const selected = assets.slice(0, MAX_LOCATION_IMAGES - imageUrls.length)
    if (!selected.length) return
    setUploading(true)
    try {
      for (const [index, asset] of selected.entries()) {
        if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) throw new Error(`第 ${index + 1} 张图片超过 5MB，请压缩后重试`)
        const { ok, json: payload } = await uploadFile('/api/streetlifting-index/upload-location-image', { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' })
        if (!ok || !payload?.success || !payload?.data?.url) throw new Error(payload?.message || '图片上传失败')
        setImageUrls((current) => [...current, String(payload.data.url)].slice(0, MAX_LOCATION_IMAGES))
      }
    } catch (error) {
      Alert.alert('图片上传失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setUploading(false)
    }
  }

  async function chooseImages() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, ...COMPATIBLE_IMAGE_OPTIONS, allowsMultipleSelection: true, selectionLimit: MAX_LOCATION_IMAGES - imageUrls.length })
    if (!result.canceled) await uploadImageAssets(result.assets)
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('需要相机权限', '请在系统设置中允许 CoachLink 使用相机后重试。')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.82 })
    if (!result.canceled) await uploadImageAssets(result.assets)
  }

  async function submit() {
    const error = validateLocationForm(form)
    if (error) {
      Alert.alert('还差一点', error)
      return
    }
    setSubmitting(true)
    try {
      const fields = buildLocationPayload(form, imageUrls, { types: equipment, touched: equipmentTouchedRef.current })
      const res = editing
        ? await apiClient.request<{ location: StreetliftingLocation }>('/api/streetlifting-index/locations/update', { method: 'POST', body: { id: editing.id, ...fields }, timeoutMs: 12000 })
        : await apiClient.request<{ location: StreetliftingLocation }>('/api/streetlifting-index/locations/create', { method: 'POST', body: { ...fields, user_contact: currentContributorContact(user) }, timeoutMs: 12000 })
      await AsyncStorage.removeItem(draftKey).catch(() => undefined)
      markLocationsChanged()
      Alert.alert(editing ? '保存成功' : '提交成功')
      onSaved(res.location)
    } catch (submitError) {
      // 表单和草稿都还在，修好网络后可以直接再提交
      Alert.alert(editing ? '保存失败' : '提交失败', submitError instanceof Error ? submitError.message : '请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const imageDisabled = uploading || imageUrls.length >= MAX_LOCATION_IMAGES

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cancel}>
      <LocationMapPickerModal
        visible={pickerOpen}
        initial={pickerInitial}
        onClose={() => setPickerOpen(false)}
        onConfirm={(selection) => {
          selectPlace(selection)
          setPickerOpen(false)
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <ScrollView style={styles.card} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{editing ? '编辑单杠位置' : '分享单杠位置'}</Text>
          <Text style={styles.step}>{showDetails ? '核对地址，补充单杠信息' : '先搜索地点，地址自动带回'}</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.body}>{overseas ? '海外地点' : '地点在中国（默认）'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={overseas ? '切回中国' : '海外地点'} onPress={() => { setOverseas(!overseas); changeCountry(overseas ? '中国' : '') }} style={styles.linkButton}>
              <Text style={styles.link}>{overseas ? '切回中国' : '海外地点'}</Text>
            </Pressable>
          </View>
          {overseas ? (
            <View style={styles.field}>
              <Text style={styles.label}>国家 / 地区 *</Text>
              <TextInput accessibilityLabel="国家或地区" value={form.country} maxLength={100} onChangeText={changeCountry} placeholder="例如：日本、英国" placeholderTextColor={colors.textMuted} style={styles.input} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.countryRow}>
                {COUNTRY_OPTIONS.filter((item) => item !== '中国').map((item) => (
                  <Pressable key={item} accessibilityRole="button" accessibilityLabel={item} onPress={() => changeCountry(item)} style={[styles.chip, form.country === item && styles.chipActive]}>
                    <Text style={[styles.chipText, form.country === item && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.selection}>
            <Text style={styles.selectionTitle}>{hasPosition ? '已选位置' : '搜索单杠位置'}</Text>
            <Text style={styles.body}>{hasPosition ? form.address || '位置已记录，未返回详细地址，请在下面补充。' : '不在单杠旁边也能上传：搜索公园、小区或地址，选中后名称和地址会自动带回。'}</Text>
            <View style={styles.searchRow}>
              <TextInput accessibilityLabel="搜索地点" value={query} onChangeText={setQuery} onSubmitEditing={() => void searchPlaces()} returnKeyType="search" placeholder="搜索公园、小区或地址" placeholderTextColor={colors.textMuted} style={[styles.input, styles.flex]} />
              <Pressable accessibilityRole="button" accessibilityLabel="搜索地点" accessibilityState={{ disabled: !query.trim() || searching, busy: searching }} disabled={!query.trim() || searching} onPress={() => void searchPlaces()} style={[styles.searchButton, (!query.trim() || searching) && styles.disabled]}>
                {searching ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.searchButtonText}>搜索</Text>}
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={hasPosition ? '在地图上重新选择位置' : '在地图上选择位置'} onPress={() => setPickerOpen(true)} style={styles.linkButton}>
              <Text style={styles.link}>{hasPosition ? '在地图上重新选择位置' : '在地图上选择位置'}</Text>
            </Pressable>
            {searchMessage ? <Text style={styles.help}>{searchMessage}</Text> : null}
            {results.map((place) => (
              <Pressable key={place.id} accessibilityRole="button" accessibilityLabel={`选择${place.name}`} onPress={() => selectPlace(place)} style={styles.result}>
                <Text style={styles.resultName} numberOfLines={1}>{place.name}</Text>
                <Text style={styles.help} numberOfLines={2}>{place.address || [place.country, place.province, place.city].filter(Boolean).join(' · ')}</Text>
              </Pressable>
            ))}
            {hasPosition ? <Text style={styles.help}>请核对下面的名称和地址是否就是单杠所在处；位置不对就重新搜索，文字不准确直接修改。</Text> : null}
            {!showDetails ? (
              <Pressable accessibilityRole="button" accessibilityLabel="手动填写" onPress={() => setManualOpen(true)} style={styles.linkButton}>
                <Text style={styles.link}>搜索不到？手动填写</Text>
              </Pressable>
            ) : null}
            {manualOpen && !hasPosition ? <Text style={styles.help}>可以先保存文字信息。没有位置时只在列表显示，暂不能导航。</Text> : null}
          </View>

          {showDetails ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>单杠名称 *</Text>
                <TextInput accessibilityLabel="单杠名称" value={form.name} onChangeText={(name) => patch({ name })} placeholder="例如：学知园北门单杠" placeholderTextColor={colors.textMuted} style={styles.input} />
              </View>
              <View style={styles.rowBetween}>
                <Text style={[styles.body, styles.flex]} numberOfLines={2}>{formRegionLabel(form) || '未填写地区'}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={regionOpen ? '收起地区' : '修改地区'} onPress={() => setRegionOpen(!regionOpen)} style={styles.linkButton}>
                  <Text style={styles.link}>{regionOpen ? '收起地区' : '修改地区'}</Text>
                </Pressable>
              </View>
              {regionOpen ? (
                <>
                  <Field label={overseas ? '省 / 州（选填）' : '省 / 直辖市（选填）'} value={form.province} placeholder="例如：北京市" onChange={(province) => patch({ province })} />
                  <Field label="城市（选填）" value={form.city} placeholder="例如：北京市" onChange={(city) => patch({ city })} />
                  <Field label="区县（选填）" value={form.county} placeholder="例如：海淀区" onChange={(county) => patch({ county })} />
                </>
              ) : null}
              <View style={styles.field}>
                <Text style={styles.label}>这里有哪些器材？（可多选）</Text>
                <EquipmentSelector value={equipment} onChange={(value) => { equipmentTouchedRef.current = true; setEquipment(value) }} />
                <Text style={styles.help}>{!equipmentTouchedRef.current && equipment.length ? '已根据名称或描述预选，请按现场情况核对' : '按现场情况选择；未填写也可以分享'}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>地点地址（可修改，未获取时补充）</Text>
                <TextInput accessibilityLabel="地点地址" value={form.address} maxLength={500} multiline onChangeText={(address) => patch({ address })} placeholder="例如：北京市海淀区海淀路46号附近" placeholderTextColor={colors.textMuted} style={[styles.input, styles.multiline]} />
              </View>
              <Field label="补充说明（选填）" value={form.description} placeholder="例如：北门进入后右转，篮球场旁边" onChange={(description) => patch({ description })} />
              <Pressable accessibilityRole="button" accessibilityLabel={coordinatesOpen ? '收起经纬度' : '手动填写经纬度'} onPress={() => setCoordinatesOpen(!coordinatesOpen)} style={styles.linkButton}>
                <Text style={styles.link}>{coordinatesOpen ? '收起经纬度' : '手动填写经纬度（可选）'}</Text>
              </Pressable>
              {coordinatesOpen ? (
                <View style={styles.searchRow}>
                  {/* 手填的坐标来源未知，不标坐标系（coordinate_system = null） */}
                  <TextInput accessibilityLabel="纬度" value={form.latitudeText} keyboardType="numbers-and-punctuation" onChangeText={(latitudeText) => patch({ latitudeText, coordinate_system: null })} placeholder="纬度" placeholderTextColor={colors.textMuted} style={[styles.input, styles.flex]} />
                  <TextInput accessibilityLabel="经度" value={form.longitudeText} keyboardType="numbers-and-punctuation" onChangeText={(longitudeText) => patch({ longitudeText, coordinate_system: null })} placeholder="经度" placeholderTextColor={colors.textMuted} style={[styles.input, styles.flex]} />
                </View>
              ) : null}
              <View style={styles.field}>
                <Text style={styles.label}>图片（最多 {MAX_LOCATION_IMAGES} 张，单张不超过 5MB）</Text>
                {imageUrls.length > 0 ? (
                  <View style={styles.photoGrid}>
                    {imageUrls.map((url, index) => (
                      <View key={url} style={styles.photoWrap}>
                        <Image source={{ uri: url }} style={styles.photo} accessibilityIgnoresInvertColors />
                        <Pressable accessibilityRole="button" accessibilityLabel={`删除第 ${index + 1} 张图片`} hitSlop={10} onPress={() => setImageUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.photoRemove}>
                          <Text style={styles.photoRemoveText}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="相册选择" accessibilityState={{ disabled: imageDisabled }} disabled={imageDisabled} onPress={() => void chooseImages()} style={[styles.photoButton, imageDisabled && styles.disabled]}>
                    <IconFont name="icon-picture" color={colors.brand} size={17} />
                    <Text style={styles.photoButtonText}>相册选择</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="现场拍照" accessibilityState={{ disabled: imageDisabled }} disabled={imageDisabled} onPress={() => void takePhoto()} style={[styles.photoButton, imageDisabled && styles.disabled]}>
                    <IconFont name="icon-kaiji" color={colors.brand} size={17} />
                    <Text style={styles.photoButtonText}>现场拍照</Text>
                  </Pressable>
                </View>
                {uploading ? <Text style={styles.help}>图片上传中，请稍候…</Text> : null}
              </View>
            </>
          ) : null}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="取消" disabled={submitting} onPress={cancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>取消</Text>
            </Pressable>
            {showDetails ? (
              <Pressable accessibilityRole="button" accessibilityLabel={editing ? '保存修改' : '分享单杠'} accessibilityState={{ disabled: submitting || uploading, busy: submitting }} disabled={submitting || uploading} onPress={() => void submit()} style={[styles.primaryButton, (submitting || uploading) && styles.disabled]}>
                <Text style={styles.primaryButtonText}>{submitting ? '保存中…' : uploading ? '等待图片上传' : editing ? '保存修改' : '分享单杠'}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={styles.input} />
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
  card: { maxHeight: '92%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  content: { gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  step: { color: colors.textSecondary, fontSize: 13 },
  flex: { flex: 1 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  help: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  field: { gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  linkButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  multiline: { minHeight: 72, paddingVertical: spacing.xs, textAlignVertical: 'top' },
  countryRow: { gap: spacing.xs },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.selectedText },
  selection: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  searchButton: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  result: { minHeight: 48, gap: 2, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  resultName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photoWrap: { width: 72, height: 72 },
  photo: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  photoRemove: { position: 'absolute', top: -8, right: -8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.text },
  photoRemoveText: { color: '#FFFFFF', fontSize: 16, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  photoButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  photoButtonText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  primaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
})
