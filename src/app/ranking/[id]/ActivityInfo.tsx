import React from 'react';
import { Star, Target, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ActivityInfoProps {
    description: string;
    rules: any[];
}

export default function ActivityInfo({ description, rules }: ActivityInfoProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center mb-4">
                    <Star className="w-6 h-6 text-yellow-500 mr-2" />
                    <h2 className="text-xl font-bold">活动介绍</h2>
                </div>
                <div className="space-y-3 text-gray-700 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                    {description ? (
                        <p>{description}</p>
                    ) : (
                        <p>这是一个精彩的挑战活动，欢迎参与！</p>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center mb-4">
                    <Target className="w-6 h-6 text-red-500 mr-2" />
                    <h2 className="text-xl font-bold">评判标准</h2>
                </div>
                <ul className="space-y-3 text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    {rules?.map((rule: any, idx: number) => (
                        <li key={idx} className="flex items-start">
                            {rule.status === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                            ) : rule.status === 'warning' ? (
                                <AlertTriangle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" />
                            )}
                            {rule.detail}
                        </li>
                    ))}
                    {(!rules || rules.length === 0) && (
                        <>
                            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" /> 一镜到底，禁止剪辑。</li>
                            <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" /> 起始手臂完全伸直，下巴过杠。</li>
                            <li className="flex items-start"><XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" /> 禁止借力，如甩腿或蹬地。</li>
                            <li className="flex items-start"><AlertTriangle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" /> 负重60kg以上需附称重视频。</li>
                        </>
                    )}
                </ul>
            </div>
        </div>
    );
}