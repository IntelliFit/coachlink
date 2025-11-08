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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">训练计划</h1>
          <Button label="创建新计划" className="bg-primary-600 hover:bg-primary-700" />
        </div>
        
        {error ? (
          <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 p-4 rounded-lg">
            加载训练计划时出错: {error.message}
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan: any) => (
              <Card key={plan.id} title={plan.title} className="bg-white dark:bg-gray-800">
                <p className="text-gray-700 dark:text-gray-300 mb-4">{plan.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                  <Button label="查看详情" className="p-button-outlined p-button-sm" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">暂无训练计划</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              您还没有创建任何训练计划。点击下方按钮开始创建您的第一个AI训练计划。
            </p>
            <Button label="创建训练计划" className="bg-primary-600 hover:bg-primary-700" />
          </div>
        )}
      </div>
    </div>
  );
}