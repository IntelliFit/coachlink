import React from 'react';
import { Card } from 'primereact/card';
import { InputSwitch } from 'primereact/inputswitch';

interface Props {
    mode: 'exclusive' | 'open';
    updating: boolean;
    onModeChange: (isExclusive: boolean) => void;
}

export const InvitationModeCard: React.FC<Props> = ({ mode, updating, onModeChange }) => {
    const isExclusive = mode === 'exclusive';

    return (
        <Card title="邀请模式" subTitle="控制通过您邀请码注册的学员在平台上的可见范围">
            <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-50 rounded-lg">
                    <div>
                        <div className="flex items-center gap-2">
                            <i className={`pi ${isExclusive ? 'pi-shield text-orange-500' : 'pi-globe text-blue-500'}`}></i>
                            <span className="font-medium">
                                {isExclusive ? '专属模式' : '开放模式'}
                            </span>
                        </div>
                        <p className="text-sm text-surface-500 mt-1 max-w-md">
                            {isExclusive
                                ? '学员在订阅期内只能看到您的信息，有效防止学员流失'
                                : '学员可以自由浏览平台所有教练，适合开放推广场景'
                            }
                        </p>
                    </div>
                    <InputSwitch
                        checked={isExclusive}
                        onChange={(e) => onModeChange(e.value)}
                        disabled={updating}
                    />
                </div>

                <div className="p-4 bg-surface-100 rounded-lg">
                    <h4 className="font-semibold text-surface-800 mb-3">模式说明</h4>
                    <ul className="space-y-3 text-sm text-surface-600">
                        <li className="flex items-start gap-2">
                            <i className="pi pi-shield text-orange-500 mt-0.5"></i>
                            <span><strong>专属模式</strong>：通过您邀请码注册的学员，在订阅期内只能看到您的内容、计划和信息。</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <i className="pi pi-globe text-blue-500 mt-0.5"></i>
                            <span><strong>开放模式</strong>：学员可以自由浏览平台所有教练和内容。</span>
                        </li>
                    </ul>
                </div>
            </div>
        </Card>
    );
};