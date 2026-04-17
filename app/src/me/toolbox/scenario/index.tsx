import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { getScenarioQuickFix, type ScenarioQuickFix } from '@/constants/scenarioQuickFixes'
import './index.scss'

export default function ScenarioDetailPage() {
  const router = useRouter()
  const slug = String(router.params?.slug || '')
  const [scenario, setScenario] = useState<ScenarioQuickFix | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

  useEffect(() => {
    setScenario(getScenarioQuickFix(slug))
  }, [slug])

  const handleBack = () => {
    Taro.navigateBack().catch(() => {
      Taro.switchTab({ url: '/me/profile/index' })
    })
  }

  const startFlow = () => {
    setCurrentStepIndex(0)
    setCompletedSteps([])
  }

  const handleStepComplete = (stepId: string) => {
    setCompletedSteps((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]))
    if (!scenario || currentStepIndex == null) {
      setCurrentStepIndex(null)
      return
    }
    if (currentStepIndex < scenario.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1)
    } else {
      setCurrentStepIndex(null)
    }
  }

  if (!scenario) {
    return (
      <View className='scenario-page'>
        <View className='nav-bar'>
          <Text className='nav-back' onClick={handleBack}>返回</Text>
          <Text className='nav-title'>场景急救箱</Text>
        </View>
        <View className='empty-wrap'>
          <Text className='empty-title'>未找到该场景</Text>
          <Text className='empty-desc'>这个场景可能还没有迁入小程序。</Text>
        </View>
      </View>
    )
  }

  const currentStep = currentStepIndex != null ? scenario.steps[currentStepIndex] : null
  const finished = completedSteps.length === scenario.steps.length && scenario.steps.length > 0

  return (
    <View className='scenario-page'>
      <View className='nav-bar'>
        <Text className='nav-back' onClick={handleBack}>返回</Text>
        <Text className='nav-title'>{scenario.title}</Text>
      </View>

      <ScrollView scrollY className='scenario-scroll'>
        <View className='page-content'>
          <View className='hero-card'>
            <Text className='hero-icon'>{scenario.icon}</Text>
            <Text className='hero-title'>{scenario.title}</Text>
            <Text className='hero-desc'>{scenario.description}</Text>
            <Text className='hero-meta'>约 {scenario.durationMinutes} 分钟 · 共 {scenario.steps.length} 步</Text>
          </View>

          {!currentStep && !finished && (
            <View className='primary-btn' onClick={startFlow}>
              <Text>开始练习</Text>
            </View>
          )}

          {currentStep && (
            <View className='current-step-card'>
              <Text className='current-step-meta'>第 {currentStepIndex! + 1} 步 · {currentStep.durationSeconds} 秒</Text>
              <Text className='current-step-title'>{currentStep.title}</Text>
              <Text className='current-step-desc'>{currentStep.description}</Text>
              <View className='current-step-btn' onClick={() => handleStepComplete(currentStep.id)}>
                <Text>完成此步骤</Text>
              </View>
            </View>
          )}

          <View className='steps-section'>
            <Text className='section-title'>全部步骤</Text>
            <View className='steps-list'>
              {scenario.steps.map((step, index) => {
                const isCompleted = completedSteps.includes(step.id)
                const isCurrent = currentStepIndex === index
                return (
                  <View
                    key={step.id}
                    className={`step-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                  >
                    <View className='step-index'>
                      <Text>{isCompleted ? '✓' : index + 1}</Text>
                    </View>
                    <View className='step-main'>
                      <Text className='step-title'>{step.title}</Text>
                      <Text className='step-desc'>{step.description}</Text>
                    </View>
                    <Text className='step-duration'>{step.durationSeconds}s</Text>
                  </View>
                )
              })}
            </View>
          </View>

          {finished && (
            <View className='done-card'>
              <Text className='done-icon'>🎉</Text>
              <Text className='done-title'>练习完成</Text>
              <Text className='done-desc'>这类“场景急救箱”已经开始从 Web 端迁到小程序，可以直接拿来用。</Text>
              <View className='primary-btn' onClick={handleBack}>
                <Text>返回工具箱</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
