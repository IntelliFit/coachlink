import React, { useEffect, useState } from 'react';
import { studentService } from '../services/studentService';
import VideoManagement from './video/VideoManagement';

interface StudentProfilePageProps {
  userId?: string;
  onBack?: () => void;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ userId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const profile = await studentService.getStudentProfile(userId);
        setData(profile);
      } catch (e: any) {
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <div className="p-6">加载中...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return null;

  const { profile, questionnaire, videos, lifestyle } = data;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">学员档案</h2>
        {onBack && (
          <button className="text-blue-600" onClick={onBack}>返回</button>
        )}
      </div>

      <section className="bg-white rounded-xl border p-4">
        <h3 className="font-medium mb-2">基本信息</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <div>昵称：{profile?.nickname || '-'}</div>
          <div>性别：{profile?.gender || '-'}</div>
          <div>身高/体重：{profile?.height || '-'} / {profile?.weight || '-'}</div>
          <div>目标：{profile?.fitness_goal || '-'}</div>
          <div>水平：{profile?.fitness_level || '-'}</div>
        </div>
      </section>

      <section className="bg-white rounded-xl border p-4">
        <h3 className="font-medium mb-2">初始问卷</h3>
        {questionnaire ? (
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(questionnaire?.answers, null, 2)}</pre>
        ) : (
          <div className="text-gray-500 text-sm">暂无</div>
        )}
      </section>

      <section className="bg-white rounded-xl border p-4">
        <h3 className="font-medium mb-2">训练视频管理</h3>
        <VideoManagement userId={userId} />
      </section>

      <section className="bg-white rounded-xl border p-4">
        <h3 className="font-medium mb-2">生活记录（近两周）</h3>
        <div className="text-sm divide-y">
          {(lifestyle || []).map((d: any) => (
            <div key={d.id} className="py-2">
              <div className="text-gray-700">{d.log_date} 睡眠：{d.sleep_hours || '-'}小时 质量：{d.sleep_quality || '-'}</div>
              {d.diet_notes && <div className="text-gray-600">饮食：{d.diet_notes}</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default StudentProfilePage;


