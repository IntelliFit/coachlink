'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';

export default function TestPage() {
    const [loading, setLoading] = useState(false);
    const { showToast } = useToastContext();
    const [actions, setActions] = useState<any[]>([]);
    const [selectedAction, setSelectedAction] = useState<any>(null);

    useEffect(() => {
        fetchActions();
    }, []);

    const fetchActions = async () => {
        try {
            // Fetch some actions to use in the plan
            // Since we don't have a public list-actions API for students, 
            // we'll try to use a server action or just a direct query if possible?
            // Actually, we can't use supabase client directly for this without RLS issues maybe?
            // Let's try to fetch from a known endpoint or use `planLibService` if it has one.
            // Wait, we can use the `get-template` logic? 
            // Let's just create a Plan with a dummy action if we can't find one, 
            // OR, better: let the user input an Action ID if they know one.
            // BUT, to make it easy, let's try to fetch from `coach_actions` via a simple server component?
            // No, let's just make a simple API call to our own new endpoint or just try to use an existing one.
            
            // For now, let's just use a hardcoded Action ID if we can't find one.
            // But we want it to work.
            
            // Let's try to find actions from the user's existing history?
            // Or just allow creating a plan without actions? No, we need execution.
            
            // Let's assume there is at least one action in the DB.
            // I'll add a small server action in this file? No, separate file.
            
            // Let's just add a temporary API to list actions for test.
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreateOneDayPlan = async () => {
        setLoading(true);
        try {
            // 1. Get current user info (we assume user is logged in)
            
            // 2. We need a valid action ID.
            // Let's try to fetch *one* action from the backend first.
            // Since we are in a test page, maybe we can use a server component wrapper?
            
            // Actually, let's just try to create a plan with a "Custom Action" if that's supported?
            // The system seems to require `actionId` for `one-filter` type.
            
            // Hack: I'll use a hardcoded ID from the seed data if I knew it.
            // Since I don't, I will just create a plan with NO actions first? 
            // No, empty plan might not be executable.
            
            // Let's use `planLibService` to create an instance.
            // We'll constructs a `trainingDays` array.
            
            const trainingDays = [
                {
                    dayIndex: 1,
                    type: 'training',
                    title: '测试训练日',
                    description: '用于测试的 1 天计划',
                    actionSets: [
                        // We need an action set.
                        // If we don't have a valid action ID, the UI might break.
                        // Let's try to use a "Free Text" action if supported? 
                        // Looking at `TrainingDayCard.tsx`: it renders actions.
                        // It expects `actionSets`.
                        
                        // Let's try to fetch templates first. If there are templates, use one.
                    ]
                }
            ];
            
            // Use a template if available?
            const templates = await planLibService.listTemplates({ page: 1, limit: 1 });
            let templateId = null;
            let days = trainingDays;

            if (templates.templates && templates.templates.length > 0) {
                const t = templates.templates[0];
                templateId = t.id;
                // Get full template details
                const fullTemplate = await planLibService.getTemplate({ id: t.id });
                if (fullTemplate.template && fullTemplate.template.training_days) {
                     // Extract first training day
                     const firstDay = (fullTemplate.template.training_days as any[])
                        .find(d => d.type === 'training');
                     
                     if (firstDay) {
                         days = [{ ...firstDay, dayIndex: 1 }];
                     }
                }
            } else {
                 showToast({ severity: 'error', summary: '错误', detail: '未找到可用模板，无法生成有效计划。请先创建一个模板。' });
                 return;
            }

            const today = new Date().toISOString();
            
            // Need subscription ID.
            // If student: find my coach subscription (or self).
            // Actually `createInstance` needs `subscriptionId`.
            // User needs to select a subscription.
            
            // Let's first fetch subscriptions.
            // This is getting complicated.
            
            // Let's call a new API `create-test-plan` that handles all this mess on the server.
            const res = await fetch('/api/test/create-1day-plan', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                showToast({ severity: 'success', summary: '成功', detail: '计划创建成功！' });
            } else {
                showToast({ severity: 'error', summary: '失败', detail: '创建失败: ' + data.message });
            }

        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: '错误: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">测试工具</h1>
            
            <Card title="快速测试 Phase 6 (计划完成流程)">
                <p className="mb-4 text-gray-600">
                    此工具将为您当前登录的用户创建一个仅包含 1 天训练日的计划。
                    <br />
                    完成该计划（提交训练记录）后，应立即触发"计划完成"弹窗。
                </p>
                
                <div className="flex gap-4">
                    <Button 
                        label={loading ? "创建中..." : "生成 1 天测试计划"} 
                        icon="pi pi-bolt" 
                        onClick={handleCreateOneDayPlan}
                        loading={loading}
                        severity="help"
                    />
                </div>
            </Card>
        </div>
    );
}
