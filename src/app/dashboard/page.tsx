import { getCurrentUser, requireAuth } from '@/lib/authService';
import { createServerSupabaseClient } from '@/lib/supabaseServerClient';
import { redirect } from 'next/navigation';
import { Button } from 'primereact/button';

export default async function DashboardPage() {
    // 检查用户是否已认证
    const user = await requireAuth();

    // 创建服务端Supabase客户端
    const supabase = createServerSupabaseClient();

    // 获取用户资料
    let profile = null;
    if (user) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!error) {
            profile = data;
        }
    }

    // 登出功能
    const handleLogout = async () => {
        'use server';
        const supabase = createServerSupabaseClient();
        await supabase.auth.signOut();
        redirect('/login');
    };

    return (
        <div className="min-h-screen">
            <main className="p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <h1 className="text-2xl md:text-3xl font-bold">仪表板</h1>
                        <form action={handleLogout}>
                            <Button
                                type="submit"
                                label="登出"
                                className="p-button-outlined"
                            />
                        </form>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold mb-4">欢迎</h2>
                            <p>
                                欢迎回来, {profile?.full_name || user?.email}!
                            </p>
                        </div>

                        <div className="rounded-lg shadow p-6 md:col-span-2">
                            <h2 className="text-xl font-semibold mb-4">快速访问</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <a href="/training" className="p-4 border rounded-lg text-center hover:bg-gray-50 cursor-pointer block">
                                    <h3 className="font-medium">AI训练计划</h3>
                                    <p className="text-sm mt-1">创建个性化训练</p>
                                </a>
                                <a href="/coach" className="p-4 border rounded-lg text-center hover:bg-gray-50 cursor-pointer block">
                                    <h3 className="font-medium">教练</h3>
                                    <p className="text-sm mt-1">查看教练资料</p>
                                </a>
                                <a href="/ranking" className="p-4 border rounded-lg text-center hover:bg-gray-50 cursor-pointer block">
                                    <h3 className="font-medium">排行榜</h3>
                                    <p className="text-sm mt-1">查看运动排名</p>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}