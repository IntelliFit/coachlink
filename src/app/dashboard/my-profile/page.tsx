'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { FloatLabel } from 'primereact/floatlabel';
import { Skeleton } from 'primereact/skeleton';
import { Avatar } from 'primereact/avatar';
import { useToastContext } from '@/context/ToastContext';
import { studentService } from '@/app/service/studentService';
import { User, Activity, Edit, TrendingUp, Users, MessageSquare, Calendar } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SportCards } from '@/types/sportCards';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { AeroInputNumber } from '@/components/AeroInputNumber';

interface ProfileData {
    id: string;
    user_id: string;
    full_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    gender: string | null;
    age: number | null;
    height: number | null;
    weight: number | null;
    lifestyle: string | null;
    sport_cards: SportCards | null;
    onboarding_completed: boolean;
}

const GENDER_OPTIONS = [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' },
];

export default function MyProfilePage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<Partial<ProfileData>>({});

    // 加载用户档案
    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const data = await studentService.getStudentProfile();
            console.log('Profile data:', data); // 调试用
            if (data?.profile) {
                setProfile(data.profile as ProfileData);
            }
        } catch (error) {
            console.error('Load profile error:', error);
            showToast({ severity: 'error', summary: '加载档案失败' });
        } finally {
            setLoading(false);
        }
    };

    // 打开编辑弹窗
    const openEditDialog = () => {
        setEditForm({
            full_name: profile?.full_name,
            age: profile?.age,
            gender: profile?.gender,
            height: profile?.height,
            weight: profile?.weight,
            lifestyle: profile?.lifestyle,
        });
        setEditDialogVisible(true);
    };

    // 保存编辑
    const handleSaveEdit = async () => {
        setSaving(true);
        try {
            const result = await studentService.updateProfile(editForm);
            if (result) {
                showToast({ severity: 'success', summary: '保存成功' });
                setEditDialogVisible(false);
                loadProfile();
            } else {
                showToast({ severity: 'error', summary: '保存失败' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败' });
        } finally {
            setSaving(false);
        }
    };

    // 获取性别显示文本
    const getGenderLabel = (gender: string | null) => {
        return gender === 'male' ? '男' : gender === 'female' ? '女' : '-';
    };



    if (loading) {
        return (
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                <Skeleton width="100%" height="200px" borderRadius="16px" />
                <Skeleton width="100%" height="300px" borderRadius="16px" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            {/* 头部卡片 */}
            <Card className="shadow-lg border-0">
                <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 -m-5 mb-6 p-8 rounded-t-xl">
                    <div className="flex items-center gap-6">
                        <Avatar
                            image={profile?.avatar_url || undefined}
                            label={profile?.full_name?.[0] || session?.user?.name?.[0] || 'U'}
                            size="xlarge"
                            shape="circle"
                            className="bg-white/20 text-white"
                            style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}
                        />
                        <div className="flex-1 text-white">
                            <h1 className="text-3xl font-bold mb-2">
                                {profile?.full_name || profile?.nickname || session?.user?.name || '未设置姓名'}
                            </h1>
                            <div className="flex items-center gap-4 text-white/90">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">学员</span>
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-4 h-4" />
                                    已订阅 0 位教练
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* 个人信息 */}
            <Card className="shadow-lg border-0">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <User className="w-6 h-6 text-blue-500" />
                        个人信息
                    </h2>
                    <Button
                        icon={<Edit className="w-4 h-4" />}
                        label="编辑资料"
                        size="small"
                        outlined
                        onClick={openEditDialog}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                        <div className="text-xs font-medium text-blue-600 mb-2">姓名</div>
                        <div className="text-lg font-semibold text-gray-800">{profile?.full_name || '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                        <div className="text-xs font-medium text-purple-600 mb-2">年龄</div>
                        <div className="text-lg font-semibold text-gray-800">{profile?.age ? `${profile.age} 岁` : '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-5 border border-pink-200">
                        <div className="text-xs font-medium text-pink-600 mb-2">性别</div>
                        <div className="text-lg font-semibold text-gray-800">{getGenderLabel(profile?.gender || null)}</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                        <div className="text-xs font-medium text-green-600 mb-2">身高</div>
                        <div className="text-lg font-semibold text-gray-800">{profile?.height ? `${profile.height} cm` : '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-5 border border-yellow-200">
                        <div className="text-xs font-medium text-yellow-600 mb-2">体重</div>
                        <div className="text-lg font-semibold text-gray-800">{profile?.weight ? `${profile.weight} kg` : '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5 border border-indigo-200">
                        <div className="text-xs font-medium text-indigo-600 mb-2">生活作息</div>
                        <div className="text-sm font-medium text-gray-800">{profile?.lifestyle || '-'}</div>
                    </div>
                </div>
            </Card>

            {/* 运动数据卡片 - 使用 SportCardsDisplay 组件 */}
            {profile?.sport_cards?.activeCards && profile.sport_cards.activeCards.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <Activity className="w-6 h-6 text-green-500" />
                        运动数据
                    </h2>
                    <SportCardsDisplay sportCards={profile.sport_cards} />
                </div>
            )}

            {/* 我的进步 */}
            <Card className="shadow-lg border-0">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800">
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                    我的进步
                </h2>
                <div className="h-48 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="text-center">
                        <TrendingUp className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">暂无进步数据</p>
                        <p className="text-sm text-gray-400 mt-1">开始训练后将自动记录</p>
                    </div>
                </div>
            </Card>

            {/* 进步时间线 */}
            <Card className="shadow-lg border-0">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800">
                    <Calendar className="w-6 h-6 text-yellow-500" />
                    进步时间线
                </h2>
                <div className="h-48 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="text-center">
                        <Calendar className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">暂无里程碑记录</p>
                        <p className="text-sm text-gray-400 mt-1">完成训练目标后自动添加</p>
                    </div>
                </div>
            </Card>

            {/* 我的教练 */}
            <Card className="shadow-lg border-0">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800">
                    <Users className="w-6 h-6 text-indigo-500" />
                    我的教练
                </h2>
                <div className="h-40 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="text-center">
                        <Users className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium mb-3">暂未订阅教练</p>
                        <Button
                            label="发现教练"
                            icon="pi pi-search"
                            size="small"
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
                            onClick={() => router.push('/coach/discovery')}
                        />
                    </div>
                </div>
            </Card>

            {/* 教练观察与建议 */}
            <Card className="shadow-lg border-0">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-gray-800">
                    <MessageSquare className="w-6 h-6 text-green-500" />
                    教练观察与建议
                </h2>
                <div className="h-40 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="text-center">
                        <MessageSquare className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">暂无来自教练的反馈</p>
                    </div>
                </div>
            </Card>

            {/* 编辑资料弹窗 */}
            <Dialog
                header="编辑资料"
                visible={editDialogVisible}
                style={{ width: '500px' }}
                onHide={() => setEditDialogVisible(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button label="取消" outlined onClick={() => setEditDialogVisible(false)} />
                        <Button label="保存" loading={saving} onClick={handleSaveEdit} />
                    </div>
                }
            >
                <div className="space-y-6 pt-4">
                    <FloatLabel>
                        <InputText
                            id="edit_name"
                            value={editForm.full_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                            className="w-full"
                        />
                        <label htmlFor="edit_name">姓名</label>
                    </FloatLabel>

                    <div className="grid grid-cols-2 gap-4">
                        <FloatLabel>
                            <AeroInputNumber
                                id="edit_age"
                                value={editForm.age}
                                onValueChange={(e) => setEditForm({ ...editForm, age: e.value })}
                                className="w-full"
                                suffix=" 岁"
                            />
                            <label htmlFor="edit_age">年龄</label>
                        </FloatLabel>
                        <FloatLabel>
                            <Dropdown
                                id="edit_gender"
                                value={editForm.gender}
                                options={GENDER_OPTIONS}
                                onChange={(e) => setEditForm({ ...editForm, gender: e.value })}
                                className="w-full"
                            />
                            <label htmlFor="edit_gender">性别</label>
                        </FloatLabel>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FloatLabel>
                            <AeroInputNumber
                                id="edit_height"
                                value={editForm.height}
                                onValueChange={(e) => setEditForm({ ...editForm, height: e.value })}
                                className="w-full"
                                suffix=" cm"
                            />
                            <label htmlFor="edit_height">身高</label>
                        </FloatLabel>
                        <FloatLabel>
                            <AeroInputNumber
                                id="edit_weight"
                                value={editForm.weight}
                                onValueChange={(e) => setEditForm({ ...editForm, weight: e.value })}
                                className="w-full"
                                suffix=" kg"
                            />
                            <label htmlFor="edit_weight">体重</label>
                        </FloatLabel>
                    </div>

                    <FloatLabel>
                        <InputText
                            id="edit_lifestyle"
                            value={editForm.lifestyle || ''}
                            onChange={(e) => setEditForm({ ...editForm, lifestyle: e.target.value })}
                            className="w-full"
                        />
                        <label htmlFor="edit_lifestyle">生活作息</label>
                    </FloatLabel>
                </div>
            </Dialog>
        </div>
    );
}
