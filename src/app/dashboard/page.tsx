'use client';

import React, { useState, useEffect } from 'react';
import {
    Users,
    Video,
    MessageCircle,
    Star,
    Clock,
    Calendar,
    Award,
    Play,
    User,
    Download,
    Mic,
    Edit3,
    X,
    ArrowLeft,
    Bell,
    TrendingUp
} from 'lucide-react';

import VideoReview from './components/VideoReview';
import ContentManager from './components/ContentManager';
import { CoachDashboardProps, CoachStudentItem, PendingVideo, Student } from '@/types/coach';
import { useRouter } from 'next/navigation';

import { coachService } from './service/coachService';
import { useSession } from 'next-auth/react';
import { getCoach } from './util';

const CoachDashboard: React.FC<CoachDashboardProps> = () => {
    const { data: session, status } = useSession();
    const coach = getCoach(session);

    const router = useRouter();

    const onBack = () => {
        // 跳转到主页
        router.push('/');
    };

    const [activeTab, setActiveTab] = useState<'overview' | 'videos' | 'students' | 'chats' | 'content'>('overview');
    const [showVideoReview, setShowVideoReview] = useState(false);

    // 加载真实学员数据
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState<boolean>(true);

    useEffect(() => {
        const load = async () => {
            setLoadingStudents(true);
            try {
                const items = await coachService.getStudents();
                
                const mapped: Student[] = (items || [] as CoachStudentItem[]).map((it) => ({
                    id: it.student?.id || it.student_id,
                    name: it.profile?.nickname || it.student?.phone || '学员',
                    email: undefined,
                    subscription_tier: it.tier,
                    subscription_start: it.start_date,
                    subscription_end: it.end_date,
                    total_videos: 0,
                    pending_videos: 0,
                    avatar_url: it.profile?.avatar_url || undefined,
                    last_active: it.student?.last_login_at || undefined,
                    progress_score: 0,
                }));
                setStudents(mapped);
            } catch (e) {
                console.error('加载学员失败', e);
                setStudents([]);
            } finally {
                setLoadingStudents(false);
            }
        };
        load();
    }, []);

    // 模拟待点评视频
    const [pendingVideos] = useState<PendingVideo[]>([
        {
            id: '1',
            student_id: '1',
            student_name: '张小明',
            title: '引体向上训练 - 第4周',
            description: '按照教练的指导进行训练，感觉动作有了改善，请教练帮忙看看还有什么需要调整的地方',
            exercise_type: '引体向上',
            duration: 45,
            upload_date: '2024-01-20T14:30:00Z',
            video_url: '/video1.mp4',
            thumbnail_url: '/thumb1.jpg',
            file_size: '12.5 MB'
        },
        {
            id: '2',
            student_id: '1',
            student_name: '张小明',
            title: '深蹲进阶训练',
            description: '尝试增加重量的深蹲训练，请教练检查姿势',
            exercise_type: '深蹲',
            duration: 35,
            upload_date: '2024-01-20T16:15:00Z',
            video_url: '/video2.mp4',
            thumbnail_url: '/thumb2.jpg',
            file_size: '8.7 MB'
        },
        {
            id: '3',
            student_id: '2',
            student_name: '李小红',
            title: '核心力量训练',
            description: '平板支撑和俄罗斯转体的组合训练',
            exercise_type: '核心训练',
            duration: 25,
            upload_date: '2024-01-20T18:00:00Z',
            video_url: '/video3.mp4',
            thumbnail_url: '/thumb3.jpg',
            file_size: '6.2 MB'
        }
    ]);

    const getTierName = (tier: number) => {
        const tiers = {
            1: 'AI计划',
            2: '视频点评',
            3: '一对一指导'
        };
        return tiers[tier as keyof typeof tiers] || '未知';
    };

    const getTierColor = (tier: number) => {
        const colors = {
            1: 'bg-blue-100 text-blue-800',
            2: 'bg-green-100 text-green-800',
            3: 'bg-purple-100 text-purple-800'
        };
        return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    const getRelativeTime = (dateString?: string) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffInHours < 1) {
            return '刚刚';
        } else if (diffInHours < 24) {
            return `${diffInHours}小时前`;
        } else {
            const diffInDays = Math.floor(diffInHours / 24);
            return `${diffInDays}天前`;
        }
    };

    const handleReviewVideo = () => {
        setShowVideoReview(true);
    };

    const handleCloseVideoReview = () => {
        setShowVideoReview(false);
    };

    const renderOverview = () => (
        <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">总学员数</p>
                            <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">待点评视频</p>
                            <p className="text-2xl font-bold text-gray-900">{pendingVideos.length}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                            <Video className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">平均评分</p>
                            <p className="text-2xl font-bold text-gray-900">{coach.rating}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-full">
                            <Star className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">本月收入</p>
                            <p className="text-2xl font-bold text-gray-900">¥2,580</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 最近活动 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h3>
                <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Video className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-900">张小明 上传了新的训练视频</p>
                            <p className="text-xs text-gray-500">2小时前</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-900">李小红 发送了新消息</p>
                            <p className="text-xs text-gray-500">4小时前</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <Star className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-900">王小刚 给您的点评点赞</p>
                            <p className="text-xs text-gray-500">6小时前</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderVideos = () => (
        <div>
            <VideoReview coachId={coach.id} />
        </div>
    );

    const renderStudents = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">我的学员</h3>
                <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600">共 {students.length} 名学员</span>
                </div>
            </div>

            {loadingStudents ? (
                <div className="text-gray-500">加载中...</div>
            ) : students.length === 0 ? (
                <div className="text-gray-500">暂无学员订阅</div>
            ) : (
                <div className="grid gap-6">
                    {students.map((student) => (
                        <div key={student.id} className="bg-white rounded-lg p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">{student.name}</h4>
                                        {student.email && <p className="text-sm text-gray-600">{student.email}</p>}
                                        <p className="text-xs text-gray-500">
                                            最后活跃：{getRelativeTime(student.last_active)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded text-xs ${getTierColor(student.subscription_tier)}`}>
                                            {getTierName(student.subscription_tier)}
                                        </span>
                                        <p className="text-sm text-gray-600 mt-1">
                                            进度：{student.progress_score}%
                                        </p>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-lg font-bold text-blue-600">{student.total_videos}</div>
                                        <div className="text-xs text-gray-600">总视频</div>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-lg font-bold text-yellow-600">{student.pending_videos}</div>
                                        <div className="text-xs text-gray-600">待点评</div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('coach:view-student', { detail: { userId: student.id } }));
                                            }}
                                        >
                                            查看档案
                                        </button>
                                        <button
                                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('coach:create-plan', {
                                                    detail: {
                                                        studentId: student.id,
                                                        studentName: student.name
                                                    }
                                                }));
                                            }}
                                        >
                                            制定计划
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );



    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    {/* 头部 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={onBack}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">教练管理台</h1>
                                <p className="text-gray-600">欢迎回来，{coach.name}！</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            <button className="relative p-2 text-gray-600 hover:text-gray-900">
                                <Bell className="w-6 h-6" />
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                            </button>
                            <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* 导航标签 */}
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'overview'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            概览
                        </button>
                        <button
                            onClick={() => setActiveTab('videos')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'videos'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            视频点评
                        </button>
                        <button
                            onClick={() => setActiveTab('students')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'students'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            我的学员
                        </button>
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'content'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            内容管理
                        </button>
                        <button
                            onClick={() => setActiveTab('chats')}
                            className={`px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'chats'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            聊天管理
                        </button>
                    </div>

                    {/* 内容区域 */}
                    <div>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'videos' && renderVideos()}
                        {activeTab === 'students' && renderStudents()}
                        {activeTab === 'content' && (
                            <ContentManager
                                coachId={coach.id}
                                coachName={coach.name}
                            />
                        )}
                        {activeTab === 'chats' && (
                            <div className="text-center py-12">
                                <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">聊天管理</h3>
                                <p className="text-gray-600">聊天管理功能开发中...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoachDashboard; 