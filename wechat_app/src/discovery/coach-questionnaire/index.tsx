import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Checkbox, Input, Radio, Skeleton } from '@nutui/nutui-react-taro'
import { coachService } from '@/services/coach/coachService'
import { subscriptionService } from '@/services/subscriptionService'
import {
  createCoachWechatPayment,
  requestCoachWechatPayment,
  type PaymentStatus
} from '@/services/paymentService'
import './index.scss'

interface TrainingItem {
  id?: string
  type: string
  question?: string
  options?: any[]
  /** 单选/多选的选项索引数组（option 题型） */
  userSelections?: number[]
  /** 单选的选项索引（times/text/option single 题型） */
  userSelection?: any
  /** RM 题型的输入 { 动作名: 重量 } */
  userInputs?: Record<string, any>
  /** option 题型：单选/多选 */
  selectionMode?: 'single' | 'multiple'
  /** option 题型：是否允许"其他" */
  allowOther?: boolean
  /** option 题型："其他"的自定义文本 */
  userOtherText?: string
}

type QuestionnaireMode = 'edit' | 'prepay'

function parseNumber(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeQuestions(questions: TrainingItem[], existingAnswers?: TrainingItem[]) {
  if (!Array.isArray(existingAnswers) || existingAnswers.length === 0) {
    return questions.map((item) => ({ ...item }))
  }

  return questions.map((item) => {
    const existing = existingAnswers.find((answer) =>
      (answer.id && item.id && answer.id === item.id) ||
      (answer.type === item.type && answer.question === item.question)
    )
    return existing ? { ...item, ...existing } : { ...item }
  })
}

function getOptionLabel(option: any) {
  if (typeof option === 'string' || typeof option === 'number') return String(option)
  if (option && typeof option === 'object') {
    return String(option.label ?? option.text ?? option.value ?? option.name ?? '')
  }
  return ''
}

function isQuestionAnswered(item: TrainingItem): boolean {
  if (item.type === 'tags') {
    return Array.isArray(item.userSelections) && item.userSelections.length > 0
  }

  if (item.type === 'option') {
    const selectionMode = item.selectionMode === 'multiple' ? 'multiple' : 'single'
    if (selectionMode === 'multiple') {
      const selected = Array.isArray(item.userSelections) ? item.userSelections : []
      if (selected.length === 0) return false
      if (item.allowOther && selected.includes(-1)) {
        return String(item.userOtherText || '').trim().length > 0
      }
      return true
    }
    // single
    if (item.userSelection === undefined || item.userSelection === null) return false
    if (item.allowOther && item.userSelection === -1) {
      return String(item.userOtherText || '').trim().length > 0
    }
    return true
  }

  if (item.type === 'times') {
    return item.userSelection !== undefined && item.userSelection !== null && String(item.userSelection).trim() !== ''
  }

  if (item.type === 'rm') {
    const inputs = item.userInputs || {}
    const keys = Object.keys(inputs)
    if (keys.length === 0) return false
    return keys.every((key) => {
      const value = inputs[key]
      return value !== undefined && value !== null && String(value).trim() !== ''
    })
  }

  // text
  return item.userSelection !== undefined && item.userSelection !== null && String(item.userSelection).trim() !== ''
}

export default function CoachQuestionnairePage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<TrainingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const coachId = String(router.params.coachId || router.params.id || '')
  const coachName = decodeURIComponent(String(router.params.coachName || ''))
  const mode = (router.params.mode === 'edit' ? 'edit' : 'prepay') as QuestionnaireMode
  const subscriptionId = String(router.params.subscriptionId || '')
  const productId = String(router.params.productId || '')
  const productName = decodeURIComponent(String(router.params.productName || ''))
  const productTier = String(router.params.productTier || '')
  const months = parseNumber(router.params.months as string | undefined)
  const price = parseNumber(router.params.price as string | undefined)
  const answersKey = String(router.params.answersKey || '')

  const [existingAnswers] = useState<TrainingItem[] | undefined>(() => {
    if (!answersKey) return undefined
    const cached = Taro.getStorageSync(answersKey)
    if (cached) {
      Taro.removeStorageSync(answersKey)
      return cached as TrainingItem[]
    }
    return undefined
  })

  useEffect(() => {
    if (!coachId) {
      Taro.showToast({ title: '缺少教练信息', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1200)
      return
    }

    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await coachService.getQuestionnaires({ coachId })
        const list = Array.isArray((res as any)?.questionnaires) ? (res as any).questionnaires : []

        if (!mounted) return

        if (list.length === 0) {
          Taro.showToast({ title: '该教练暂未配置问卷', icon: 'none' })
          setTimeout(() => Taro.navigateBack(), 1200)
          return
        }

        setAnswers(normalizeQuestions(list, existingAnswers))
      } catch (error: any) {
        if (!mounted) return
        Taro.showToast({ title: error?.message || '获取问卷失败', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1200)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [coachId, existingAnswers])

  const updateAnswer = (index: number, field: keyof TrainingItem, value: any) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const navigateToPaymentWaiting = (params: {
    orderId: string
    amount: number
    initialStatus?: PaymentStatus | 'success' | 'cancelled' | 'failed'
  }) => {
    const query = [
      `orderId=${encodeURIComponent(params.orderId)}`,
      `amount=${encodeURIComponent(String(params.amount))}`,
      coachId ? `coachId=${encodeURIComponent(coachId)}` : '',
      'provider=wechat',
      params.initialStatus ? `initialStatus=${encodeURIComponent(params.initialStatus)}` : ''
    ].filter(Boolean).join('&')

    Taro.redirectTo({ url: `/me/payment-waiting/index?${query}` })
  }

  const startCoachPayment = async (newSubscriptionId: string) => {
    const payment = await createCoachWechatPayment({
      coachId,
      subscriptionId: newSubscriptionId,
      subject: `订阅教练 ${coachName}`.trim()
    })

    if (!payment.success || !payment.data?.orderId || !payment.data.paymentParams) {
      throw new Error(payment.message || '创建支付单失败，请稍后重试')
    }

    const paymentResult = await requestCoachWechatPayment(payment.data.paymentParams)
    navigateToPaymentWaiting({
      orderId: payment.data.orderId,
      amount: payment.data.amount,
      initialStatus: paymentResult.status === 'success' ? undefined : paymentResult.status
    })
  }

  const handleSubmit = async () => {
    if (submitting) return

    try {
      const incompleteIndexes = answers
        .map((item, index) => (isQuestionAnswered(item) ? -1 : index + 1))
        .filter((index) => index > 0)

      if (incompleteIndexes.length > 0) {
        const preview = incompleteIndexes.slice(0, 3).map((index) => `第${index}题`).join('、')
        const suffix = incompleteIndexes.length > 3 ? '等问题' : ''
        Taro.showToast({
          title: `${preview}${suffix}还未填写完整`,
          icon: 'none'
        })
        return
      }

      setSubmitting(true)

      if (mode === 'edit') {
        if (!subscriptionId) {
          throw new Error('缺少订阅信息，请返回重试')
        }

        const res = await subscriptionService.updateSubscription({
          id: subscriptionId,
          subscribe_data: answers
        })

        if (!(res as any)?.subscription) {
          throw new Error('问卷提交失败，请稍后重试')
        }

        Taro.showToast({ title: '问卷提交成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 800)
        return
      }

      if (!productId || !productTier || !months || !price) {
        throw new Error('套餐信息已失效，请重新选择')
      }

      let paymentSubscriptionId = subscriptionId
      if (paymentSubscriptionId) {
        const updated = await subscriptionService.updateSubscription({
          id: paymentSubscriptionId,
          subscribe_data: answers,
          product_id: productId,
          product_name: productName,
          product_tier: productTier,
          monthly_price: Math.round(price * 100),
          subscribed_weeks: months * 4
        })

        if (!(updated as any)?.subscription?.id) {
          throw new Error('更新订阅问卷失败，请稍后重试')
        }
      } else {
        const created = await subscriptionService.createSubscription({
          coachId,
          tier: productTier === 'basic' ? 1 : productTier === 'standard' ? 2 : 3,
          monthlyPrice: price,
          status: 'inactive',
          subscribeData: answers,
          productId,
          productName,
          productTier,
          subscribedWeeks: months * 4
        })

        const subscription = (created as any)?.subscription
        if (!subscription?.id) {
          throw new Error('创建订阅失败')
        }
        paymentSubscriptionId = subscription.id
      }

      await startCoachPayment(paymentSubscriptionId)
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='coach-questionnaire-page'>
      <ScrollView scrollY className='coach-questionnaire-scroll'>
        <View className='coach-questionnaire-content'>
          <View className='coach-questionnaire-hero'>
            <Text className='coach-questionnaire-badge'>
              {mode === 'edit' ? '更新资料' : '订阅前确认'}
            </Text>
            <Text className='coach-questionnaire-title'>
              {coachName ? `${coachName} 的训练需求问卷` : '训练需求问卷'}
            </Text>
            <Text className='coach-questionnaire-subtitle'>
              {mode === 'edit'
                ? '更新你的训练偏好和当前状态，方便教练继续调整计划。'
                : '先完成这份问卷，提交后会进入收银台完成支付。'}
            </Text>
            {mode === 'prepay' && (
              <View className='coach-questionnaire-product'>
                <Text>{productName || '所选套餐'}</Text>
                <Text>{months} 个月 · ¥{price.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View className='coach-questionnaire-loading'>
              <Skeleton animated rows={6} title visible={false} />
            </View>
          ) : answers.length === 0 ? (
            <View className='coach-questionnaire-empty'>
              <Text className='coach-questionnaire-empty-title'>暂时没有可填写的问题</Text>
              <Text className='coach-questionnaire-empty-text'>请返回上一页重新发起，或稍后再试。</Text>
            </View>
          ) : (
            <View className='coach-questionnaire-form'>
              {answers.map((item, index) => (
                <View key={item.id || `${item.type}-${index}`} className='question-item'>
                  <Text className='question-label'>
                    Q{index + 1}. {item.question || `问题 ${index + 1}`}
                  </Text>

                  {item.type === 'tags' && (
                    <View className='tags-options'>
                      {(item.options || []).map((option: any, optionIndex: number) => {
                        const optionLabel = getOptionLabel(option)
                        return (
                          <Checkbox
                            key={`${optionLabel}-${optionIndex}`}
                            checked={(item.userSelections || []).includes(optionLabel)}
                            onChange={(checked) => {
                              const selections = item.userSelections || []
                              const nextSelections = checked
                                ? [...selections, optionLabel]
                                : selections.filter((selection) => selection !== optionLabel)
                              updateAnswer(index, 'userSelections', nextSelections)
                            }}
                          >
                            {optionLabel}
                          </Checkbox>
                        )
                      })}
                    </View>
                  )}

                  {item.type === 'times' && (
                    <View className='times-options'>
                      {(item.options || [1, 2, 3, 4, 5, 6, 7]).map((option: any, optionIndex: number) => {
                        const value = typeof option === 'number' ? option : getOptionLabel(option)
                        return (
                          <Radio
                            key={`${value}-${optionIndex}`}
                            checked={item.userSelection === value}
                            onChange={() => updateAnswer(index, 'userSelection', value)}
                          >
                            {value}
                          </Radio>
                        )
                      })}
                    </View>
                  )}

                  {item.type === 'rm' && (
                    <View className='rm-inputs'>
                      <Text className='rm-hint'>请输入各动作的 RM 重量（kg）</Text>
                      {Object.keys(item.userInputs || {}).map((key) => (
                        <View key={key} className='rm-input-item'>
                          <Text className='rm-label'>{key}</Text>
                          <Input
                            type='number'
                            value={item.userInputs?.[key]?.toString() || ''}
                            onChange={(value) => {
                              const inputs = { ...(item.userInputs || {}) }
                              inputs[key] = value ? Number(value) : 0
                              updateAnswer(index, 'userInputs', inputs)
                            }}
                            placeholder='0'
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  {item.type === 'option' && (() => {
                    const selectionMode = item.selectionMode === 'multiple' ? 'multiple' : 'single'
                    const selectedOptions: number[] = Array.isArray(item.userSelections) ? item.userSelections : []
                    const isOtherSelected = item.allowOther && (
                      selectionMode === 'multiple'
                        ? selectedOptions.includes(-1)
                        : item.userSelection === -1
                    )

                    return (
                      <View className='option-group'>
                        {(item.options || []).map((option: any, optionIndex: number) => {
                          const optionLabel = getOptionLabel(option)
                          if (selectionMode === 'multiple') {
                            return (
                              <Checkbox
                                key={`opt-${optionIndex}`}
                                checked={selectedOptions.includes(optionIndex)}
                                onChange={(checked) => {
                                  const next = checked
                                    ? Array.from(new Set([...selectedOptions, optionIndex]))
                                    : selectedOptions.filter((v) => v !== optionIndex)
                                  updateAnswer(index, 'userSelections', next)
                                }}
                              >
                                {optionLabel}
                              </Checkbox>
                            )
                          }
                          return (
                            <Radio
                              key={`opt-${optionIndex}`}
                              checked={item.userSelection === optionIndex}
                              onChange={() => updateAnswer(index, 'userSelection', optionIndex)}
                            >
                              {optionLabel}
                            </Radio>
                          )
                        })}
                        {item.allowOther && (
                          <View className='option-other'>
                            {selectionMode === 'multiple' ? (
                              <Checkbox
                                checked={selectedOptions.includes(-1)}
                                onChange={(checked) => {
                                  const next = checked
                                    ? Array.from(new Set([...selectedOptions, -1]))
                                    : selectedOptions.filter((v) => v !== -1)
                                  updateAnswer(index, 'userSelections', next)
                                  if (!checked) updateAnswer(index, 'userOtherText', '')
                                }}
                              >
                                其他
                              </Checkbox>
                            ) : (
                              <Radio
                                checked={item.userSelection === -1}
                                onChange={() => updateAnswer(index, 'userSelection', -1)}
                              >
                                其他
                              </Radio>
                            )}
                            {isOtherSelected && (
                              <Input
                                className='other-input'
                                value={item.userOtherText || ''}
                                onChange={(value) => updateAnswer(index, 'userOtherText', value)}
                                placeholder='请输入补充内容'
                              />
                            )}
                          </View>
                        )}
                      </View>
                    )
                  })()}

                  {item.type === 'text' && (
                    <Input
                      value={item.userSelection?.toString() || ''}
                      onChange={(value) => updateAnswer(index, 'userSelection', value)}
                      placeholder='请输入答案'
                    />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View className='coach-questionnaire-footer'>
        <Button className='footer-btn' fill='outline' onClick={() => Taro.navigateBack()}>
          返回
        </Button>
        <Button
          className='footer-btn'
          type='primary'
          loading={submitting || loading}
          disabled={answers.length === 0}
          onClick={handleSubmit}
        >
          {mode === 'edit' ? '确认提交' : '确认并去支付'}
        </Button>
      </View>
    </View>
  )
}
