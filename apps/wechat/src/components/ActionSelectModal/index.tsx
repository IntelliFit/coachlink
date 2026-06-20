/**
 * 动作选择弹窗
 * 用于在创建/编辑训练计划时选择动作
 */
import React, { useState, useMemo } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { Dialog } from '@nutui/nutui-react-taro'
import './index.scss'

interface Action {
  id: string
  name: string
  type?: string
  attrs?: string[]
  enableAutoWeightCompute?: boolean
}

interface ActionSelectModalProps {
  visible: boolean
  actions: Action[]
  onClose: () => void
  onSelect: (action: Action) => void
}

export default function ActionSelectModal({
  visible,
  actions,
  onClose,
  onSelect
}: ActionSelectModalProps) {
  const [searchText, setSearchText] = useState('')

  const filteredActions = useMemo(() => {
    if (!searchText.trim()) return actions
    const keyword = searchText.toLowerCase()
    return actions.filter(a => a.name.toLowerCase().includes(keyword))
  }, [actions, searchText])

  const handleSelect = (action: Action) => {
    onSelect(action)
    setSearchText('')
    onClose()
  }

  const handleClose = () => {
    setSearchText('')
    onClose()
  }

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      title="选择动作"
      className="action-select-dialog"
      cancelText="取消"
      showConfirm={false}
    >
      <View className="action-select-content">
        {/* 搜索框 */}
        <View className="action-search">
          <Input
            className="action-search-input"
            placeholder="搜索动作名称"
            value={searchText}
            onInput={e => setSearchText(e.detail.value)}
          />
        </View>

        {/* 动作列表 */}
        <ScrollView className="action-list" scrollY>
          {filteredActions.length === 0 ? (
            <View className="action-empty">
              <Text>未找到匹配的动作</Text>
            </View>
          ) : (
            filteredActions.map(action => (
              <View
                key={action.id}
                className="action-item"
                onClick={() => handleSelect(action)}
              >
                <Text className="action-name">{action.name}</Text>
                {action.type && (
                  <Text className="action-type">{action.type}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Dialog>
  )
}
