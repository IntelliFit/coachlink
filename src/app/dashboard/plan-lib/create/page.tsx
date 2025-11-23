'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';

const CreatePlanPage = () => {
    const router = useRouter();

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-900">创建训练计划</h1>
                    <Button 
                        label="返回" 
                        icon="pi pi-arrow-left" 
                        onClick={() => router.back()} 
                        className="p-button-text"
                    />
                </div>
                
                <div className="text-center py-12">
                    <i className="pi pi-file-edit text-600 text-5xl mb-4"></i>
                    <h2 className="text-xl font-semibold text-900 mb-2">训练计划创建向导</h2>
                    <p className="text-600 mb-6">在这里您可以创建个性化的训练计划模板</p>
                    
                    {/* TODO: 实现训练计划创建表单 */}
                    <div className="text-left bg-surface-100 p-4 rounded-lg mb-6">
                        <h3 className="font-medium text-900 mb-2">待实现功能：</h3>
                        <ul className="list-disc pl-5 text-600 space-y-1">
                            <li>训练计划基本信息设置（名称、描述、周期等）</li>
                            <li>按周/天安排训练内容</li>
                            <li>动作库选择和自定义动作</li>
                            <li>训练强度和容量设置</li>
                            <li>休息日和恢复安排</li>
                            <li>进度跟踪和调整机制</li>
                        </ul>
                    </div>
                    
                    <Button 
                        label="返回计划库" 
                        icon="pi pi-arrow-left" 
                        onClick={() => router.push('/dashboard/plan-lib')} 
                    />
                </div>
            </Card>
        </div>
    );
};

export default CreatePlanPage;