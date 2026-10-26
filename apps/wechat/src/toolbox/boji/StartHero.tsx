import { Image, Text, View } from '@tarojs/components'
import { BOJI_SEX_LABELS, type BojiSex } from '@coachlink/core/src/bojiDetector'
import sampleCover from '@/assets/images/toolbox-practical/practical-boji-detector-v2.webp'

const SEXES: BojiSex[] = ['male', 'female']

const HEADLINES: Record<BojiSex, { title: string; desc: string }> = {
  male: {
    title: '一张正面照\n测出你的薄肌等级',
    desc: '量腹肌分块、倒三角、手臂和左右对称，看看你超越了多少人、身材最像哪位明星，再拉好友 PK。'
  },
  female: {
    title: '一张正面照\n测出你的马甲线和曲线',
    desc: '量马甲线、腰臀比、肩腰比和左右对称，看看你超越了多少人、身材最像哪位明星，再拉闺蜜 PK。'
  }
}

const FEATURES = ['超越比例', '明星同款', '好友 PK']

/** 开始页主视觉：示例结果 + 标题 + 三个卖点 + 男女切换 */
export function StartHero({ sex, onSexChange, disabled }: { sex: BojiSex; onSexChange: (sex: BojiSex) => void; disabled: boolean }) {
  const copy = HEADLINES[sex]
  return (
    <View className='boji-start'>
      {sex === 'male' ? (
        <View className='boji-start__sample'>
          <Image className='boji-start__image' src={sampleCover} mode='aspectFill' />
          <Text className='boji-start__tag'>示例结果</Text>
          <View className='boji-start__chip boji-start__chip--ratio'>
            <Text className='boji-start__chip-label'>肩腰比</Text>
            <Text className='boji-start__chip-value cl-num'>1.86</Text>
          </View>
          <View className='boji-start__chip boji-start__chip--rank'>
            <Text className='boji-start__chip-label'>超越了约</Text>
            <Text className='boji-start__chip-value cl-num'>93%</Text>
          </View>
        </View>
      ) : (
        <View className='boji-start__sample boji-start__sample--plain'>
          <Text className='boji-start__tag'>测这四项</Text>
          <View className='boji-start__metrics'>
            {['马甲线', '腰臀比', '肩腰比', '左右对称'].map((name) => (
              <Text key={name} className='boji-start__metric'>{name}</Text>
            ))}
          </View>
        </View>
      )}

      <View className='boji-start__copy'>
        <Text className='boji-start__title'>{copy.title}</Text>
        <Text className='boji-start__desc'>{copy.desc}</Text>
      </View>

      <View className='boji-start__features'>
        {FEATURES.map((name) => (
          <Text key={name} className='boji-start__feature'>{name}</Text>
        ))}
      </View>

      <View className='boji-sex boji-sex--block'>
        {SEXES.map((option) => (
          <Text
            key={option}
            className={`boji-sex__option ${sex === option ? 'boji-sex__option--on' : ''}`}
            onClick={() => !disabled && onSexChange(option)}
          >
            {BOJI_SEX_LABELS[option]}
          </Text>
        ))}
      </View>
    </View>
  )
}
