'use client';

import { useSession } from 'next-auth/react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { userService } from '../service/userService';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TrainingPage() {
    // 检查用户是否已认证
    const { data: session } = useSession();
    const router = useRouter();
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlans = async () => {
            if (!session?.user?.id) {
                return;
            }

            try {
                setLoading(true);
                const res = await userService.getTrainingPlans();
                if (res) {
                    setPlans(res.plans || []);
                }
            } catch (err: any) {
                setError(err.message || '获取训练计划失败');
            } finally {
                setLoading(false);
            }
        };

        if (session?.user?.id) {
            fetchPlans();
        }
    }, [session]);

    useEffect(() => {
        if (!session?.user?.id) {
            router.push('/login');
        }
    }, [session, router]);

    if (loading) {
        return (
            <div className="min-h-screen p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <Skeleton width="200px" height="36px" />
                        <Skeleton width="120px" height="40px" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(item => (
                            <Card key={item}>
                                <Skeleton width="100%" height="24px" className="mb-4" />
                                <Skeleton width="100%" height="16px" className="mb-2" />
                                <Skeleton width="100%" height="16px" className="mb-4" />
                                <div className="flex justify-between items-center">
                                    <Skeleton width="100px" height="20px" />
                                    <Skeleton width="100px" height="32px" />
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold">训练计划</h1>
                    <Button label="创建新计划" />
                </div>

                {error ? (
                    <div className="p-4 rounded-lg bg-red-100 text-red-700">
                        加载训练计划时出错: {error}
                    </div>
                ) : plans && plans.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map((plan: any) => (
                            <Card key={plan.id} title={plan.title}>
                                <p className="mb-4">{plan.description}</p>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">
                                        {new Date(plan.created_at).toLocaleDateString()}
                                    </span>
                                    <Button label="查看详情" className="p-button-outlined p-button-sm" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg shadow p-8 text-center">
                        <h2 className="text-xl font-semibold mb-2">暂无训练计划</h2>
                        <p className="mb-4">
                            您还没有创建任何训练计划。点击下方按钮开始创建您的第一个AI训练计划。
                        </p>
                        <Button label="创建训练计划" />
                    </div>
                )}
            </div>
        </div>
    );
}