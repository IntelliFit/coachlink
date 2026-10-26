import { Text, View } from '@tarojs/components'
import { BOJI_DUEL_METRIC_LABELS, type BojiDuel } from '@coachlink/core/src/bojiInsights'
import './redesign.scss'

/** PK 逐项对比：左边是你、右边是对方，赢的一边高亮 */
export function DuelBars({ duel }: { duel: BojiDuel }) {
  return (
    <View className='boji-duelbars'>
      {duel.lines.map((line) => {
        const mineWins = line.outcome === 'win'
        const theirsWin = line.outcome === 'lose'
        const label = line.key === 'arms' ? '手臂' : line.key === 'symmetry' ? '对称' : BOJI_DUEL_METRIC_LABELS[line.key]
        return (
          <View key={line.key} className='boji-duelbars__row'>
            <View className='boji-duelbars__side boji-duelbars__side--mine'>
              <Text className={`boji-duelbars__num cl-num ${mineWins ? 'boji-duelbars__num--mine' : ''}`}>
                {line.mine === null ? '—' : Math.round(line.mine)}
              </Text>
              <View className='boji-duelbars__track boji-duelbars__track--mine'>
                <View
                  className={`boji-duelbars__fill ${mineWins ? 'boji-duelbars__fill--mine' : ''}`}
                  style={{ width: `${Math.min(100, Math.max(0, line.mine ?? 0))}%` }}
                />
              </View>
            </View>
            <Text className='boji-duelbars__label'>{label}</Text>
            <View className='boji-duelbars__side'>
              <View className='boji-duelbars__track'>
                <View
                  className={`boji-duelbars__fill ${theirsWin ? 'boji-duelbars__fill--theirs' : ''}`}
                  style={{ width: `${Math.min(100, Math.max(0, line.theirs ?? 0))}%` }}
                />
              </View>
              <Text className={`boji-duelbars__num cl-num ${theirsWin ? 'boji-duelbars__num--theirs' : ''}`}>
                {line.theirs === null ? '—' : Math.round(line.theirs)}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
