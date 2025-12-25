import React from 'react';
import { Info } from 'lucide-react';

interface ActivityNoticeProps {
    notice: string;
    className?: string;
}

export default function ActivityNotice({ notice, className }: ActivityNoticeProps) {
    return (
        <div className={`bg-blue-300 rounded-2xl p-6 ${className || ''}`}>
            <div className="flex items-center mb-4">
                <Info className="w-6 h-6 text-blue-500 mr-3" />
                <h3 className="text-xl font-semibold text-blue-500">特别说明</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-surface-100">
                {notice ? (
                    <div className="md:col-span-2">
                        <p>{notice}</p>
                    </div>
                ) : (
                    <>
                        <div>
                            <p><strong>女性参赛者：</strong>最终成绩可乘以1.5倍计算</p>
                            <p><strong>称重要求：</strong>负重60公斤及以上需要拍摄称重视频</p>
                        </div>
                        <div>
                            <p><strong>相关抖音号：</strong>@bannydeer官方旗舰店 @刘三乐 @枭马葛</p>
                            <p><strong>活动解释权：</strong>归主办方所有</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}