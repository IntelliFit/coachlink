'use client';

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/dashboard/service/coachService';
import { CoachStudentItem, Student } from '@/types/coach';

const Students = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    // 加载真实学员数据
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState<boolean>(true);

    useEffect(() => {
        const loadStudents = async () => {
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
        
        if (coach?.id) {
            loadStudents();
        }
    }, [coach?.id]);

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-900">我的学员</h3>
                <div className="flex items-center space-x-3">
                    {loadingStudents ? (
                        <Skeleton width="5rem" height="1rem" />
                    ) : (
                        <span className="text-sm text-600">共 {students.length} 名学员</span>
                    )}
                </div>
            </div>

            {loadingStudents ? (
                // 显示骨架屏
                <div className="grid gap-6">
                    {[1, 2, 3].map((index) => (
                        <Card key={index} className="shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center space-x-4">
                                    <Skeleton shape="circle" size="3rem" />
                                    <div>
                                        <Skeleton width="6rem" height="1.25rem" className="mb-2" />
                                        <Skeleton width="8rem" height="0.75rem" />
                                    </div>
                                </div>
                                
                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="text-right">
                                        <Skeleton width="4rem" height="1rem" className="mb-2" />
                                        <Skeleton width="5rem" height="0.75rem" />
                                    </div>
                                    
                                    <div className="text-center">
                                        <Skeleton width="1.5rem" height="1.5rem" className="mx-auto mb-1" />
                                        <Skeleton width="3rem" height="0.75rem" />
                                    </div>
                                    
                                    <div className="text-center">
                                        <Skeleton width="1.5rem" height="1.5rem" className="mx-auto mb-1" />
                                        <Skeleton width="3rem" height="0.75rem" />
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <Skeleton width="4rem" height="2rem" />
                                        <Skeleton width="5rem" height="2rem" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : students.length === 0 ? (
                <div className="text-500">暂无学员订阅</div>
            ) : (
                <div className="grid gap-6">
                    {students.map((student) => (
                        <Card key={student.id} className="shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                                        <User className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-900">{student.name}</h4>
                                        {student.email && <p className="text-sm text-600">{student.email}</p>}
                                        <p className="text-xs text-500">
                                            最后活跃：{getRelativeTime(student.last_active)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded text-xs ${getTierColor(student.subscription_tier)}`}>
                                            {getTierName(student.subscription_tier)}
                                        </span>
                                        <p className="text-sm text-600 mt-1">
                                            进度：{student.progress_score}%
                                        </p>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-lg font-bold text-primary">{student.total_videos}</div>
                                        <div className="text-xs text-600">总视频</div>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-lg font-bold text-yellow-600">{student.pending_videos}</div>
                                        <div className="text-xs text-600">待点评</div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            label="查看档案"
                                            className="p-button-sm"
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('coach:view-student', { detail: { userId: student.id } }));
                                            }}
                                        />
                                        <Button
                                            label="制定计划"
                                            className="p-button-sm"
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('coach:create-plan', {
                                                    detail: {
                                                        studentId: student.id,
                                                        studentName: student.name
                                                    }
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Students;