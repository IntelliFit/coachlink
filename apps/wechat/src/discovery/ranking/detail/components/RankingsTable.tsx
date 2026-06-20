import React from 'react'
import { View, Text } from '@tarojs/components'
import { Icon } from '@/components/Icon'
import { Zap } from 'lucide-react'
import RankingsTableItem from './RankingsTableItem'
import type { LeaderboardEntryWithProfile, LeaderboardFormInput } from '@/types/leaderboard'

interface RankingsTableProps {
  entries: LeaderboardEntryWithProfile[]
  formSchema: LeaderboardFormInput[]
  rankByField?: string
}

export default function RankingsTable({ entries, formSchema, rankByField }: RankingsTableProps) {
  return (
    <View className="section">
      <View className="table-title">
        <Icon component={Zap} size={18} className="table-title-icon" />
        <Text className="table-title-text">实时排名 / RANKING</Text>
      </View>
      <View className="entries-list">
        {entries.map((entry, index) => {
          const formData = ((entry.form_data as unknown) as LeaderboardFormInput[]) || []
          const coreField = formData.find((f) => f.name === rankByField)
          const coreValue = coreField?.userInput ?? entry.score ?? '--'

          const uniqueLinks = Array.from(
            new Map<string, [string, string]>([
              ...formData
                .filter((f) => {
                  const v = (f as any).userInput?.toString?.()?.trim?.()
                  if (!v || !v.startsWith('http')) return false
                  try { new URL(v); return true } catch { return false }
                })
                .map((f) => [(f as any).userInput!.toString().trim(), 'VIDEO'] as [string, string]),
              ...(entry.evidence_url?.trim().startsWith('http')
                ? [[entry.evidence_url.trim(), 'VIDEO'] as [string, string]]
                : [])
            ]).entries()
          ).map(([k, v]) => [k, v] as [string, string])

          const metaData = formData.filter(
            (f) => f.name !== rankByField && !(typeof (f as any).userInput === 'string' && (f as any).userInput.trim().startsWith('http'))
          ).map((f) => ({ name: f.name, userInput: (f as any).userInput ?? null }))

          return (
            <RankingsTableItem
              key={entry.id}
              entry={entry}
              index={index}
              rankByField={rankByField || ''}
              coreValue={coreValue}
              uniqueLinks={uniqueLinks}
              metaData={metaData}
            />
          )
        })}
      </View>
    </View>
  )
}
