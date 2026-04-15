import React from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'
import { Icon } from '@/components/Icon'
import { FileText, Pencil } from 'lucide-react'
import './PlanPreferencesDisplay.scss'

interface PlanPreferencesDisplayProps {
  subscribeData: any
  coachId?: string
  planStatus?: string | null
  onEditQuestionnaire?: () => void
}

const PlanPreferencesDisplay: React.FC<PlanPreferencesDisplayProps> = ({
  subscribeData,
  planStatus,
  onEditQuestionnaire
}) => {
  if (!subscribeData) {
    return (
      <View className="plan-preferences">
        <View className="empty-state">
          <Text className="empty-icon">📝</Text>
          <Text className="empty-text">暂无问卷数据</Text>
        </View>
      </View>
    )
  }

  const items = Array.isArray(subscribeData) ? subscribeData : []

  return (
    <View className="plan-preferences">
      <View className="questionnaire-header">
        <View className="header-left">
          <Icon component={FileText} size={20} className="header-icon" />
          <Text className="header-title">本期训练需求</Text>
        </View>
        {onEditQuestionnaire && (
          <Button
            size="small"
            fill="outline"
            className="edit-btn"
            onClick={onEditQuestionnaire}
          >
            <Icon component={Pencil} size={14} />
            <Text className="edit-btn-text">更新问卷</Text>
          </Button>
        )}
      </View>

      {items.length === 0 ? (
        <View className="empty-state small">
          <Text className="empty-text">暂无训练需求数据</Text>
        </View>
      ) : (
        <View className="questionnaire-list">
          {items.map((item: any, index: number) => (
            <View key={`q-${index}`} className="question-item">
              <Text className="item-label">
                Q{index + 1}. {item.question || `问题 ${index + 1}`}
              </Text>
              {item.type === 'tags' && (
                <View className="item-tags">
                  {(item.userSelections || []).map((tag: string, i: number) => (
                    <View key={i} className="tag">
                      <Text className="tag-text">{tag}</Text>
                    </View>
                  ))}
                  {(!item.userSelections || item.userSelections.length === 0) && (
                    <Text className="item-muted">未选择</Text>
                  )}
                </View>
              )}
              {item.type === 'times' && (
                <View className="item-times">
                  <Text className="item-value">
                    {item.userSelection != null ? `每周 ${item.userSelection} 次` : '未填写'}
                  </Text>
                </View>
              )}
              {item.type === 'rm' && (
                <View className="item-rm">
                  {typeof item.userInputs === 'object' && item.userInputs !== null ? (
                    Object.entries(item.userInputs).map(([k, v]: [string, any]) => (
                      <View key={k} className="rm-row">
                        <Text className="rm-key">{k}</Text>
                        <Text className="rm-val">{v != null && v > 0 ? `${v} kg` : '-'}</Text>
                      </View>
                    ))
                  ) : (
                    <Text className="item-muted">未填写</Text>
                  )}
                </View>
              )}
              {item.type !== 'tags' && item.type !== 'times' && item.type !== 'rm' && (
                <Text className="item-value">
                  {typeof item.userSelection === 'string'
                    ? item.userSelection
                    : item.userSelection != null || item.userInputs != null
                      ? String(item.userSelection ?? item.userInputs ?? '')
                      : '未填写'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default PlanPreferencesDisplay
