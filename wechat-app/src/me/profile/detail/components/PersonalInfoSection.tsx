import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, Input, Button, Picker, Popup } from '@nutui/nutui-react-taro'
import { Icon } from '@/components/Icon'
import { User , Edit } from 'lucide-react'
import { studentService } from '@/services/studentService'
import './PersonalInfoSection.scss'

interface PersonalInfoSectionProps {
  data: any
  onUpdate: () => void
  editingVisible?: boolean
  onEditingChange?: (visible: boolean) => void
  hideDisplay?: boolean
}

const GENDER_OPTIONS = [
  { text: '男', value: 'male' },
  { text: '女', value: 'female' }
]

const FITNESS_GOAL_OPTIONS = [
  { text: '减脂塑形', value: '减脂' },
  { text: '增肌强身', value: '增肌' },
  { text: '力量提升', value: '力量提升' },
  { text: '体能改善', value: '体能改善' }
]

const FITNESS_LEVEL_OPTIONS = [
  { text: '初学者', value: 'beginner' },
  { text: '中级', value: 'intermediate' },
  { text: '高级', value: 'advanced' }
]

const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({
  data,
  onUpdate,
  editingVisible,
  onEditingChange,
  hideDisplay = false
}) => {
  const { profile } = data
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerType, setPickerType] = useState<'gender' | 'fitness_goal' | 'fitness_level' | null>(null)
  const [pickerValue, setPickerValue] = useState<(string | number)[]>([])

  const editingState = editingVisible !== undefined ? editingVisible : isEditing
  const setEditingState = (visible: boolean) => {
    if (onEditingChange) {
      onEditingChange(visible)
    } else {
      setIsEditing(visible)
    }
  }

  const [formData, setFormData] = useState({
    nickname: '',
    age: null as number | null,
    gender: '',
    height: null as number | null,
    weight: null as number | null,
    lifestyle: '',
    fitness_goal: '',
    fitness_level: ''
  })

  useEffect(() => {
    if (editingState && profile) {
      setFormData({
        nickname: profile.nickname || '',
        age: profile.age || null,
        gender: profile.gender || '',
        height: profile.height || null,
        weight: profile.weight || null,
        lifestyle: profile.lifestyle || '',
        fitness_goal: profile.fitness_goal || '',
        fitness_level: profile.fitness_level || ''
      })
    }
  }, [editingState, profile])

  const handleSave = async () => {
    try {
      setLoading(true)
      await studentService.updateProfile({
        nickname: formData.nickname,
        age: formData.age,
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
        lifestyle: formData.lifestyle,
        fitness_goal: formData.fitness_goal,
        fitness_level: formData.fitness_level
      })
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setEditingState(false)
      onUpdate()
    } catch (error: any) {
      Taro.showToast({ title: error.message || '保存失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const getFitnessLevelText = (level: string) => {
    const map: Record<string, string> = {
      'beginner': '初学者',
      'intermediate': '中级',
      'advanced': '高级'
    }
    return map[level] || level || '未填写'
  }

  const getFitnessGoalText = (goal: string) => {
    if (!goal) return '未填写'
    return goal
  }

  const infoItems = [
    { label: '身高', value: profile?.height ? `${profile.height} cm` : null },
    { label: '体重', value: profile?.weight ? `${profile.weight} kg` : null },
    { label: '健身目标', value: getFitnessGoalText(profile?.fitness_goal) },
    { label: '健身水平', value: getFitnessLevelText(profile?.fitness_level) },
    { label: '生活作息', value: profile?.lifestyle || '未填写' }
  ]

  if (hideDisplay) {
    return (
      <Dialog
        visible={editingState}
        onClose={() => setEditingState(false)}
        title="编辑个人信息"
        className="personal-info-dialog"
      >
        <View className="edit-form">
          <View className="form-item">
            <Text className="form-label">昵称</Text>
            <Input
              value={formData.nickname}
              onChange={(val) => setFormData({ ...formData, nickname: val })}
              placeholder="请输入昵称"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">年龄</Text>
            <Input
              type="number"
              value={formData.age?.toString() || ''}
              onChange={(val) => setFormData({ ...formData, age: val ? Number(val) : null })}
              placeholder="请输入年龄"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">性别</Text>
            <View onClick={() => { setPickerType('gender'); setPickerValue(formData.gender ? [formData.gender] : []); setPickerVisible(true) }}>
              <Input
                value={GENDER_OPTIONS.find(o => o.value === formData.gender)?.text || '请选择性别'}
                placeholder="请选择性别"
                readonly
              />
            </View>
          </View>

          <View className="form-item">
            <Text className="form-label">身高 (cm)</Text>
            <Input
              type="number"
              value={formData.height?.toString() || ''}
              onChange={(val) => setFormData({ ...formData, height: val ? Number(val) : null })}
              placeholder="请输入身高"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">体重 (kg)</Text>
            <Input
              type="number"
              value={formData.weight?.toString() || ''}
              onChange={(val) => setFormData({ ...formData, weight: val ? Number(val) : null })}
              placeholder="请输入体重"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">生活作息</Text>
            <Input
              value={formData.lifestyle}
              onChange={(val) => setFormData({ ...formData, lifestyle: val })}
              placeholder="请输入生活作息"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">健身目标</Text>
            <View onClick={() => { setPickerType('fitness_goal'); setPickerValue(formData.fitness_goal ? [formData.fitness_goal] : []); setPickerVisible(true) }}>
              <Input
                value={FITNESS_GOAL_OPTIONS.find(o => o.value === formData.fitness_goal)?.text || '请选择健身目标'}
                placeholder="请选择健身目标"
                readonly
              />
            </View>
          </View>

          <View className="form-item">
            <Text className="form-label">健身水平</Text>
            <View onClick={() => { setPickerType('fitness_level'); setPickerValue(formData.fitness_level ? [formData.fitness_level] : []); setPickerVisible(true) }}>
              <Input
                value={FITNESS_LEVEL_OPTIONS.find(o => o.value === formData.fitness_level)?.text || '请选择健身水平'}
                placeholder="请选择健身水平"
                readonly
              />
            </View>
          </View>

          <View className="form-actions">
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={handleSave}
            >
              保存
            </Button>
          </View>
        </View>
      </Dialog>
    )
  }

  return (
    <>
      <View className="personal-info-section">
        <View className="section-header">
          <View className="header-left">
            <Icon component={User} size={18} className="section-icon" />
            <Text className="section-title">个人信息</Text>
          </View>
          <View className="edit-btn" onClick={() => setEditingState(true)}>
            <Icon component={Edit} size={16} className="edit-icon" />
          </View>
        </View>

        <View className="info-tags">
          {infoItems.map((item, index) => (
            <View
              key={index}
              className={`info-tag ${!item.value || item.value === '未填写' ? 'empty' : ''}`}
            >
              <Text className="tag-label">{item.label}</Text>
              <Text className="tag-value">{item.value || '未填写'}</Text>
            </View>
          ))}
        </View>
      </View>

      <Dialog
        visible={editingState}
        onClose={() => setEditingState(false)}
        title="编辑个人信息"
        className="personal-info-dialog"
      >
        <View className="edit-form">
          <View className="form-item">
            <Text className="form-label">昵称</Text>
            <Input
              value={formData.nickname}
              onChange={(val) => setFormData({ ...formData, nickname: val })}
              placeholder="请输入昵称"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">年龄</Text>
            <Input
              type="number"
              value={formData.age?.toString() || ''}
              onChange={(val) => setFormData({ ...formData, age: val ? Number(val) : null })}
              placeholder="请输入年龄"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">性别</Text>
            <View onClick={() => { setPickerType('gender'); setPickerValue(formData.gender ? [formData.gender] : []); setPickerVisible(true) }}>
              <Input
                value={GENDER_OPTIONS.find(o => o.value === formData.gender)?.text || '请选择性别'}
                placeholder="请选择性别"
                readonly
              />
            </View>
          </View>

          <View className="form-item">
            <Text className="form-label">身高 (cm)</Text>
            <Input
              type="number"
              value={formData.height?.toString() || ''}
              onChange={(val) => setFormData({ ...formData, height: val ? Number(val) : null })}
              placeholder="请输入身高"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">体重 (kg)</Text>
            <Input
              type="number"
              value={formData.weight?.toString() || ''}
              onChange={(val) => setFormData({ ...formData, weight: val ? Number(val) : null })}
              placeholder="请输入体重"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">生活作息</Text>
            <Input
              value={formData.lifestyle}
              onChange={(val) => setFormData({ ...formData, lifestyle: val })}
              placeholder="请输入生活作息"
            />
          </View>

          <View className="form-item">
            <Text className="form-label">健身目标</Text>
            <View onClick={() => { setPickerType('fitness_goal'); setPickerValue(formData.fitness_goal ? [formData.fitness_goal] : []); setPickerVisible(true) }}>
              <Input
                value={FITNESS_GOAL_OPTIONS.find(o => o.value === formData.fitness_goal)?.text || '请选择健身目标'}
                placeholder="请选择健身目标"
                readonly
              />
            </View>
          </View>

          <View className="form-item">
            <Text className="form-label">健身水平</Text>
            <View onClick={() => { setPickerType('fitness_level'); setPickerValue(formData.fitness_level ? [formData.fitness_level] : []); setPickerVisible(true) }}>
              <Input
                value={FITNESS_LEVEL_OPTIONS.find(o => o.value === formData.fitness_level)?.text || '请选择健身水平'}
                placeholder="请选择健身水平"
                readonly
              />
            </View>
          </View>

          <View className="form-actions">
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={handleSave}
            >
              保存
            </Button>
          </View>
        </View>
      </Dialog>

      <Popup
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        position="bottom"
        className="picker-popup"
      >
        <Picker
          visible={pickerVisible}
          options={pickerType === 'gender' ? GENDER_OPTIONS : pickerType === 'fitness_goal' ? FITNESS_GOAL_OPTIONS : FITNESS_LEVEL_OPTIONS}
          value={pickerValue}
          onConfirm={(selectedOptions, selectedValue) => {
            const val = selectedValue[0]
            if (pickerType === 'gender') {
              setFormData({ ...formData, gender: val as string })
            } else if (pickerType === 'fitness_goal') {
              setFormData({ ...formData, fitness_goal: val as string })
            } else if (pickerType === 'fitness_level') {
              setFormData({ ...formData, fitness_level: val as string })
            }
            setPickerVisible(false)
          }}
          onCancel={() => setPickerVisible(false)}
        />
      </Popup>
    </>
  )
}

export default PersonalInfoSection
