'use client';

import React, { useEffect, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Toast } from 'primereact/toast';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';

import AdminPullupRecordForm from '@/components/admin/AdminPullupRecordForm'; // [新增] 导入我们的新表单模态框
import AdminLotteryModal from '@/components/lottery/AdminLotteryModal'; // [新增] 导入管理员抽奖模态框
import LotteryResultModal from '@/components/lottery/LotteryResultModal'; // [新增] 导入抽奖结果模态框

import {
    Trophy,
    Calendar,
    Users,
    Award,
    Target,
    Video,
    Star,
    Gift,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Info,
    Crown,
    Medal,
    Zap,
    Gamepad2
} from 'lucide-react';
import { useToastContext } from '@/components/ToastContext';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { rankingService } from '@/app/service/rankingService';

// 定义排行榜记录类型
interface LeaderboardRecord {
    rank: number;
    id: string;
    name: string;
    gender: string;
    weight_kg: number;
    video_url: string | null;
    created_at: string;
    notes: string | null;
}

// 辅助函数，用于将英文的性别转换为中文
const formatGender = (gender: string | null): string => {
    if (gender === 'male') return '男';
    if (gender === 'female') return '女';
    return '未知';
};

// 获取排名徽章样式
const getRankBadge = (rank: number) => {
    if (rank === 1) {
        return {
            bgColor: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
            icon: <Crown className="w-4 h-4" />,
            text: '🏆 王者',
            title: '国内顶尖'
        };
    } else if (rank === 2) {
        return {
            bgColor: 'bg-gradient-to-r from-gray-300 to-gray-500',
            icon: <Medal className="w-4 h-4" />,
            text: '🥈 亚军',
            title: '国内顶尖'
        };
    } else if (rank === 3) {
        return {
            bgColor: 'bg-gradient-to-r from-amber-600 to-amber-800',
            icon: <Medal className="w-4 h-4" />,
            text: '🥉 季军',
            title: '国内顶尖'
        };
    } else if (rank <= 10) {
        return {
            bgColor: 'bg-gradient-to-r from-purple-400 to-purple-600',
            icon: <Star className="w-4 h-4" />,
            text: `#${rank}`,
            title: '国内顶尖'
        };
    } else if (rank <= 20) {
        return {
            bgColor: 'bg-gradient-to-r from-blue-400 to-blue-600',
            icon: <Award className="w-4 h-4" />,
            text: `#${rank}`,
            title: '国服一线'
        };
    } else {
        return {
            bgColor: 'bg-gray-200',
            icon: null,
            text: `#${rank}`,
            title: null
        };
    }
};

const PullupLeaderboardPage: React.FC = () => {
    const [records, setRecords] = useState<LeaderboardRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const { showToast } = useToastContext();
    const router = useRouter();
    const { data: session } = useSession();

    // [新增] 状态来控制编辑模态框
    // editingRecord 存储了当前正在被编辑的记录对象
    const [editingRecord, setEditingRecord] = useState<LeaderboardRecord | null>(null);
    const [isAdding, setIsAdding] = useState<boolean>(false); // 控制"添加"模态框的显示

    // [新增] 抽奖相关状态
    const [showLottery, setShowLottery] = useState<boolean>(false);
    const [lotteryResult, setLotteryResult] = useState<any>(null);

    // [新增] 用户提交相关状态
    const [showUserSubmission, setShowUserSubmission] = useState<boolean>(false);
    const [submissionData, setSubmissionData] = useState({
        weight_kg: '',
        gender: '',
        video_url: '',
        douyin_nickname: '',
        notes: ''
    });
    const [submissionLoading, setSubmissionLoading] = useState<boolean>(false);

    // --- 数据获取函数 ---
    const fetchLeaderboard = async () => {
        // 每次获取数据时，都确保 editingRecord 是关闭的
        // setEditingRecord(null);
        setLoading(true);

        try {
            // [修改] 使用服务层调用替代直接的 supabase 调用
            // TODO: 实现通过服务层获取排行榜数据
            const res = await rankingService.getLeaderboard({ leaderboardType: 'pullup' });
            if (res) {
                setRecords(res.data || []);
            }

            setLoading(false);
        } catch (err: any) {
            console.error('获取排行榜数据失败:', err);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '获取排行榜数据失败，请稍后再试',
                life: 3000
            });
            setLoading(false);
        }
    };

    // --- 组件加载时获取数据 ---
    useEffect(() => {
        fetchLeaderboard();
    }, []);

    // --- [修改] 将回调函数重命名为一个更通用的名字 ---
    const handleFormSuccess = (mode: 'add' | 'edit') => {
        setIsAdding(false);       // 确保添加模态框被关闭
        setEditingRecord(null);   // 确保编辑模态框被关闭
        fetchLeaderboard();       // 重新加载数据
        showToast({
            severity: 'success',
            summary: '成功',
            detail: `记录已成功${mode === 'edit' ? '更新' : '添加'}！`,
            life: 3000
        });
    };

    // --- [新增] 抽奖相关处理函数 ---
    const handleLotteryComplete = (result: any) => {
        setLotteryResult(result);
        setShowLottery(false);
        // 可以在这里添加保存抽奖结果到数据库的逻辑
        console.log('抽奖结果:', result);
    };

    const handleCloseLottery = () => {
        setShowLottery(false);
    };

    const handleCloseResult = () => {
        setLotteryResult(null);
    };

    // [新增] 处理打开用户提交表单
    const handleOpenUserSubmission = () => {
        // [修改] 检查用户是否已登录
        if (!session) {
            showToast({
                severity: 'warn',
                summary: '警告',
                detail: '请先登录后再提交记录。',
                life: 3000
            });
            router.push('/login');
            return;
        }

        // 如果已登录，打开表单
        setSubmissionData({
            weight_kg: '',
            gender: '',
            video_url: '',
            douyin_nickname: '',
            notes: ''
        });
        setShowUserSubmission(true);
    };

    // [新增] 用户提交记录处理函数
    const handleUserSubmission = async () => {
        setSubmissionLoading(true);
        try {
            // [修改] 使用服务层提交记录替代直接的 supabase 调用
            // TODO: 实现通过服务层提交用户记录
            const res = await rankingService.submitRecord('', {
                weight_kg: parseFloat(submissionData.weight_kg),
                gender: submissionData.gender,
                video_url: submissionData.video_url || null,
                douyin_nickname: submissionData.douyin_nickname,
                notes: submissionData.notes || null
            });

            if (res) {
                showToast({
                    severity: 'success',
                    summary: '成功',
                    detail: '提交成功！您的记录正在等待管理员审核。',
                    life: 3000
                });
            }
            
            setShowUserSubmission(false);

            setSubmissionData({
                weight_kg: '',
                gender: '',
                video_url: '',
                douyin_nickname: '',
                notes: ''
            });
            fetchLeaderboard();
        } catch (error: any) {
            console.error('提交失败:', error);

            // 更详细的错误处理
            let errorMessage = '提交失败: ';
            if (error.message?.includes('JWT')) {
                errorMessage += '登录状态已过期，请重新登录';
            } else if (error.message?.includes('network')) {
                errorMessage += '网络连接问题，请检查网络后重试';
            } else {
                errorMessage += (error.message || '未知错误');
            }

            alert(errorMessage);
        } finally {
            setSubmissionLoading(false);
        }
    };

    const handleCloseUserSubmission = () => {
        setShowUserSubmission(false);
        setSubmissionData({
            weight_kg: '',
            gender: '',
            video_url: '',
            douyin_nickname: '',
            notes: ''
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* 页面头部 */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                            <button
                                className="mr-4 text-blue-100 hover:text-white transition-colors"
                                onClick={() => router.push('/ranking')}
                            >
                                ← 返回
                            </button>
                            <div>
                                <h1 className="text-4xl font-bold mb-2">🏆 负重引体之王</h1>
                                <p className="text-blue-100 text-lg">月度排行榜挑战赛</p>
                            </div>
                        </div>

                        {/* 按钮组 */}
                        <div className="flex space-x-4">
                            {/* 用户按钮组 - 所有登录用户都可以看到 */}
                            {session && (
                                <>
                                    <button
                                        onClick={handleOpenUserSubmission}
                                        className="bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-green-600 transition-all transform hover:scale-105"
                                    >
                                        <Trophy className="w-5 h-5 inline mr-2" />
                                        提交我的记录
                                    </button>

                                    <button
                                        onClick={() => router.push('/user-submissions')}
                                        className="bg-blue-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-600 transition-all transform hover:scale-105"
                                    >
                                        <Users className="w-5 h-5 inline mr-2" />
                                        我的提交
                                    </button>
                                </>
                            )}

                            {/* 管理员按钮组 */}
                            {session?.user.is_admin && (
                                <>
                                    <button
                                        onClick={() => setIsAdding(true)}
                                        className="bg-white text-blue-600 font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-50 transition-all transform hover:scale-105"
                                    >
                                        <Zap className="w-5 h-5 inline mr-2" />
                                        添加新记录
                                    </button>

                                    <button
                                        onClick={() => router.push('/admin-review')}
                                        className="bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-yellow-600 transition-all transform hover:scale-105"
                                    >
                                        <CheckCircle className="w-5 h-5 inline mr-2" />
                                        审核记录
                                    </button>

                                    <button
                                        onClick={() => setShowLottery(true)}
                                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:from-orange-600 hover:to-red-600 transition-all transform hover:scale-105"
                                    >
                                        <Gamepad2 className="w-5 h-5 inline mr-2" />
                                        管理员抽奖
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 活动信息卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                            <div className="flex items-center mb-3">
                                <Calendar className="w-6 h-6 mr-3" />
                                <h3 className="text-lg font-semibold">活动时间</h3>
                            </div>
                            <p className="text-blue-100">永久有效</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                            <div className="flex items-center mb-3">
                                <Users className="w-6 h-6 mr-3" />
                                <h3 className="text-lg font-semibold">参与人数</h3>
                            </div>
                            <p className="text-blue-100">{records.length} 位挑战者</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                            <div className="flex items-center mb-3">
                                <Trophy className="w-6 h-6 mr-3" />
                                <h3 className="text-lg font-semibold">发起人</h3>
                            </div>
                            <p className="text-blue-100">刘三乐（17项吉尼斯世界纪录保持者）</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* 活动介绍和规则 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* 活动介绍 */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center mb-4">
                            <Star className="w-6 h-6 text-yellow-500 mr-3" />
                            <h2 className="text-2xl font-bold text-gray-800">活动介绍</h2>
                        </div>
                        <div className="space-y-4 text-gray-600">
                            <p>🏆 <strong>负重引体之王</strong>是由17项吉尼斯世界纪录保持者刘三乐发起的月度挑战赛，旨在推广负重引体向上运动，激励更多人挑战自我极限。</p>
                            <p>📱 参与者需要在抖音平台发布挑战视频，并带话题 <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">#bannydeer旗舰店</span> 和 <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">#刘三乐挑战</span></p>
                            <p>🎯 挑战者需要在 @刘三乐 或 @枭马葛 的排行榜视频评论区留言成绩，格式为："成绩：XX公斤"</p>
                        </div>
                    </div>

                    {/* 评判标准 */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center mb-4">
                            <Target className="w-6 h-6 text-red-500 mr-3" />
                            <h2 className="text-2xl font-bold text-gray-800">评判标准</h2>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="flex items-start">
                                <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-gray-800">一镜到底</h4>
                                    <p className="text-gray-600 text-sm">视频必须连续拍摄，禁止任何剪辑</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-gray-800">动作标准</h4>
                                    <p className="text-gray-600 text-sm">起始手臂完全伸直，拉至下巴明确过杠</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <XCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-gray-800">严禁借力</h4>
                                    <p className="text-gray-600 text-sm">全程无甩、踢、蹬等明显借力动作</p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <AlertTriangle className="w-5 h-5 text-orange-500 mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="font-semibold text-gray-800">称重要求</h4>
                                    <p className="text-gray-600 text-sm">负重60公斤及以上需拍摄称重视频</p>
                                </div>
                            </div>
                        </div>

                        {/* 标准视频区域 */}
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📹 标准视频参考</h3>

                            {/* 标准讲解和正确示范 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        标准讲解
                                    </h4>
                                    <a
                                        href="https://www.douyin.com/user/self?modal_id=7526931817863023929"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                                    >
                                        <Video className="w-4 h-4 mr-2" />
                                        观看讲解
                                    </a>
                                </div>

                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        正确示范
                                    </h4>
                                    <a
                                        href="https://www.douyin.com/user/self?modal_id=7523959345571564859"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                                    >
                                        <Video className="w-4 h-4 mr-2" />
                                        观看示范
                                    </a>
                                </div>
                            </div>

                            {/* 错误示范 */}
                            <div>
                                <h4 className="font-semibold text-red-800 mb-3 flex items-center">
                                    <XCircle className="w-4 h-4 mr-2" />
                                    错误示范（请避免）
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                        <h5 className="font-medium text-red-800 mb-2">❌ 屈臂启动</h5>
                                        <a
                                            href="https://www.douyin.com/user/self?modal_id=7443830656678858047"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                                        >
                                            <Video className="w-3 h-3 mr-1" />
                                            观看
                                        </a>
                                    </div>

                                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                        <h5 className="font-medium text-red-800 mb-2">❌ 直臂但未完全静止</h5>
                                        <a
                                            href="https://www.douyin.com/user/self?modal_id=7519095908417408316"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                                        >
                                            <Video className="w-3 h-3 mr-1" />
                                            观看
                                        </a>
                                    </div>

                                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                        <h5 className="font-medium text-red-800 mb-2">❌ 幅度不够，建议正面视角</h5>
                                        <a
                                            href="https://www.douyin.com/user/self?modal_id=7339166518376221991&showSubTab=video"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                                        >
                                            <Video className="w-3 h-3 mr-1" />
                                            观看
                                        </a>
                                    </div>

                                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                        <h5 className="font-medium text-red-800 mb-2">❌ 屈腿借力</h5>
                                        <a
                                            href="https://www.douyin.com/user/self?modal_id=7412606417221258550&showSubTab=video"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs"
                                        >
                                            <Video className="w-3 h-3 mr-1" />
                                            观看
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 奖品设置 */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl shadow-lg p-6 mb-8">
                    <div className="flex items-center mb-4">
                        <Gift className="w-6 h-6 text-white mr-3" />
                        <h2 className="text-2xl font-bold text-white">7月奖品设置</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-white mb-2">🏆 固定奖励</h3>
                            <ul className="text-white/90 space-y-1">
                                <li>• 前3名：肌酸×3包 + 螯合物锌镁片×1罐</li>
                                <li>• 前20名：每人肌酸×3包</li>
                            </ul>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-white mb-2">🎲 抽奖环节</h3>
                            <ul className="text-white/90 space-y-1">
                                <li>• 前20名内：可抽取蛋白粉×1桶</li>
                                <li>• 20名外：也可参与抽取蛋白粉×1桶</li>
                                <li>• 管理员负责抽奖并联系获奖者</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 排行榜标题 */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">🏅 实时排行榜</h2>
                    <p className="text-gray-600">挑战自我，突破极限，成为负重引体之王！</p>
                </div>

                {/* 排行榜表格 */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
                    </div>
                ) : records.length === 0 ? (
                    <div className="text-center py-12">
                        <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">暂无排行榜数据</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">排名</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">挑战者</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">性别</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">负重重量</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">训练视频</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">动作评估</th>
                                        {session?.user.is_admin && <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">管理</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {records.map((record) => {
                                        const rankBadge = getRankBadge(record.rank);
                                        return (
                                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                                {/* 排名 */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className={`${rankBadge.bgColor} text-white font-bold rounded-full h-10 w-10 flex items-center justify-center shadow-lg`}>
                                                            {rankBadge.icon || record.rank}
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900">{rankBadge.text}</div>
                                                            {rankBadge.title && (
                                                                <div className={`text-xs font-medium px-2 py-1 rounded-full mt-1 ${rankBadge.title === '国内顶尖'
                                                                    ? 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-300'
                                                                    : 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300'
                                                                    }`}>
                                                                    {rankBadge.title}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 挑战者姓名 */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-lg font-semibold text-gray-900">{record.name}</div>
                                                </td>

                                                {/* 性别 */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${record.gender === 'male'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-pink-100 text-pink-800'
                                                        }`}>
                                                        {formatGender(record.gender)}
                                                    </span>
                                                </td>

                                                {/* 负重重量 */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-2xl font-bold text-gray-900">{record.weight_kg}</div>
                                                    <div className="text-sm text-gray-500">公斤</div>
                                                </td>

                                                {/* 训练视频 */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.video_url ? (
                                                        <a
                                                            href={record.video_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                        >
                                                            <Video className="w-4 h-4 mr-2" />
                                                            观看视频
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400">无视频</span>
                                                    )}
                                                </td>

                                                {/* 动作评估 */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-600 max-w-xs">
                                                        {record.notes || '暂无评估'}
                                                    </div>
                                                </td>

                                                {/* 管理员操作 */}
                                                {session?.user.is_admin && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button
                                                            onClick={() => setEditingRecord(record)}
                                                            className="text-indigo-600 hover:text-indigo-900 hover:underline"
                                                        >
                                                            编辑
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 活动说明 */}
                <div className="mt-8 bg-blue-50 rounded-2xl p-6">
                    <div className="flex items-center mb-4">
                        <Info className="w-6 h-6 text-blue-500 mr-3" />
                        <h3 className="text-xl font-semibold text-gray-800">特别说明</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                        <div>
                            <p><strong>女性参赛者：</strong>最终成绩可乘以1.5倍计算</p>
                            <p><strong>称重要求：</strong>负重60公斤及以上需要拍摄称重视频</p>
                        </div>
                        <div>
                            <p><strong>相关抖音号：</strong>@bannydeer官方旗舰店 @刘三乐 @枭马葛</p>
                            <p><strong>活动解释权：</strong>归主办方所有</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 条件渲染"添加"模态框 */}
            {isAdding && (
                <AdminPullupRecordForm
                    onSubmitSuccess={handleFormSuccess} // <-- [修改] 正确调用
                    onCancel={() => setIsAdding(false)}
                />
            )}

            {/* 条件渲染"编辑"模态框 */}
            {editingRecord && (
                <AdminPullupRecordForm
                    recordToEdit={editingRecord}
                    onSubmitSuccess={handleFormSuccess} // <-- [修改] 正确调用
                    onCancel={() => setEditingRecord(null)}
                />
            )}

            {/* [新增] 管理员抽奖模态框 */}
            {showLottery && (
                <AdminLotteryModal
                    isOpen={showLottery}
                    onClose={handleCloseLottery}
                    onLotteryComplete={handleLotteryComplete}
                    leaderboardData={records}
                />
            )}

            {/* [新增] 抽奖结果模态框 */}
            {lotteryResult && (
                <LotteryResultModal
                    isOpen={!!lotteryResult}
                    onClose={handleCloseResult}
                    result={lotteryResult}
                />
            )}

            {/* [新增] 用户提交记录模态框 */}
            {showUserSubmission && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">提交我的记录</h2>
                                <button
                                    onClick={handleCloseUserSubmission}
                                    className="text-gray-400 hover:text-gray-600 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); handleUserSubmission(); }} className="space-y-4">
                                {/* 用户昵称 */}
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">
                                        用户昵称 *
                                    </label>
                                    <div className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-700">
                                        {submissionData.douyin_nickname}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">昵称将自动使用您的个人资料信息</p>
                                </div>

                                {/* 性别 */}
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">
                                        性别 *
                                    </label>
                                    <select
                                        value={submissionData.gender}
                                        onChange={(e) => setSubmissionData({ ...submissionData, gender: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        required
                                    >
                                        <option value="">请选择性别</option>
                                        <option value="male">男</option>
                                        <option value="female">女</option>
                                    </select>
                                </div>

                                {/* 负重重量 */}
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">
                                        负重重量 (公斤) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={submissionData.weight_kg}
                                        onChange={(e) => setSubmissionData({ ...submissionData, weight_kg: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="例如：25.5"
                                        required
                                    />
                                </div>

                                {/* 视频链接 */}
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">
                                        视频链接 (选填)
                                    </label>
                                    <input
                                        type="url"
                                        value={submissionData.video_url}
                                        onChange={(e) => setSubmissionData({ ...submissionData, video_url: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="https://v.douyin.com/..."
                                    />
                                </div>

                                {/* 备注 */}
                                <div>
                                    <label className="block text-gray-700 text-sm font-bold mb-2">
                                        备注 (选填)
                                    </label>
                                    <textarea
                                        value={submissionData.notes}
                                        onChange={(e) => setSubmissionData({ ...submissionData, notes: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                        rows={3}
                                        placeholder="补充说明..."
                                    />
                                </div>

                                {/* 提交按钮 */}
                                <div className="flex space-x-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={handleCloseUserSubmission}
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submissionLoading}
                                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                                    >
                                        {submissionLoading ? '提交中...' : '提交记录'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PullupLeaderboardPage;