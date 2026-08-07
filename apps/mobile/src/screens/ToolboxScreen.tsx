import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { SectionCard } from '../components/SectionCard'
import { Page } from '../components/Page'
import { ActionGrid, ActionTile, HeroPanel, ImageToolCard, RowCard } from './AppHomeShared'
import type { MainTabParamList } from '../navigation/types'

type Props = BottomTabScreenProps<MainTabParamList, 'ToolboxTab'>

const powerImage = require('../../assets/toolbox/toolbox-power-analysis.jpg')
const calculatorImage = require('../../assets/toolbox/toolbox-calculator.jpg')
const locationsImage = require('../../assets/toolbox/toolbox-locations.jpg')
const dataImage = require('../../assets/toolbox/toolbox-data.jpg')

const scenarios = [
  { title: '办公后肩颈放松', subtitle: '久坐办公、低头看电脑后肩颈发紧。', slug: 'office-neck' },
  { title: '久坐后腰背舒展', subtitle: '腰背发僵、起身打不开。', slug: 'sitting-back' },
  { title: '跑步后下肢拉伸', subtitle: '放松小腿、大腿前侧和髋臀。', slug: 'post-run' },
  { title: '睡前放松', subtitle: '呼吸、背部和神经状态慢慢放下来。', slug: 'bedtime' },
]

export function ToolboxScreen({ navigation }: Props) {
  const rootNav = navigation.getParent<any>()
  return (
    <Page>
      <HeroPanel title="工具箱" subtitle="街健指数、功率分析和训练辅助工具。" icon="icon-toolbox" />

      <SectionCard title="专项评估" description="快速评估当前阶段，并获得可执行的训练建议。">
        <RowCard title="单手引体评估" subtitle="输入体重和负重引体 1RM，查看准备度与 8 周计划。" icon="icon-strength" onPress={() => rootNav?.navigate('OneArmPullUp')} />
      </SectionCard>

      <ImageToolCard title="功率视频分析" subtitle="上传引体、双力臂、臂屈伸、俯卧撑或深蹲视频，估算功率与速度。" image={powerImage} onPress={() => rootNav?.navigate('PowerAnalysis')} />
      <SectionCard title="视频创作" description="复用小程序同一套云端处理能力，任务退出页面后也可恢复。">
        <RowCard title="手指光膜" subtitle="上传双手动作视频，生成随指尖变化的动态光膜并保存到相册。" icon="icon-video" onPress={() => rootNav?.navigate('MotionEffects')} />
      </SectionCard>
      <ImageToolCard title="力量计算器" subtitle="可计算极限重量、做组重量和训练系数等。" image={calculatorImage} onPress={() => rootNav?.navigate('StreetliftingCalculator')} />
      <ImageToolCard title="单杠位置" subtitle="查找、分享单杠位置，支持上传图片。" image={locationsImage} onPress={() => rootNav?.navigate('StreetliftingLocations')} />
      <ImageToolCard title="社区数据" subtitle="查看与提交街健力量数据，支持认领。" image={dataImage} onPress={() => rootNav?.navigate('StreetliftingData')} />

      <SectionCard title="场景放松" description="不用先懂体系，直接按情境开始。">
        {scenarios.map((item) => <RowCard key={item.slug} title={item.title} subtitle={item.subtitle} icon="icon-toolbox" onPress={() => rootNav?.navigate('ToolboxScenario', { slug: item.slug })} />)}
      </SectionCard>

      <ActionGrid>
        <ActionTile title="方法论" subtitle="街健指数说明" icon="icon-knowledge" onPress={() => rootNav?.navigate('StreetliftingMethodology')} />
        <ActionTile title="街健故事" subtitle="案例与活动记录" icon="icon-time" onPress={() => rootNav?.navigate('StreetliftingStories')} />
        <ActionTile title="提交数据" subtitle="贡献社区数据" icon="icon-pencil" onPress={() => rootNav?.navigate('StreetliftingSubmit')} />
        <ActionTile title="点位地图" subtitle="查看可导航点位" icon="icon-location" onPress={() => rootNav?.navigate('StreetliftingLocationsMap')} />
      </ActionGrid>
    </Page>
  )
}
