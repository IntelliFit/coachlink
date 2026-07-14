import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, Button, Checkbox, Radio, Skeleton } from '@nutui/nutui-react-taro'
import { StableNutInput as Input } from '@/components/StableNutInput'
import './index.scss'

interface TrainingItem {
  id?: string
  type: string
  question?: string
  options?: any[]
  selectionMode?: 'single' | 'multiple'
  allowOther?: boolean
  userSelections?: string[]
  userSelection?: any
  userOtherText?: string
  userInputs?: any
}

interface QuestionnaireFormProps {
  visible: boolean
  onHide: () => void
  questions: TrainingItem[]
  coach?: any
  onSubmit: (answers: TrainingItem[]) => void
  loading: boolean
  existingAnswers?: TrainingItem[]
}

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  visible,
  onHide,
  questions,
  onSubmit,
  loading,
  existingAnswers
}) => {
  const [answers, setAnswers] = useState<TrainingItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (visible && questions) {
      if (existingAnswers && existingAnswers.length > 0) {
        const merged = questions.map(q => {
          const existing = existingAnswers.find(e => 
            (e.id && q.id && e.id === q.id) || 
            (e.type === q.type && e.question === q.question)
          )
          return existing ? { ...q, ...existing } : q
        })
        setAnswers(merged)
      } else {
        setAnswers([...questions])
      }
    }
  }, [visible, questions, existingAnswers])

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      onSubmit(answers)
    } catch (error: any) {
      Taro.showToast({ title: error.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const updateAnswer = (index: number, field: string, value: any) => {
    const newAnswers = [...answers]
    newAnswers[index] = { ...newAnswers[index], [field]: value }
    setAnswers(newAnswers)
  }

  return (
    <Dialog
      visible={visible}
      onClose={onHide}
      title="训练需求问卷"
      className="questionnaire-form-dialog"
    >
      <View className="questionnaire-dialog-content">
        <ScrollView className="questionnaire-scroll" scrollY>
        {loading ? (
          <View className="loading-container">
            <Skeleton animated rows={3} title={false} visible={false} />
          </View>
        ) : (
          <View className="questionnaire-form">
            {answers.map((item, index) => (
              <View key={index} className="question-item">
                <Text className="question-label">
                  Q{index + 1}. {item.question || `问题 ${index + 1}`}
                </Text>

                {item.type === 'tags' && (
                  <View className="tags-options">
                    {(item.options || []).map((option: string, optIndex: number) => (
                      <Checkbox
                        key={optIndex}
                        checked={(item.userSelections || []).includes(option)}
                        onChange={(checked) => {
                          const selections = item.userSelections || []
                          const newSelections = checked
                            ? [...selections, option]
                            : selections.filter(s => s !== option)
                          updateAnswer(index, 'userSelections', newSelections)
                        }}
                        className="tag-checkbox"
                      >
                        {option}
                      </Checkbox>
                    ))}
                  </View>
                )}

                {item.type === 'times' && (
                  <View className="times-options">
                    {(item.options || [1, 2, 3, 4, 5, 6, 7]).map((num: number) => (
                      <Radio
                        key={num}
                        checked={item.userSelection === num}
                        onChange={() => updateAnswer(index, 'userSelection', num)}
                        className="time-radio"
                      >
                        {num}
                      </Radio>
                    ))}
                  </View>
                )}

                {item.type === 'rm' && (
                  <View className="rm-inputs">
                    <Text className="rm-hint">请输入各动作的 RM 重量 (kg)</Text>
                    {Object.keys(item.userInputs || {}).map((key) => (
                      <View key={key} className="rm-input-item">
                        <Text className="rm-label">{key}</Text>
                        <Input
                          type="number"
                          value={item.userInputs?.[key]?.toString() || ''}
                          onChange={(val) => {
                            const inputs = { ...(item.userInputs || {}) }
                            inputs[key] = val ? Number(val) : 0
                            updateAnswer(index, 'userInputs', inputs)
                          }}
                          placeholder="0"
                        />
                      </View>
                    ))}
                  </View>
                )}

                {item.type === 'option' && (() => {
                  const isMultiple = item.selectionMode === 'multiple'
                  const allowOther = Boolean(item.allowOther)
                  const opts: string[] = (Array.isArray(item.options) ? item.options : []) as string[]
                  const selections: string[] = Array.isArray(item.userSelections) ? item.userSelections : []
                  const singleSelection = typeof item.userSelection === 'string' ? item.userSelection : ''
                  const OTHER_KEY = '__other__'
                  const otherChecked = isMultiple ? selections.includes(OTHER_KEY) : singleSelection === OTHER_KEY

                  return (
                    <View className="option-group">
                      {opts.map((opt: string, optIdx: number) => {
                        const checked = isMultiple
                          ? selections.includes(opt)
                          : singleSelection === opt
                        return isMultiple ? (
                          <Checkbox
                            key={optIdx}
                            checked={checked}
                            onChange={(c) => {
                              const next = c
                                ? Array.from(new Set([...selections, opt]))
                                : selections.filter((s) => s !== opt)
                              updateAnswer(index, 'userSelections', next)
                            }}
                            className="option-checkbox"
                          >
                            {opt}
                          </Checkbox>
                        ) : (
                          <Radio
                            key={optIdx}
                            checked={checked}
                            onChange={() => updateAnswer(index, 'userSelection', opt)}
                            className="option-radio"
                          >
                            {opt}
                          </Radio>
                        )
                      })}
                      {allowOther && (
                        <View className="option-other">
                          {isMultiple ? (
                            <Checkbox
                              checked={otherChecked}
                              onChange={(c) => {
                                const next = c
                                  ? Array.from(new Set([...selections, OTHER_KEY]))
                                  : selections.filter((s) => s !== OTHER_KEY)
                                updateAnswer(index, 'userSelections', next)
                                if (!c) {
                                  updateAnswer(index, 'userOtherText', '')
                                }
                              }}
                              className="option-checkbox"
                            >
                              其他
                            </Checkbox>
                          ) : (
                            <Radio
                              checked={otherChecked}
                              onChange={() => updateAnswer(index, 'userSelection', OTHER_KEY)}
                              className="option-radio"
                            >
                              其他
                            </Radio>
                          )}
                          {otherChecked && (
                            <Input
                              className="option-other-input"
                              value={item.userOtherText || ''}
                              onChange={(val) => updateAnswer(index, 'userOtherText', val)}
                              placeholder="请补充说明"
                            />
                          )}
                        </View>
                      )}
                    </View>
                  )
                })()}

                {item.type === 'text' && (
                  <View className="text-input">
                    <Textarea
                      className="text-textarea"
                      value={item.userSelection?.toString() || ''}
                      onInput={(e) => updateAnswer(index, 'userSelection', e.detail.value)}
                      placeholder="请一次性把你的情况写完整，例如训练目标、当前水平、每周训练次数、器械条件、伤痛限制、作息情况等"
                      maxlength={-1}
                      autoHeight
                    />
                    <Text className="text-input-hint">
                      一次性写完整会更方便教练和 AI 理解你的情况。
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
        <View className="dialog-footer">
          <Button
            size="small"
            fill="outline"
            onClick={onHide}
            className="cancel-btn"
          >
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            loading={submitting || loading}
            onClick={handleSubmit}
            className="submit-btn"
          >
            保存
          </Button>
        </View>
      </View>
    </Dialog>
  )
}

export default QuestionnaireForm
