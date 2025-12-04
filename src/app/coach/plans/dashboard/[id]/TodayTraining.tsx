import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trainingService } from '@/app/service/trainingService';
import { userService } from '@/app/service/userService';
import { useToastContext } from '@/context/ToastContext';
import { Skeleton } from 'primereact/skeleton';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

// 从 TrainingHub.tsx 移动过来的类型定义
interface TrainingRecord {
  id: string;
  week_number: number;
  day_number: number;
  completed_sets: number;
  total_sets: number;
  status: string;
  training_date?: string;
}

interface TrainingPlan {
  id: string;
  title: string;
  description: string;
  duration_weeks: number;
  difficulty_level: string;
  ai_generated: boolean;
  coach_reviewed: boolean;
  created_at: string;
}

interface TodayTrainingProps {
  userId: string;
  trainingPlanId: string;
  onSessionComplete?: () => void;
}

const TodayTraining: React.FC<TodayTrainingProps> = ({
  userId,
  trainingPlanId,
  onSessionComplete
}) => {
  const { showToast } = useToastContext();
  const [todayRecord, setTodayRecord] = useState<TrainingRecord | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const router = useRouter();
  const [actualCurrentWeek, setActualCurrentWeek] = useState(1);
  const [todayWeekDays, setTodayWeekDays] = useState<Array<{ day_of_week: string; session_focus: string; order_index: number }>>([]);
  const [browseWeek, setBrowseWeek] = useState(1);
  const [browseDayOfWeek, setBrowseDayOfWeek] = useState<string>('');
  const [weekDays, setWeekDays] = useState<Array<{ day_of_week: string; session_focus: string; order_index: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [weekRecords, setWeekRecords] = useState<Record<string, { status: string; completed_sets: number; total_sets: number }>>({});

  const dayMap: Record<string, string> = {
    'Mon': '周一',
    'Tue': '周二',
    'Wed': '周三',
    'Thu': '周四',
    'Fri': '周五',
    'Sat': '周六',
    'Sun': '周日'
  };

  const getTodayDayOfWeek = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date().getDay()];
  };

  // 获取指定周次的日期范围
  const getWeekDateRange = (weekNumber: number) => {
    // 简化版本：假设训练计划从本周开始，根据周数偏移
    const today = new Date();
    const weekOffset = (weekNumber - actualCurrentWeek) * 7;
    const dates: Date[] = [];
    
    // 获取本周一
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay; // 周日特殊处理
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + weekOffset);
    
    // 生成一周7天的日期
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  // 判断是否是今天
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // 检查是否是训练日（根据星期几判断）
  const isTrainingDay = (dayOfWeek: string) => {
    return weekDays.some(day => day.day_of_week === dayOfWeek);
  };

  // 检查今天是否是训练日（实际的今天）
  const isTodayTrainingDay = () => {
    const todayDay = getTodayDayOfWeek();
    return todayWeekDays.some(day => day.day_of_week === todayDay);
  };

  // 开始今天的训练
  const handleStartTodayTraining = async () => {
    const todayDay = getTodayDayOfWeek();
    const dayIndex = todayWeekDays.findIndex(d => d.day_of_week === todayDay);
    
    if (dayIndex >= 0) {
      await handleStartTraining(actualCurrentWeek, dayIndex + 1);
    }
  };

  // 开始训练（通用）- 根据数据库中的日期信息判断是否只读
  const handleStartTraining = async (weekNumber: number, dayNumber: number, forceReadOnly: boolean = false) => {
    try {
      console.log('[TodayTraining] 调用 getTrainingDayDate:', { weekNumber, dayNumber, trainingPlanId });
      
      // 调用后端API获取该训练日的日期信息
      const dateInfo = await trainingService.getTrainingDayDate({
        training_plan_id: trainingPlanId,
        week_number: weekNumber,
        day_number: dayNumber,
      });

      console.log('[TodayTraining] API 返回结果:', dateInfo);

      // 如果API调用成功，使用API返回的 should_be_read_only，否则使用传入的 forceReadOnly
      const shouldBeReadOnly = (dateInfo && 'should_be_read_only' in dateInfo) ? dateInfo.should_be_read_only : forceReadOnly;

      console.log('[TodayTraining] 最终 readOnly 值:', shouldBeReadOnly);

      // 跳转到训练执行页面
      router.push(`/coach/plans/dashboard/${trainingPlanId}/training-execution?week=${weekNumber}&day=${dayNumber}&readOnly=${shouldBeReadOnly}`);
    } catch (error) {
      console.error('[TodayTraining] 获取训练日日期信息失败:', error);
      // 发生错误时，使用传入的 forceReadOnly
      router.push(`/coach/plans/dashboard/${trainingPlanId}/training-execution?week=${weekNumber}&day=${dayNumber}&readOnly=${forceReadOnly}`);
    }
  };

  const handleViewTodayRecord = async () => {
    if (todayRecord) {
      // 继续今天的训练 - 强制使用可编辑模式，不调用API判断
      // 因为这是用户明确要继续完成的训练，不应该显示历史记录
      router.push(`/coach/plans/dashboard/${trainingPlanId}/training-execution?week=${todayRecord.week_number}&day=${todayRecord.day_number}&readOnly=false`);
    }
  };

  // 检查今日是否有训练记录
  const checkTodayRecord = async () => {
    try {
      const hubData = await trainingService.getHubData({ training_plan_id: trainingPlanId });
      if (hubData?.today_record) {
        setTodayRecord(hubData.today_record);
      } else {
        setTodayRecord(null);
      }
    } catch (error) {
      console.error('检查今日训练记录失败:', error);
      showToast({
        severity: 'error',
        summary: '获取训练记录失败',
        detail: '无法获取今日训练记录',
        life: 3000
      });
      setTodayRecord(null);
    }
  };

  // 加载选定周次的训练日（用于浏览）
  const loadWeekDays = async (weekNumber: number) => {
    try {
      const result = await trainingService.getWeekDays({ 
        training_plan_id: trainingPlanId, 
        week_number: weekNumber 
      });
      
      const data = result?.week_days || [];
      setWeekDays(data);
      
      if (!browseDayOfWeek && data.length > 0) {
        setBrowseDayOfWeek(data[0].day_of_week);
      }
    } catch (error) {
      console.error('加载周训练日失败:', error);
      showToast({
        severity: 'error',
        summary: '加载失败',
        detail: '无法加载训练日数据',
        life: 3000
      });
      setWeekDays([]);
    }
  };

  // 加载选定周次的训练记录（用于显示完成状态）
  const loadWeekRecords = async (weekNumber: number) => {
    try {
      const result = await trainingService.getWeekRecords({
        training_plan_id: trainingPlanId,
        week_number: weekNumber
      });

      if (result?.records) {
        // 将数组转换为以 day_of_week 为 key 的对象
        const recordsMap: Record<string, { status: string; completed_sets: number; total_sets: number }> = {};
        result.records.forEach(record => {
          if (record.status) {
            recordsMap[record.day_of_week] = {
              status: record.status,
              completed_sets: record.completed_sets,
              total_sets: record.total_sets
            };
          }
        });
        setWeekRecords(recordsMap);
      } else {
        setWeekRecords({});
      }
    } catch (error) {
      console.error('加载周训练记录失败:', error);
      // 不显示错误提示，因为这不是关键功能
      setWeekRecords({});
    }
  };

  // 初始化加载数据
  useEffect(() => {
    if (trainingPlanId && userId) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingPlanId, userId]);

  // 加载初始数据
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 加载训练中心数据
      const hubData = await trainingService.getHubData({ training_plan_id: trainingPlanId });
      
      if (hubData) {
        // 设置训练计划
        if (hubData.training_plan) {
          setTrainingPlan(hubData.training_plan as any);
        }
        
        // 设置当前周
        const currentWeek = hubData.current_week || 1;
        setActualCurrentWeek(currentWeek);
        setBrowseWeek(currentWeek);
        
        // 设置今日训练记录
        if (hubData.today_record) {
          setTodayRecord(hubData.today_record);
        }
        
        // 加载今日所在周的训练日
        const weekDaysResult = await trainingService.getWeekDays({
          training_plan_id: trainingPlanId,
          week_number: currentWeek
        });
        
        if (weekDaysResult?.week_days) {
          setTodayWeekDays(weekDaysResult.week_days);
          setWeekDays(weekDaysResult.week_days);
          
          // 设置默认选择今天
          const todayDay = getTodayDayOfWeek();
          setBrowseDayOfWeek(todayDay);
        }
      }
    } catch (error) {
      console.error('加载训练数据失败:', error);
      showToast({
        severity: 'error',
        summary: '加载失败',
        detail: '无法加载训练数据',
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  // 当实际当前周更新时，更新浏览周
  useEffect(() => {
    setBrowseWeek(actualCurrentWeek);
    const todayDay = getTodayDayOfWeek();
    setBrowseDayOfWeek(todayDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualCurrentWeek]);

  useEffect(() => {
    if (trainingPlanId) {
      loadWeekDays(browseWeek);
      loadWeekRecords(browseWeek);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseWeek, trainingPlanId]);

  // 渲染周日历条
  const renderWeekCalendar = () => {
    const weekDates = getWeekDateRange(browseWeek);
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="bg-surface-0 dark:bg-surface-900 rounded-xl p-4 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => browseWeek > 1 && setBrowseWeek(browseWeek - 1)}
            disabled={browseWeek <= 1}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="上一周"
          >
            <ChevronLeft className="w-5 h-5 text-surface-600 dark:text-surface-400" />
          </button>
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-0">
            第 {browseWeek} 周
          </h3>
          <button
            onClick={() => setBrowseWeek(browseWeek + 1)}
            disabled={browseWeek >= (trainingPlan?.duration_weeks || 8)}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="下一周"
          >
            <ChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-400" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const dayKey = dayKeys[index];
            const isTrainingDayBool = isTrainingDay(dayKey);
            const isTodayBool = isToday(date);
            const isSelected = browseDayOfWeek === dayKey;
            const recordStatus = weekRecords[dayKey]?.status;
            const isCompleted = recordStatus === 'completed';
            
            return (
              <button
                key={index}
                onClick={() => {
                  setBrowseDayOfWeek(dayKey);
                }}
                className={`
                  relative flex flex-col items-center justify-center p-3 rounded-lg transition-all cursor-pointer
                  ${isSelected 
                    ? 'bg-primary-500 text-white shadow-md scale-105' 
                    : isTrainingDayBool
                    ? 'bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700'
                    : 'bg-surface-50 dark:bg-surface-800 opacity-60 hover:opacity-80'
                  }
                  ${isTodayBool && !isSelected ? 'ring-2 ring-primary-500' : ''}
                `}
              >
                <div className={`text-xs mb-1 ${isSelected ? 'text-white opacity-90' : 'text-surface-500 dark:text-surface-400'}`}>
                  {dayNames[index]}
                </div>
                <div className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-surface-900 dark:text-surface-0'}`}>
                  {date.getDate()}
                </div>
                {isTrainingDayBool ? (
                  <div className={`text-xs mt-1 truncate max-w-full px-1 ${isSelected ? 'text-white opacity-90' : 'text-surface-600 dark:text-surface-400'}`}>
                    {weekDays.find(d => d.day_of_week === dayKey)?.session_focus || '训练'}
                  </div>
                ) : (
                  <div className={`text-xs mt-1 ${isSelected ? 'text-white opacity-90' : 'text-surface-500 dark:text-surface-400'}`}>
                    休息
                  </div>
                )}
                {isCompleted && (
                  <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton width="100%" height="8rem" />
        <Skeleton width="100%" height="4rem" />
        <Skeleton width="100%" height="6rem" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Play className="w-5 h-5 mr-2 text-green-600" />
          今日训练
        </h2>
        <div className="text-sm text-gray-600">
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
          })}
        </div>
      </div>

      {!isTodayTrainingDay() ? (
        <div className="min-h-[600px] flex flex-col items-center justify-center">
          <div className="max-w-4xl w-full space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-block p-6 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-full shadow-2xl">
                <span className="text-8xl">😌</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                今日休息日
              </h2>
              <p className="text-xl md:text-2xl text-gray-600 font-medium">
                休息不是懒惰，而是成长的必经之路
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-8 shadow-xl border-2 border-purple-200">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">为什么休息如此重要？</h3>
                <p className="text-gray-700 text-lg leading-relaxed max-w-2xl mx-auto">
                  训练只是刺激肌肉生长的开始，真正的成长发生在休息和恢复期间。
                  <br />
                  <span className="font-semibold text-purple-700">充分的休息是为了更好的训练，更强的自己！</span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="text-5xl mb-4 text-center">💪</div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3 text-center">肌肉重建</h4>
                  <p className="text-gray-600 text-center leading-relaxed">
                    训练撕裂肌肉纤维，休息时肌肉修复并超量恢复，变得更加强壮有力
                  </p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="text-5xl mb-4 text-center">🔋</div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3 text-center">能量储备</h4>
                  <p className="text-gray-600 text-center leading-relaxed">
                    补充肌糖原储备，恢复ATP能量系统，为下次爆发蓄力
                  </p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="text-5xl mb-4 text-center">🧠</div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3 text-center">神经修复</h4>
                  <p className="text-gray-600 text-center leading-relaxed">
                    中枢神经系统需要恢复，降低过度训练风险，保持长期进步
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                <h4 className="text-2xl font-bold mb-4 flex items-center justify-center">
                  <span className="mr-2">💡</span>
                  <span>休息日行动指南</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">😴</span>
                      <div>
                        <h5 className="font-semibold mb-1">充足睡眠</h5>
                        <p className="text-sm text-blue-100">7-9小时深度睡眠，促进生长激素分泌</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">🥩</span>
                      <div>
                        <h5 className="font-semibold mb-1">优质营养</h5>
                        <p className="text-sm text-blue-100">充足蛋白质和碳水，为肌肉修复提供原料</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">🚶</span>
                      <div>
                        <h5 className="font-semibold mb-1">主动恢复</h5>
                        <p className="text-sm text-blue-100">散步、瑜伽、拉伸，促进血液循环</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">💧</span>
                      <div>
                        <h5 className="font-semibold mb-1">充分补水</h5>
                        <p className="text-sm text-blue-100">2-3升水分，加速代谢废物排出</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">🧘</span>
                      <div>
                        <h5 className="font-semibold mb-1">身心放松</h5>
                        <p className="text-sm text-blue-100">冥想、阅读、音乐，降低皮质醇水平</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl flex-shrink-0">📝</span>
                      <div>
                        <h5 className="font-semibold mb-1">计划复盘</h5>
                        <p className="text-sm text-blue-100">回顾训练进展，为下次训练做准备</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-3 py-6">
              <p className="text-lg text-gray-600 italic">
                "强者懂得何时发力，智者懂得何时休息"
              </p>
              <p className="text-sm text-gray-500">
                明天，你会因为今天的休息而变得更强 💪
              </p>
            </div>

            <div className="relative py-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-300"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-0 dark:bg-surface-900 px-4 text-sm text-surface-500 dark:text-surface-400 font-medium">
                  或者查看其他训练日
                </span>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-surface-0 mb-4">浏览其他训练日</h3>
              
              {renderWeekCalendar()}

              {browseDayOfWeek && !isTrainingDay(browseDayOfWeek) ? (
                <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl text-center">
                  <div className="text-6xl mb-4">😌</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-surface-0 mb-2">休息日</h3>
                  <p className="text-surface-600 dark:text-surface-400">
                    今天好好休息，为下次训练做准备
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      if (!browseDayOfWeek || !isTrainingDay(browseDayOfWeek)) return;
                      const dayIndex = weekDays.findIndex(d => d.day_of_week === browseDayOfWeek);
                      if (dayIndex >= 0) {
                        // 统一使用 handleStartTraining，由后端判断是否只读
                        await handleStartTraining(browseWeek, dayIndex + 1);
                      }
                    }}
                    disabled={!browseDayOfWeek || !isTrainingDay(browseDayOfWeek)}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-primary hover:from-blue-600 hover:to-primary-700 text-white rounded-lg font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Play className="w-6 h-6" />
                    <span>
                      {!browseDayOfWeek 
                        ? '请选择日期' 
                        : (browseWeek === actualCurrentWeek && browseDayOfWeek === getTodayDayOfWeek())
                        ? '开始训练'
                        : '查看训练'}
                    </span>
                  </button>
                  
                  <p className="text-sm text-gray-600 dark:text-surface-400 mt-3 text-center">
                    选择其他训练日查看训练计划或历史记录
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          {todayRecord && todayRecord.status === 'completed' ? (
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">✓</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      今日训练全部完成
                    </h3>
                    <p className="text-sm text-gray-600">
                      恭喜你完成了今天的所有训练！
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">训练进度</div>
                  <div className="text-lg font-semibold text-green-600">
                    {todayRecord.completed_sets}/{todayRecord.total_sets} 组
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-gray-700">
                  💪 做得很棒！继续保持，明天见！
                </p>
              </div>
            </div>
          ) : todayRecord ? (
            <div className="p-6 bg-gradient-to-r from-blue-50 to-primary-50 border-2 border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    今日训练进行中
                  </h3>
                  <p className="text-sm text-gray-600">
                    继续完成你的训练记录
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">训练进度</div>
                  <div className="text-lg font-semibold text-blue-600">
                    第 {todayRecord.week_number} 周 第 {todayRecord.day_number} 天
                  </div>
                </div>
              </div>
              
              <div className="mb-4 p-3 bg-white rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">已完成组数</span>
                  <span className="font-semibold text-blue-600">
                    {todayRecord.completed_sets}/{todayRecord.total_sets}
                  </span>
                </div>
              </div>

              <button
                onClick={handleViewTodayRecord}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-primary text-white rounded-xl hover:from-blue-600 hover:to-primary-700 font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all transform hover:scale-105"
              >
                <Play className="w-6 h-6" />
                <span>继续训练</span>
              </button>
            </div>
          ) : (
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    今日训练
                  </h3>
                  <p className="text-sm text-gray-600">
                    开始今天的训练计划，逐组完成、实时记录
                  </p>
                </div>
                <div className="text-2xl">💪</div>
              </div>

              <button
                onClick={handleStartTodayTraining}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all transform hover:scale-105"
              >
                <Play className="w-6 h-6" />
                <span>开始今日训练</span>
              </button>
            </div>
          )}

          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-surface-0 mb-1">
                  浏览其他训练日
                </h3>
                <p className="text-sm text-gray-600 dark:text-surface-400">
                  查看其他日期的训练计划或历史记录
                </p>
              </div>
              {browseDayOfWeek && (
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-surface-400">当前选择</div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    第 {browseWeek} 周 {dayMap[browseDayOfWeek] || ''}
                  </div>
                </div>
              )}
            </div>
            
            {renderWeekCalendar()}

            {browseDayOfWeek && !isTrainingDay(browseDayOfWeek) ? (
              <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl text-center">
                <div className="text-6xl mb-4">😌</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-surface-0 mb-2">休息日</h3>
                <p className="text-surface-600 dark:text-surface-400">
                  今天好好休息，为下次训练做准备
                </p>
              </div>
            ) : (
              <>
                {browseDayOfWeek && browseWeek === actualCurrentWeek && browseDayOfWeek === getTodayDayOfWeek() && (
                  <div className="mb-4 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                    <span className="text-green-700 dark:text-green-400 text-sm font-medium">
                      ✓ 这是今天的训练
                    </span>
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!browseDayOfWeek || !isTrainingDay(browseDayOfWeek)) return;
                    const dayIndex = weekDays.findIndex(d => d.day_of_week === browseDayOfWeek);
                    if (dayIndex >= 0) {
                      // 统一使用 handleStartTraining，由后端判断是否只读
                      await handleStartTraining(browseWeek, dayIndex + 1);
                    }
                  }}
                  disabled={!browseDayOfWeek || !isTrainingDay(browseDayOfWeek)}
                  className={`w-full py-4 ${
                    browseDayOfWeek && browseWeek === actualCurrentWeek && browseDayOfWeek === getTodayDayOfWeek()
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                      : 'bg-gradient-to-r from-blue-500 to-primary hover:from-blue-600 hover:to-primary-700'
                  } text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                >
                  <Play className="w-6 h-6" />
                  <span>
                    {!browseDayOfWeek 
                      ? '请选择日期' 
                      : (browseWeek === actualCurrentWeek && browseDayOfWeek === getTodayDayOfWeek())
                      ? (todayRecord && todayRecord.status !== 'completed' ? '继续训练' : '开始训练')
                      : '查看训练'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TodayTraining;
