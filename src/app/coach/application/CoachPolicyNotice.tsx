'use client';

import React from 'react';
import Link from 'next/link';
import { Checkbox } from 'primereact/checkbox';
import {
    COACH_APPLICATION_POLICY_CONSENT,
    COACH_APPLICATION_POLICY_POINTS,
    COACH_HANDBOOK_PATH,
} from '@coachlink/core/src/coachPolicy';

interface CoachPolicyNoticeProps {
    accepted: boolean;
    onChange: (accepted: boolean) => void;
}

/** 申请页「入驻须知」：提交前必须勾选同意。 */
export default function CoachPolicyNotice({ accepted, onChange }: CoachPolicyNoticeProps) {
    return (
        <div className="mt-6 rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-surface-900 m-0">入驻须知</h3>
                <Link href={COACH_HANDBOOK_PATH} target="_blank" className="text-sm text-primary-600">
                    查看《教练手册》
                </Link>
            </div>
            <ul className="m-0 pl-5 flex flex-col gap-2 text-sm text-surface-700">
                {COACH_APPLICATION_POLICY_POINTS.map((point) => (
                    <li key={point}>{point}</li>
                ))}
            </ul>
            <label htmlFor="coachPolicyAccepted" className="mt-4 flex items-start gap-2 text-sm text-surface-900 cursor-pointer">
                <Checkbox
                    inputId="coachPolicyAccepted"
                    checked={accepted}
                    onChange={(e) => onChange(!!e.checked)}
                />
                <span>{COACH_APPLICATION_POLICY_CONSENT}</span>
            </label>
        </div>
    );
}
