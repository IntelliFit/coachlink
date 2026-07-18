import Taro from '@tarojs/taro'

export type ArcadeFeedback = {
  id: number
  text: string
  tone: 'action' | 'bad' | 'good'
}

export function vibrateForArcadeFeedback(tone: ArcadeFeedback['tone']) {
  void Taro.vibrateShort({
    type: tone === 'bad' ? 'heavy' : 'light'
  }).catch(() => undefined)
}
