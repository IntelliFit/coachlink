'use client';

import React, { useEffect, useState } from 'react'
import { ArrowLeft, Calendar, Brain, PlusCircle, Timer, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import { trainingPlanService } from '@/app/service/userService';
import { useRef } from 'react';

interface PlanItem {
  id: string
  title: string
  description: string
  duration_weeks: number
  difficulty_level: string
  ai_generated: boolean
  created_at: string
}

const TrainingPlansHome: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const toast = useRef<Toast>(null);
  
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const data = await trainingPlanService.getTrainingPlans()
        setPlans(data?.plans || [])
      } catch (e) {
        setPlans([])
        toast.current?.show({
          severity: 'error',
          summary: '加载失败',
          detail: '无法加载训练计划列表，请稍后重试',
        });
      } finally {
        setLoading(false)
      }
    }
    
    if (session?.user?.id) load()
  }, [session?.user?.id])

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return '今天'
    if (diff === 1) return '昨天'
    return `${diff}天前`
  }

  const handleDeletePlan = async (planId: string, planTitle: string) => {
    const confirm = () => {
      return new Promise<boolean>((resolve) => {
        confirmDialog({
          message: `确定删除训练计划"${planTitle}"吗？该操作不可恢复。`,
          header: '删除确认',
          icon: 'pi pi-exclamation-triangle',
          acceptLabel: '确认删除',
          rejectLabel: '取消',
          accept: () => resolve(true),
          reject: () => resolve(false)
        });
      });
    };

    if (await confirm()) {
      try {
        await trainingPlanService.deleteTrainingPlan(planId);
        setPlans(prev => prev.filter(p => p.id !== planId));
        toast.current?.show({
          severity: 'success',
          summary: '删除成功',
          detail: '训练计划已成功删除',
        });
      } catch (e) {
        toast.current?.show({
          severity: 'error',
          summary: '删除失败',
          detail: '删除训练计划失败，请稍后重试',
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Toast ref={toast} />
      <ConfirmDialog />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Button 
              icon="pi pi-arrow-left" 
              className="p-button-rounded p-button-text" 
              onClick={() => router.back()} 
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI智能训练计划</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">基于规则引擎 + AI增强的个性化方案</p>
            </div>
          </div>
          <Button 
            label="生成新计划" 
            icon="pi pi-plus" 
            className="p-button-primary"
            onClick={() => router.push('/training')}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
          </div>
        ) : plans.length === 0 ? (
          <Card className="text-center py-8">
            <Brain className="w-12 h-12 text-primary-500 dark:text-primary-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">还没有训练计划</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">点击下方按钮创建你的第一份个性化训练计划</p>
            <Button 
              label="生成新计划" 
              className="p-button-primary"
              onClick={() => router.push('/training')}
            />
          </Card>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className="shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 mb-4 md:mb-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{plan.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{plan.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{plan.duration_weeks}周</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Timer className="w-4 h-4" />
                        <span>{getRelativeTime(plan.created_at)}</span>
                      </div>
                      {plan.ai_generated && (
                        <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs inline-flex items-center">
                          <Zap className="w-3 h-3 mr-1"/>AI生成
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      label="查看/开始" 
                      className="p-button-primary"
                      onClick={() => router.push(`/training/${plan.id}`)}
                    />
                    <Button 
                      label="删除" 
                      className="p-button-danger"
                      onClick={() => handleDeletePlan(plan.id, plan.title)}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TrainingPlansHome