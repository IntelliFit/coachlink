'use client'

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Clock, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from 'primereact/button';
import { useState } from 'react';

export default function WaitingPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [tip, setTip] = useState<string | null>(null);

	const coachId = searchParams.get('coachId');

	const handleQuickGenerate = async () => {
		if (!coachId) {
			router.push('/coach/discovery');
			return;
		}
		try {
			setLoading(true);
			setTip('正在为您快速生成计划...');
			const resp = await fetch('/api/user/generate-quick-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ coachId })
			});
			const data = await resp.json();
			if (!resp.ok || !data?.success) {
				throw new Error(data?.message || '快速生成失败');
			}
			const planId = data.data.planId as string;
			router.push(`/coach/plans/dashboard/${planId}`);
		} catch (e: any) {
			setTip(e.message || '快速生成失败，请稍后重试');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center px-4">
			<div className="w-full max-w-2xl bg-surface-50 rounded-xl shadow-sm p-8 text-center">
				<div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
					<Clock className="w-8 h-8 text-primary-600" />
				</div>

				<h1 className="text-2xl font-bold text-surface-900 mb-2">计划创建请求已提交</h1>
				<p className="text-surface-600 mb-6">
					您的信息已发送给教练，正在加急为您制定训练计划。计划完成后，您可以在计划页面查看并开始执行。
				</p>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Button
						label="前往我的计划"
						icon="pi pi-list"
						className="p-button-primary w-full"
						onClick={() => coachId ? router.push(`/coach/plans?coachId=${coachId}`) : router.push('/coach/discovery')}
					/>

					<Button
						label={loading ? '生成中...' : '智能快速生成'}
						className="p-button-outlined w-full"
						disabled={loading}
						onClick={handleQuickGenerate}
					>
						<Zap className="w-4 h-4 mr-2" />
					</Button>
				</div>

				{tip && (
				<div className="mt-6 flex items-start justify-center text-left">
					<CheckCircle2 className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
					<p className="text-sm text-surface-500">{tip}</p>
				</div>
				)}
			</div>
		</div>
	);
}

