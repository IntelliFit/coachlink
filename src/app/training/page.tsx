import { requireAuth } from '@/lib/authService';
import { createServerSupabaseClient } from '@/lib/supabaseServerClient';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';

export default async function TrainingPage() {
    // 检查用户是否已认证
    const user = await requireAuth();

    // 创建服务端Supabase客户端
    const supabase = createServerSupabaseClient();

    // 获取用户的训练计划
    const { data: plans, error } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold">训练计划</h1>
                    <Button label="创建新计划" />
                </div>

                {error ? (
                    <div className="p-4 rounded-lg">
                        加载训练计划时出错: {error.message}
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