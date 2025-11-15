import React, { useState, useEffect } from 'react';
import { Bell, Clock, Calendar, Settings, ToggleLeft, ToggleRight, Plus, X } from 'lucide-react';
import { userService } from '@/app/service/userService';
import type { GetTrainingRemindersResponseDto, TrainingReminder } from '@/app/api/user/get-training-reminders/entity';

interface TrainingReminderProps {
    userId: string;
    trainingPlanId: string;
}

const TrainingReminder: React.FC<TrainingReminderProps> = ({
    userId,
    trainingPlanId
}) => {
    const [reminders, setReminders] = useState<GetTrainingRemindersResponseDto['reminders']>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        reminder_type: 'daily' as 'daily' | 'weekly' | 'custom',
        reminder_time: '09:00',
        days_of_week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        is_active: true
    });

    const daysOfWeek = [
        { value: 'Mon', label: '周一' },
        { value: 'Tue', label: '周二' },
        { value: 'Wed', label: '周三' },
        { value: 'Thu', label: '周四' },
        { value: 'Fri', label: '周五' },
        { value: 'Sat', label: '周六' },
        { value: 'Sun', label: '周日' }
    ];

    useEffect(() => {
        loadReminders();
    }, [userId, trainingPlanId]);

    const loadReminders = async () => {
        try {
            const res = await userService.getTrainingReminders({ training_plan_id: trainingPlanId });
            if (res) {
                setReminders(res.reminders || []);
            }
        } catch (error) {
            console.error('加载提醒失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const createReminder = async () => {
        try {
            const data = await userService.createTrainingReminder({
                training_plan_id: trainingPlanId,
                reminder_type: formData.reminder_type,
                reminder_time: formData.reminder_time,
                days_of_week: formData.reminder_type === 'weekly' ? formData.days_of_week : undefined,
                is_active: formData.is_active
            });

            if (data) {
                await loadReminders();
                setShowAddForm(false);
                setFormData({
                    reminder_type: 'daily',
                    reminder_time: '09:00',
                    days_of_week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    is_active: true
                });
            }
        } catch (error) {
            console.error('创建提醒失败:', error);
        }
    };

    const updateReminder = async (id: string, updates: Partial<TrainingReminder>) => {
        try {
            await userService.updateTrainingReminder({ id, updates });
            await loadReminders();
        } catch (error) {
            console.error('更新提醒失败:', error);
        }
    };

    const deleteReminder = async (id: string) => {
        try {
            await userService.deleteTrainingReminder({ id });
            await loadReminders();
        } catch (error) {
            console.error('删除提醒失败:', error);
        }
    };

    const toggleReminder = async (id: string, currentStatus: boolean) => {
        await updateReminder(id, { is_active: !currentStatus });
    };

    const getReminderDescription = (reminder: TrainingReminder) => {
        switch (reminder.reminder_type) {
            case 'daily':
                return `每天 ${reminder.reminder_time}`;
            case 'weekly':
                const days = reminder.days_of_week?.map(day => {
                    const dayMap: Record<string, string> = {
                        'Mon': '周一', 'Tue': '周二', 'Wed': '周三',
                        'Thu': '周四', 'Fri': '周五', 'Sat': '周六', 'Sun': '周日'
                    };
                    return dayMap[day] || day;
                }).join('、') || '每天';
                return `${days} ${reminder.reminder_time}`;
            case 'custom':
                return `自定义时间 ${reminder.reminder_time}`;
            default:
                return reminder.reminder_time;
        }
    };

    const handleDayToggle = (day: string) => {
        setFormData(prev => ({
            ...prev,
            days_of_week: prev.days_of_week.includes(day)
                ? prev.days_of_week.filter(d => d !== day)
                : [...prev.days_of_week, day]
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Bell className="w-5 h-5 mr-2 text-blue-600" />
                    训练提醒
                </h3>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    添加提醒
                </button>
            </div>

            {showAddForm && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                提醒类型
                            </label>
                            <select
                                value={formData.reminder_type}
                                onChange={(e) => setFormData(prev => ({ ...prev, reminder_type: e.target.value as any }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="daily">每天</option>
                                <option value="weekly">每周特定天</option>
                                <option value="custom">自定义</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                提醒时间
                            </label>
                            <input
                                type="time"
                                value={formData.reminder_time}
                                onChange={(e) => setFormData(prev => ({ ...prev, reminder_time: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>

                        {formData.reminder_type === 'weekly' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    提醒日
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {daysOfWeek.map(day => (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => handleDayToggle(day.value)}
                                            className={`px-3 py-2 text-sm rounded-lg border ${formData.days_of_week.includes(day.value)
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={createReminder}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                创建提醒
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                </div>
            ) : reminders.length === 0 ? (
                <div className="text-center py-8">
                    <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">暂无训练提醒</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reminders.map((reminder) => (
                        <div key={reminder.id} className="flex items-center justify-between p-4 bg-white border rounded-lg">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <span className={`px-2 py-1 text-xs rounded-full ${reminder.reminder_type === 'daily' ? 'bg-blue-100 text-blue-800' :
                                            reminder.reminder_type === 'weekly' ? 'bg-green-100 text-green-800' :
                                                'bg-purple-100 text-purple-800'
                                        }`}>
                                        {reminder.reminder_type === 'daily' ? '每天' :
                                            reminder.reminder_type === 'weekly' ? '每周' : '自定义'}
                                    </span>
                                    <span className={`text-xs ${reminder.is_active ? 'text-green-600' : 'text-gray-500'
                                        }`}>
                                        {reminder.is_active ? '已启用' : '已停用'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-900 mt-1">
                                    {getReminderDescription(reminder)}
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => toggleReminder(reminder.id!, reminder.is_active)}
                                    className="p-1 hover:bg-gray-100 rounded"
                                >
                                    {reminder.is_active ? (
                                        <ToggleRight className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>
                                <button
                                    onClick={() => deleteReminder(reminder.id!)}
                                    className="p-1 hover:bg-gray-100 rounded text-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TrainingReminder;