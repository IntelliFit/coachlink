import type { StyleProp, TextStyle } from 'react-native'
import { Text } from 'react-native'
import { colors } from '../theme'

export const ICON_FONT_FAMILY = 'iconfont'

export const iconGlyphs = {
  'icon-back': '\ue6db',
  'icon-a-shili-zhankaizuocezhankaijiantou': '\ue650',
  'icon-qiehuanyonghu': '\ue6ed',
  'icon-zhongwu': '\ue82f',
  'icon-zaoshang': '\ue718',
  'icon-wanshang': '\ue607',
  'icon-kcal': '\ue831',
  'icon-messages': '\ue691',
  'icon-right-arrow': '\ue632',
  'icon-filter': '\ue672',
  'icon-download': '\ue66c',
  'icon-strength': '\ue605',
  'icon-zhongliang': '\ue7f6',
  'icon-wenhao': '\ue72d',
  'icon-city': '\ue67a',
  'icon-female': '\ue71a',
  'icon-male': '\ue71c',
  'icon-exit': '\ue7cb',
  'icon-user': '\ue7ae',
  'icon-vips': '\ue619',
  'icon-toolbox': '\ue828',
  'icon-pencil': '\ue790',
  'icon-shenqingquanxian': '\ue640',
  'icon-account-settings-variant': '\ue60a',
  'icon-dumbbell': '\ue70d',
  'icon-ranking': '\ue6ad',
  'icon-location': '\ue791',
  'icon-gengduo': '\ue612',
  'icon-share': '\ue86e',
  'icon-video': '\ue73b',
  'icon-friends-o': '\ue64b',
  'icon-dashboard': '\ue62d',
  'icon-pinglun': '\ue8b4',
  'icon-send': '\ue997',
  'icon-knowledge': '\ue89d',
  'icon-24px': '\ue60d',
  'icon-discovery': '\ue654',
  'icon-kaiji': '\ue626',
  'icon-picture': '\ue67c',
  'icon-time': '\ue680',
  'icon-left': '\ue681',
  'icon-right': '\ue683',
  'icon-calculator': '\ue698',
  'icon-traing': '\ue6a0',
  'icon-coachline_line': '\ue633',
  'icon-a-Trainingplan': '\ue7ab',
  'icon-star': '\ueaaa',
  'icon-jhk': '\ue899',
  'icon-home': '\ue601',
  'icon-goumaijilu': '\ue63a',
  'icon-training_history': '\ue682',
  'icon-setting': '\ue966',
  'icon-login': '\ue657',
  'icon-search': '\uea56',
} as const

export type IconFontName = keyof typeof iconGlyphs

type IconFontProps = {
  name: IconFontName
  size?: number
  color?: string
  style?: StyleProp<TextStyle>
}

export function IconFont({ name, size = 22, color = colors.text, style }: IconFontProps) {
  return (
    <Text style={[{ fontFamily: ICON_FONT_FAMILY, fontSize: size, lineHeight: size + 2, color }, style]}>
      {iconGlyphs[name]}
    </Text>
  )
}

