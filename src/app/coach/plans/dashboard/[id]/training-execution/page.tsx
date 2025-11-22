/**
 * 训练执行页面 - 独立路由页面
 * 
 * 路由: /coach/plans/dashboard/[id]/training-execution?week=1&day=1&readOnly=false
 */

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import TrainingExecution from '../components/TrainingExecution';
import { Skeleton } from 'primereact/skeleton';

function TrainingExecutionContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const [loading, setLoading] = useState(true);
  
  const planId = params.id as string;
  const weekNumber = parseInt(searchParams.get('week') || '1');
  const dayNumber = parseInt(searchParams.get('day') || '1');
  const readOnly = searchParams.get('readOnly') === 'true';
  
  useEffect(() => {
    // 确保 session 加载完成
    if (session !== undefined) {
      setLoading(false);
    }
  }, [session]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex align-items-center justify-content-center bg-surface">
        <div className="text-center">
          <Skeleton width="4rem" height="4rem" shape="circle" className="mx-auto mb-4" />
          <Skeleton width="10rem" height="1.5rem" />
        </div>
      </div>
    );
  }
  
  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex align-items-center justify-content-center bg-surface">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-900 mb-2">未登录</h2>
          <p className="text-600">请先登录</p>
        </div>
      </div>
    );
  }
  
  return (
    <TrainingExecution
      userId={session.user.id}
      planId={planId}
      weekNumber={weekNumber}
      dayNumber={dayNumber}
      readOnly={readOnly}
      onBack={() => {
        router.push(`/coach/plans/dashboard/${planId}`);
      }}
      onFinish={() => {
        // 训练完成后，添加 refresh 参数以触发主页面刷新
        router.push(`/coach/plans/dashboard/${planId}?refresh=true`);
      }}
    />
  );
}

export default function TrainingExecutionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex align-items-center justify-content-center bg-surface">
        <div className="text-center">
          <Skeleton width="4rem" height="4rem" shape="circle" className="mx-auto mb-4" />
          <Skeleton width="10rem" height="1.5rem" />
        </div>
      </div>
    }>
      <TrainingExecutionContent />
    </Suspense>
  );
}

