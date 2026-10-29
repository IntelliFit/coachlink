/**
 * 与小程序设计变量 v1 对齐（apps/wechat/src/styles/tokens-css.scss、_tokens.scss），
 * 两端用同一套颜色、圆角、字号和控件尺寸。小程序 rpx ÷ 2 = 这里的 dp。
 */
export const colors = {
  /** --cl-clay：品牌色，用于图标、选中文字、强调。 */
  brand: '#CF6D4E',
  /** --cl-clay-strong：主按钮底色（白字对比度 4.6:1）。 */
  brandStrong: '#B4553A',
  brandDark: '#B4553A',
  /** --cl-clay-soft：品牌浅底（标签、提示条）。 */
  brandSoft: '#F7E6DE',
  /** --cl-clay-text：浅底上的品牌文字。 */
  brandText: '#9C4A31',
  /** --cl-link */
  link: '#B4553A',
  /** --cl-paper：页面底色。 */
  background: '#F5F2ED',
  /** --cl-card */
  surface: '#FFFFFF',
  /** --cl-sunk：凹陷区域、未选中的筛选标签。 */
  surfaceMuted: '#EFEAE2',
  /** --cl-ink / ink-2 / ink-4 */
  text: '#1D1A16',
  textSecondary: '#5F574D',
  /** --cl-ink-3：辅助说明文字（在白底和页面底色上对比度 ≥ 4.5:1）。 */
  textTertiary: '#736A5F',
  /** --cl-ink-4：占位符、禁用、弱图标。 */
  textMuted: '#A39A8E',
  /** --cl-line / line-soft / control-line */
  border: '#E6DFD5',
  borderSoft: '#F0EBE3',
  controlBorder: '#D9D0C4',
  /** --cl-selected-bg / text：选中的筛选标签、分段控件。 */
  selected: '#1D1A16',
  selectedText: '#FFFFFF',
  /** --cl-done / done-soft */
  success: '#2F7D5B',
  successSoft: '#E3F0E9',
  /** --cl-warn-text / warn-bg / warn-line */
  warning: '#8A5208',
  warningSoft: '#FBF0DC',
  warningBorder: '#EBD9B5',
  /** --cl-danger */
  danger: '#A33A2A',
  /** --cl-mask */
  mask: 'rgba(29,26,22,0.4)',
}

export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
}

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
  /** 语义圆角，与小程序 $cl-radius-* 一致。 */
  tag: 8,
  input: 8,
  button: 12,
  card: 16,
  sheet: 24,
}

/** 与小程序 $cl-font-*：页面标题 / 分区标题 / 卡片标题 / 正文 / 辅助 / 标签。 */
export const typography = {
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
  section: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  card: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  tag: { fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
}

/** 控件高度：主操作 52、最小触控 48（Android 规范，略高于小程序的 44）、行内 32、筛选标签 36、底部导航 56。 */
export const controlHeight = {
  lg: 52,
  md: 48,
  sm: 32,
  chip: 36,
  tabBar: 56,
}

/**
 * 卡片阴影：小程序卡片是平的（只有 1px 描边），这里保留同名 token 让旧样式不用逐个改，但不再投影。
 */
export const shadow = {
  shadowColor: '#1D1A16',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const

/** 浮层阴影（--cl-shadow-float）：弹窗、底部弹层、悬浮按钮。 */
export const floatShadow = {
  shadowColor: '#1D1A16',
  shadowOpacity: 0.12,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const
