import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, FormField, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type PricingTier = 'basic' | 'standard' | 'vip'
type ProductType = 'single' | 'combo'

type DurationOption = {
  months: number
  price: number
}

type Product = {
  id: string
  tier: PricingTier
  type: ProductType
  name: string
  description?: string
  included_products?: string[]
  duration_options: DurationOption[]
}

const TIER_OPTIONS: Array<{ label: string; value: PricingTier; color: string }> = [
  { label: '特惠基础版', value: 'basic', color: '#3B82F6' },
  { label: '专业指导版', value: 'standard', color: '#10B981' },
  { label: '全能指导版', value: 'vip', color: '#8B5CF6' },
]

const TYPE_OPTIONS: Array<{ label: string; value: ProductType }> = [
  { label: '单项目', value: 'single' },
  { label: '组合套餐', value: 'combo' },
]

const EMPTY_PRODUCT: Product = {
  id: '',
  tier: 'basic',
  type: 'single',
  name: '',
  description: '',
  included_products: [],
  duration_options: [{ months: 1, price: 0 }],
}

function tierConfig(tier: string) {
  return TIER_OPTIONS.find((item) => item.value === tier) || TIER_OPTIONS[0]
}

function priceYuan(value?: number) {
  return (Number(value || 0) / 100).toFixed(2)
}

function parseItems(text: string) {
  return text.split(/[,\n，、]/).map((item) => item.trim()).filter(Boolean)
}

function normalizeProduct(raw: any): Product {
  return {
    id: raw?.id || `prod_${Date.now()}`,
    tier: raw?.tier || 'basic',
    type: raw?.type || 'single',
    name: raw?.name || '',
    description: raw?.description || '',
    included_products: Array.isArray(raw?.included_products) ? raw.included_products : [],
    duration_options: Array.isArray(raw?.duration_options) && raw.duration_options.length > 0
      ? raw.duration_options.map((item: any) => ({
        months: Math.max(1, Math.floor(Number(item?.months || 1))),
        price: Math.max(0, Math.floor(Number(item?.price || 0))),
      }))
      : [{ months: 1, price: 0 }],
  }
}

export function CoachPricingScreen() {
  const navigation = useNavigation<Navigation>()
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [legacyPricings, setLegacyPricings] = useState<any[]>([])
  const [receivingReady, setReceivingReady] = useState(false)
  const [receivingMessage, setReceivingMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const productsByTier = useMemo(() => {
    const grouped: Record<PricingTier, Product[]> = { basic: [], standard: [], vip: [] }
    products.forEach((item) => grouped[item.tier]?.push(item))
    return grouped
  }, [products])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [coachRes, pricingRes] = await Promise.all([
        safeRequest<any>('/api/coach/get-coach', { body: { userId: user?.id } }),
        safeRequest<any>('/api/coach/get-pricing', { body: { userId: user?.id } }),
      ])
      const coach = coachRes?.coach || {}
      setReceivingReady(coach.huifu_open_status === 'opened' && Boolean(coach.huifu_card_token))
      setReceivingMessage(coach.huifu_open_msg || null)
      setProducts(Array.isArray(pricingRes?.products) ? pricingRes.products.map(normalizeProduct) : [])
      setLegacyPricings(Array.isArray(pricingRes?.pricings) ? pricingRes.pricings : [])
    } catch (e) {
      setProducts([])
      setLegacyPricings([])
      setError(e instanceof Error ? e.message : '订阅定价加载失败')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  function ensureReceivingReady() {
    if (receivingReady) return true
    Alert.alert('请先绑定银行卡', receivingMessage || '请先完成收款账户开通和银行卡绑定；未绑卡前不能新增、编辑或保存订阅套餐价格。')
    return false
  }

  async function saveProducts(nextProducts: Product[]) {
    await safeRequest('/api/coach/update-pricing', { body: { products: nextProducts } })
  }

  async function deleteProduct(product: Product) {
    if (!ensureReceivingReady()) return
    try {
      setDeleting(product.id)
      const nextProducts = products.filter((item) => item.id !== product.id)
      await saveProducts(nextProducts)
      setProducts(nextProducts)
    } catch (e) {
      Alert.alert('删除失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <ScreenShell title="订阅定价" subtitle="配置基础、专业、VIP 服务套餐与时长价格。" onBack={() => navigation.goBack()}>
      <Card style={[styles.receivingCard, receivingReady ? styles.receivingReady : styles.receivingPending]}>
        <View style={styles.receivingTop}>
          <IconFont name={receivingReady ? 'icon-goumaijilu' : 'icon-wenhao'} size={24} color={receivingReady ? '#098B72' : colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.receivingTitle}>{receivingReady ? '收款账户已开通' : '先开通收款账户，学生才能完成付款'}</Text>
            <Text style={styles.receivingDesc}>{receivingReady ? '套餐可正常通过平台收款，收入会按结算规则进入钱包。' : '未绑卡前不能新增、编辑或保存订阅套餐价格。'}</Text>
            {!receivingReady && receivingMessage ? <Text style={styles.receivingMsg}>{receivingMessage}</Text> : null}
          </View>
        </View>
        {!receivingReady ? <SolidButton label="去绑定银行卡" variant="secondary" onPress={() => navigation.navigate('CoachWalletMerchant')} /> : null}
      </Card>

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>订阅方案</Text>
            <Text style={styles.heroDesc}>按小程序结构维护多层级套餐，每个套餐可设置多个时长价格。</Text>
          </View>
          <Pressable disabled={!receivingReady} onPress={() => ensureReceivingReady() && navigation.navigate('CoachPricingEdit', { id: 'new' })} style={[styles.createButton, !receivingReady && styles.disabled]}>
            <Text style={styles.createText}>添加方案</Text>
          </Pressable>
        </View>
      </Card>

      {loading ? <LoadingState title="正在加载定价方案" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-vips" /> : null}
      {!loading && !error && products.length === 0 && legacyPricings.length === 0 ? <EmptyState title="暂无定价方案" desc="先添加一个可以售卖的订阅套餐。" icon="icon-vips" /> : null}

      {!loading && !error ? TIER_OPTIONS.map((tier) => {
        const tierProducts = productsByTier[tier.value]
        if (tierProducts.length === 0) return null
        return (
          <View key={tier.value} style={styles.tierSection}>
            <View style={styles.tierHeader}>
              <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
              <Text style={styles.tierTitle}>{tier.label}</Text>
              <Pressable disabled={!receivingReady} onPress={() => ensureReceivingReady() && navigation.navigate('CoachPricingEdit', { id: 'new', tier: tier.value })} style={[styles.tierAdd, !receivingReady && styles.disabled]}>
                <Text style={styles.tierAddText}>+ 添加</Text>
              </Pressable>
            </View>
            {tierProducts.map((product) => (
              <Card key={product.id} style={styles.productCard}>
                <View style={styles.productHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name || '未命名方案'}</Text>
                    <Text style={styles.productMeta}>{TYPE_OPTIONS.find((item) => item.value === product.type)?.label || '单项目'}</Text>
                  </View>
                </View>
                {product.description ? <Text style={styles.productDesc}>{product.description}</Text> : null}
                <View style={styles.priceRow}>
                  {product.duration_options.map((option, index) => (
                    <Text key={`${product.id}-${index}`} style={styles.priceTag}>{option.months}个月 ¥{priceYuan(option.price)}</Text>
                  ))}
                </View>
                {product.type === 'combo' && product.included_products && product.included_products.length > 0 ? (
                  <Text style={styles.includedText}>包含：{product.included_products.join('、')}</Text>
                ) : null}
                <View style={styles.actionRow}>
                  <SolidButton label="编辑" variant="secondary" onPress={() => ensureReceivingReady() && navigation.navigate('CoachPricingEdit', { id: product.id })} />
                  <SolidButton label={deleting === product.id ? '删除中' : '删除'} variant="danger" disabled={deleting === product.id} onPress={() => Alert.alert('确认删除', '确定要删除这个定价方案吗？', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deleteProduct(product) }])} />
                </View>
              </Card>
            ))}
          </View>
        )
      }) : null}

      {!loading && !error && legacyPricings.length > 0 ? (
        <View style={styles.tierSection}>
          <Text style={styles.tierTitle}>旧版定价（仅查看）</Text>
          {legacyPricings.map((item, index) => (
            <Card key={item.id || item.title || String(index)} style={styles.productCard}>
              <Text style={styles.productName}>{item.title || '旧版定价'}</Text>
              {Array.isArray(item.features) && item.features.length > 0 ? <Text style={styles.productDesc}>{item.features.join('、')}</Text> : null}
              <Text style={styles.priceTag}>¥{Number(item.price || 0).toFixed(2)}</Text>
            </Card>
          ))}
        </View>
      ) : null}
    </ScreenShell>
  )
}

export function CoachPricingEditScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachPricingEdit'>>()
  const { user } = useAuth()
  const productId = route.params?.id
  const isEdit = Boolean(productId && productId !== 'new')
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [receivingReady, setReceivingReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<Product>({ ...EMPTY_PRODUCT, id: productId && productId !== 'new' ? productId : `prod_${Date.now()}`, tier: route.params?.tier || 'basic' })

  const patch = (next: Partial<Product>) => setProduct((prev) => ({ ...prev, ...next }))

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [coachRes, pricingRes] = await Promise.all([
          safeRequest<any>('/api/coach/get-coach', { body: { userId: user?.id } }),
          safeRequest<any>('/api/coach/get-pricing', { body: { userId: user?.id } }),
        ])
        const coach = coachRes?.coach || {}
        setReceivingReady(coach.huifu_open_status === 'opened' && Boolean(coach.huifu_card_token))
        const rows = Array.isArray(pricingRes?.products) ? pricingRes.products.map(normalizeProduct) : []
        setAllProducts(rows)
        if (isEdit) {
          const found = rows.find((item: Product) => item.id === productId)
          if (found) setProduct(found)
          else throw new Error('未找到要编辑的定价方案')
        }
      } catch (e) {
        Alert.alert('加载失败', e instanceof Error ? e.message : '定价方案加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [isEdit, productId, user?.id])

  function updateDuration(index: number, field: 'months' | 'price', value: string) {
    const options = product.duration_options.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      if (field === 'months') return { ...item, months: Math.max(1, Math.floor(Number(value || 1))) }
      return { ...item, price: Math.max(0, Math.round(Number(value || 0) * 100)) }
    })
    patch({ duration_options: options })
  }

  function addDuration() {
    patch({ duration_options: [...product.duration_options, { months: 1, price: 0 }] })
  }

  function removeDuration(index: number) {
    if (product.duration_options.length <= 1) {
      Alert.alert('至少保留一个时长选项')
      return
    }
    patch({ duration_options: product.duration_options.filter((_, itemIndex) => itemIndex !== index) })
  }

  async function save() {
    if (!receivingReady) {
      Alert.alert('请先绑定银行卡', '请先完成收款账户开通和银行卡绑定，再保存订阅套餐价格。')
      return
    }
    if (!product.name.trim()) {
      Alert.alert('缺少方案名称', '请输入产品名称。')
      return
    }
    if (product.duration_options.some((option) => Number(option.price) <= 0)) {
      Alert.alert('价格无效', '价格必须大于 0。')
      return
    }
    const normalized: Product = {
      ...product,
      name: product.name.trim(),
      description: product.description?.trim() || '',
      included_products: product.type === 'combo' ? (product.included_products || []).filter(Boolean) : [],
      duration_options: product.duration_options.map((item) => ({ months: Math.max(1, Math.floor(Number(item.months || 1))), price: Math.max(0, Math.floor(Number(item.price || 0))) })),
    }
    const existingIndex = allProducts.findIndex((item) => item.id === normalized.id)
    const nextProducts = existingIndex >= 0
      ? allProducts.map((item, index) => index === existingIndex ? normalized : item)
      : [...allProducts, normalized]
    try {
      setSaving(true)
      await safeRequest('/api/coach/update-pricing', { body: { products: nextProducts } })
      navigation.goBack()
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title={isEdit ? '编辑定价方案' : '添加定价方案'} onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载定价方案" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title={isEdit ? '编辑定价方案' : '添加定价方案'} subtitle="层级、类型、介绍、组合细项和多时长价格。" onBack={() => navigation.goBack()}>
      <Card style={[styles.receivingCard, receivingReady ? styles.receivingReady : styles.receivingPending]}>
        <Text style={styles.receivingTitle}>{receivingReady ? '收款账户已开通' : '先开通收款账户，学生才能完成付款'}</Text>
        <Text style={styles.receivingDesc}>{receivingReady ? '当前套餐保存后可正常通过平台收款。' : '未绑卡前不能保存订阅套餐价格。'}</Text>
      </Card>
      <Card style={styles.formCard}>
        <Text style={styles.fieldLabel}>层级</Text>
        <View style={styles.filterRow}>
          {TIER_OPTIONS.map((item) => (
            <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={`套餐等级：${item.label}`} accessibilityState={{ selected: product.tier === item.value }} onPress={() => patch({ tier: item.value })} style={[styles.chip, product.tier === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, product.tier === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>服务类型</Text>
        <View style={styles.filterRow}>
          {TYPE_OPTIONS.map((item) => (
            <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={`套餐类型：${item.label}`} accessibilityState={{ selected: product.type === item.value }} onPress={() => patch({ type: item.value })} style={[styles.chip, product.type === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, product.type === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <FormField label="方案名称" value={product.name} onChangeText={(name) => patch({ name })} placeholder="输入服务名称" />
        <FormField label="详细介绍" value={product.description || ''} onChangeText={(description) => patch({ description })} multiline placeholder="简单介绍该方案的特色" />
        {product.type === 'combo' ? <FormField label="包含细项" value={(product.included_products || []).join('、')} onChangeText={(value) => patch({ included_products: parseItems(value) })} placeholder="项目1、项目2" /> : null}
        <View style={styles.durationHeader}>
          <Text style={styles.fieldLabel}>时长梯度与价格</Text>
          <Pressable onPress={addDuration} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>+ 添加</Text>
          </Pressable>
        </View>
        {product.duration_options.map((option, index) => (
          <View key={index} style={styles.durationRow}>
            <TextInput value={String(option.months)} onChangeText={(value) => updateDuration(index, 'months', value)} keyboardType="numeric" placeholder="月数" placeholderTextColor={colors.textMuted} style={styles.durationInput} />
            <Text style={styles.durationUnit}>个月</Text>
            <Text style={styles.durationUnit}>¥</Text>
            <TextInput value={priceYuan(option.price)} onChangeText={(value) => updateDuration(index, 'price', value)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={styles.priceInput} />
            {product.duration_options.length > 1 ? (
              <Pressable onPress={() => removeDuration(index)} style={styles.removeButton}>
                <Text style={styles.removeText}>删除</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>
      <View style={styles.actionRow}>
        <SolidButton label="取消" variant="secondary" onPress={() => navigation.goBack()} />
        <SolidButton label="保存方案" loading={saving} disabled={!receivingReady || saving} onPress={save} />
      </View>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  receivingCard: { gap: spacing.sm, borderWidth: 1 },
  receivingReady: { backgroundColor: '#F0FDF9', borderColor: 'rgba(9, 139, 114, 0.22)' },
  receivingPending: { backgroundColor: '#FFF7F3', borderColor: 'rgba(207, 109, 78, 0.24)' },
  receivingTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  receivingTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  receivingDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  receivingMsg: { color: colors.brand, fontSize: 12, lineHeight: 18, marginTop: 4, fontWeight: '700' },
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  heroDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  createButton: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  createText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  tierSection: { gap: spacing.sm },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '900' },
  tierAdd: { minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  tierAddText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  productCard: { gap: spacing.sm },
  productHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  productName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  productMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  productDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  priceTag: { paddingHorizontal: spacing.xs, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brandSoft, color: colors.brand, fontSize: 12, fontWeight: '900' },
  includedText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  formCard: { gap: spacing.sm },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.surface },
  durationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  smallButton: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.brandSoft },
  smallButtonText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  durationInput: { width: 64, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, color: colors.text, paddingHorizontal: spacing.xs, textAlign: 'center' },
  priceInput: { flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, color: colors.text, paddingHorizontal: spacing.xs },
  durationUnit: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  removeButton: { minHeight: 48, paddingHorizontal: spacing.xs, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: '#FEF2F2' },
  removeText: { color: '#DC2626', fontSize: 12, fontWeight: '900' },
})
