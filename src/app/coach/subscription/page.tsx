'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';

export default function SubscriptionPage() {
    const subscriptionPlans = [
        {
            id: 1,
            name: '基础计划',
            price: '¥29.9',
            period: '/月',
            features: [
                '每周3次训练计划',
                '基础动作指导',
                '训练记录统计',
                '社区交流'
            ]
        },
        {
            id: 2,
            name: '高级计划',
            price: '¥59.9',
            period: '/月',
            features: [
                '每日个性化训练',
                '专业教练指导',
                '视频动作分析',
                '营养建议',
                '训练计划调整',
                '优先客服支持'
            ],
            popular: true
        },
        {
            id: 3,
            name: '尊享计划',
            price: '¥99.9',
            period: '/月',
            features: [
                '一对一私教服务',
                '定制化训练方案',
                '实时在线指导',
                '饮食计划定制',
                '定期身体评估',
                'VIP专属活动',
                '24小时客服支持'
            ]
        }
    ];

    const handleSubscribe = (planId: number) => {
        console.log(`订阅计划: ${planId}`);
        // 在实际应用中，这里会处理订阅逻辑
    };

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {subscriptionPlans.map((plan) => (
                    <Card 
                        key={plan.id} 
                        className={`shadow-md ${plan.popular ? 'ring-2 ring-primary scale-105' : ''}`}
                    >
                        {plan.popular && (
                            <div className="bg-primary text-white text-sm font-bold px-4 py-1 rounded-tl-md rounded-br-md -mt-6 -ml-6 mb-4 inline-block">
                                热门推荐
                            </div>
                        )}
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                            <div className="flex items-baseline justify-center">
                                <span className="text-3xl font-bold text-900">{plan.price}</span>
                                <span className="text-600 ml-1">{plan.period}</span>
                            </div>
                        </div>
                        
                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-center">
                                    <i className="pi pi-check-circle text-green-500 mr-2"></i>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        
                        <Button 
                            label={plan.popular ? "立即订阅" : "选择计划"} 
                            className={`w-full ${plan.popular ? 'p-button-primary' : 'p-button-secondary'}`}
                            onClick={() => handleSubscribe(plan.id)}
                        />
                    </Card>
                ))}
            </div>

            <div className="mt-12">
                <Card title="订阅管理">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <h4 className="font-bold">当前订阅</h4>
                                <p className="text-600">高级计划 - 到期时间: 2025年12月31日</p>
                            </div>
                            <Button label="续订" className="p-button-outlined" />
                        </div>
                        
                        <div className="flex justify-between items-center p-4 border rounded-lg">
                            <div>
                                <h4 className="font-bold">支付方式</h4>
                                <p className="text-600">支付宝 (尾号1234)</p>
                            </div>
                            <Button label="更改" className="p-button-outlined" />
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}