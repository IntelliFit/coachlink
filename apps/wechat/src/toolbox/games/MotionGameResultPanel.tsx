import { Text, View } from '@tarojs/components'
import type { MotionGameRankingResult } from '@/services/motionGameLeaderboardService'

type Props = {
  actionCount: number
  actionLabel: string
  elapsedMs: number
  ranking: MotionGameRankingResult | null
  score: number
  syncState: 'idle' | 'syncing' | 'synced' | 'local-only'
  onReplay: () => void
  onViewRanking: () => void
}

export default function MotionGameResultPanel({
  actionCount,
  actionLabel,
  elapsedMs,
  ranking,
  score,
  syncState,
  onReplay,
  onViewRanking
}: Props) {
  const title = ranking?.isPersonalBest
    ? '恭喜，刷新个人纪录！'
    : syncState === 'synced'
      ? '本局成绩已同步'
      : syncState === 'syncing'
        ? '正在同步排行榜'
        : '本局成绩已保存在本机'

  return (
    <View className='game-result-card'>
      <Text className='game-result-kicker'>CHALLENGE RESULT</Text>
      <Text className='game-result-title'>{title}</Text>
      <View className='game-result-score-row'>
        <View className='game-result-score-main'>
          <Text className='game-result-score-value'>{score}</Text>
          <Text className='game-result-score-label'>穿越通道</Text>
        </View>
        <View className='game-result-score-meta'>
          <Text>坚持 {Math.floor(elapsedMs / 1000)} 秒</Text>
          <Text>{actionLabel} {actionCount}</Text>
        </View>
      </View>

      {ranking ? (
        <View className='game-result-rank'>
          <Text className='game-result-rank-main'>CoachLink 玩家榜第 {ranking.rank} 名</Text>
          <Text className='game-result-rank-sub'>超过 {ranking.percentile}% 玩家 · 共 {ranking.total} 人</Text>
        </View>
      ) : (
        <Text className='game-result-sync-note'>
          {syncState === 'syncing'
            ? '服务器正在校验本局成绩，请稍候。'
            : '网络恢复后可再次挑战并计入在线排行榜。'}
        </Text>
      )}

      <View className='game-result-actions'>
        <View className='game-result-primary' onClick={onReplay}>
          <Text>再来一局</Text>
        </View>
        <View className='game-result-secondary' onClick={onViewRanking}>
          <Text>查看排行榜</Text>
        </View>
      </View>
    </View>
  )
}
