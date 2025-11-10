import React, { useEffect, useState } from 'react';
import { Brain, Video, MessageCircle, Star, Clock, ArrowRight, Target, BarChart3 } from 'lucide-react';
import { VideoService } from '../services/videoService';
import { TrainingService } from '../services/trainingService';
import { supabase } from '../lib/supabaseClient';

interface Coach {
  id: string;
  name: string;
  title: string;
  avatar_url?: string;
  specialties?: string[];
  rating?: number;
}

interface Subscription {
  id: string;
  coach: Coach;
  tier: number;
  start_date: string;
  end_date: string | null; // 允许为null，表示永久订阅
  is_active: boolean;
  auto_renew: boolean;
}

interface SubscriptionDashboardProps {
  subscriptions: Subscription[];
  onAccessService: (serviceType: string, coachId: string) => void;
  userId?: string;
}

const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({
  subscriptions,
  onAccessService,
  userId
}) => {
  // 统计与动态
  const [stats, setStats] = useState({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 });
  const [activities, setActivities] = useState<Array<{ time: string; text: string }>>([]);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      try {
        const trainingService = TrainingService.getInstance();
        const videoService = VideoService.getInstance();
        const [plans, videoStats, msgs] = await Promise.all([
          trainingService.getUserTrainingPlans(userId),
          videoService.getVideoStats(userId),
          supabase
            .from('coach_messages')
            .select('id, created_at', { count: 'exact' })
            .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(30)
        ]);

        const aiPlans = (plans || []).filter((p: any) => p.ai_generated).length;
        const messages = (msgs.count as number) || 0;

        // 训练天数：过去30天内有计划创建或视频提交的天数
        const days = new Set<string>();
        (plans || []).forEach((p: any) => days.add(new Date(p.created_at).toDateString()));
        // 再取用户视频（为了 recent 与天数更真实）
        const userVideos = await videoService.getUserVideoSubmissions(userId);
        (userVideos || []).forEach((v: any) => days.add(new Date(v.submitted_at).toDateString()));

        setStats({ aiPlans, videoReviews: Math.max(0, Math.round(videoStats.reviewed || 0)), messages, trainingDays: days.size });

        // 最近活动：取最新的3-4条混合事件
        const recent: Array<{ time: string; text: string }> = [];
        (plans || []).slice(0, 3).forEach((p: any) => recent.push({ time: p.created_at, text: `创建了新的训练计划《${p.title || '训练计划'}》` }));
        (userVideos || []).slice(0, 3).forEach((v: any) => recent.push({ time: v.submitted_at, text: `上传了训练视频（${v.exercise_type || '训练'}）` }));
        const msgsData = (msgs.data as any[]) || [];
        msgsData.slice(0, 3).forEach((m: any) => recent.push({ time: m.created_at, text: '发送/收到了一条私信' }));
        recent.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setActivities(recent.slice(0, 5));
      } catch (e) {
        setStats({ aiPlans: 0, videoReviews: 0, messages: 0, trainingDays: 0 });
        setActivities([]);
      }
    };
    load();
  }, [userId]);

  const getServicesByTier = (tier: number) => {
    const base = [
      { id: 'ai_plan', name: 'AI训练计划', description: '个性化AI训练方案', icon: Brain, color: 'bg-blue-500', available: tier >= 1 }
    ];
    if (tier >= 3) {
      base.push({ id: 'chat', name: '一对一聊天', description: '与教练实时沟通交流', icon: MessageCircle, color: 'bg-purple-500', available: true });
    } else {
      base.push({ id: 'chat_demo', name: '🎯 体验聊天功能', description: '免费体验一对一聊天 (演示版)', icon: MessageCircle, color: 'bg-orange-500', available: true });
    }
    return base;
  };

  const getSubscriptionStatus = (subscription: Subscription) => {
    // 如果没有结束日期，表示永久订阅
    if (!subscription.end_date) {
      return { status: 'active', text: '永久有效', color: 'text-green-600 bg-green-50' };
    }
    
    const daysLeft = Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) {
      return { status: 'expired', text: '已过期', color: 'text-red-600 bg-red-50' };
    } else if (daysLeft <= 7) {
      return { status: 'expiring', text: `${daysLeft}天后过期`, color: 'text-orange-600 bg-orange-50' };
    } else {
      return { status: 'active', text: `${daysLeft}天后到期`, color: 'text-green-600 bg-green-50' };
    }
  };

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">还没有订阅任何教练</h3>
        <p className="text-gray-600 mb-6">选择专业教练，开始您的健身之旅</p>
        <button
          onClick={() => onAccessService('browse_coaches', '')}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
        >
          浏览教练
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 订阅概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subscriptions.map((subscription) => {
          const status = getSubscriptionStatus(subscription);
          const services = getServicesByTier(subscription.tier);
          const availableServices = services.filter(s => s.available);

          return (
            <div key={subscription.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* 教练信息头部 */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-6 text-white">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-xl font-bold">{subscription.coach.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{subscription.coach.name}</h3>
                    <p className="text-blue-100 text-sm">{subscription.coach.title}</p>
                    <div className="flex items-center space-x-1 mt-1">
                      <Star className="w-4 h-4 text-yellow-300 fill-current" />
                      <span className="text-sm">{subscription.coach.rating}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-100">订阅等级</div>
                    <div className="text-lg font-bold">Tier {subscription.tier}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.text}
                  </div>
                </div>
              </div>

              {/* 可用服务 */}
              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4">可用服务</h4>
                <div className="space-y-3">
                  {availableServices.map((service) => {
                    const Icon = service.icon;
                    return (
                      <button
                        key={service.id}
                        onClick={() => onAccessService(service.id, subscription.coach.id)}
                        className="w-full flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                      >
                        <div className={`w-10 h-10 ${service.color} rounded-lg flex items-center justify-center`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium text-gray-900">{service.name}</div>
                          <div className="text-xs text-gray-500">{service.description}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </button>
                    );
                  })}
                </div>

                {/* 续费提醒 */}
                {status.status === 'expiring' && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-800">订阅即将到期</span>
                    </div>
                    <button className="mt-2 w-full bg-orange-500 text-white py-2 px-4 rounded-lg text-sm hover:bg-orange-600 transition-colors">
                      立即续费
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 快速统计 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">训练统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Brain className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.aiPlans}</div>
            <div className="text-sm text-gray-600">AI训练计划</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Video className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.videoReviews}</div>
            <div className="text-sm text-gray-600">视频点评</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <MessageCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.messages}</div>
            <div className="text-sm text-gray-600">聊天消息</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.trainingDays}</div>
            <div className="text-sm text-gray-600">训练天数</div>
          </div>
        </div>
      </div>

      {/* 最近活动 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">最近活动</h3>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center text-gray-500">暂无活动</div>
          ) : (
            activities.map((act, idx) => (
              <div key={idx} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{act.text}</div>
                  <div className="text-xs text-gray-500">{new Date(act.time).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDashboard; 