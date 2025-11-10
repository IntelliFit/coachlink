import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeft, Calendar, Brain, PlusCircle, Timer, Zap } from 'lucide-react'

interface TrainingPlansHomeProps {
  userId: string
  coachId?: string
  onBack: () => void
  onCreateNew: () => void
  onOpenPlan: (planId: string) => void
}

interface PlanItem {
  id: string
  title: string
  description: string
  duration_weeks: number
  difficulty_level: string
  ai_generated: boolean
  created_at: string
}

const TrainingPlansHome: React.FC<TrainingPlansHomeProps> = ({ userId, coachId, onBack, onCreateNew, onOpenPlan }) => {
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        let query = supabase
          .from('training_plans')
          .select('id, title, description, duration_weeks, difficulty_level, ai_generated, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (coachId) query = query.eq('coach_id', coachId)

        const { data, error } = await query
        if (error) throw error
        setPlans(data || [])
      } catch (e) {
        setPlans([])
      } finally {
        setLoading(false)
      }
    }
    if (userId) load()
  }, [userId, coachId])

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return '今天'
    if (diff === 1) return '昨天'
    return `${diff}天前`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI智能训练计划</h1>
              <p className="text-gray-600 text-sm">基于规则引擎 + AI增强的个性化方案</p>
            </div>
          </div>
          <button onClick={onCreateNew} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <PlusCircle className="w-5 h-5 mr-2" />
            生成新计划
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Brain className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">还没有训练计划</h3>
            <p className="text-gray-600 mb-6">点击下方按钮创建你的第一份个性化训练计划</p>
            <button onClick={onCreateNew} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              生成新计划
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.title}</h3>
                    <p className="text-gray-600 mb-3">{plan.description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1"><Calendar className="w-4 h-4" /><span>{plan.duration_weeks}周</span></div>
                      <div className="flex items-center space-x-1"><Timer className="w-4 h-4" /><span>{getRelativeTime(plan.created_at)}</span></div>
                      {plan.ai_generated && (
                        <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs inline-flex items-center"><Zap className="w-3 h-3 mr-1"/>AI生成</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => onOpenPlan(plan.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">查看/开始</button>
                    <button
                      onClick={async () => {
                        const ok = confirm('确定删除该训练计划吗？该操作不可恢复');
                        if (!ok) return;
                        try {
                          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-training-plan`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ training_plan_id: plan.id, user_id: userId })
                          });
                          const json = await resp.json();
                          if (!resp.ok || !json?.success) throw new Error(json?.message || '删除失败');
                          // 重新加载
                          setPlans(prev => prev.filter(p => p.id !== plan.id));
                        } catch (e) {
                          alert('删除失败，请稍后重试');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TrainingPlansHome


