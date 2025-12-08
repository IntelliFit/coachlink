'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import IntakeQuestionSettings from './QuestionSettings';
import { Card } from 'primereact/card';
import { Pricing } from '@/app/api/coach/get-pricing/entity';

const QuestionarePage = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">问卷</h1>
                </div>
            </div>

            {
                <>
                    <IntakeQuestionSettings coachId={coach.id} />
                </>
            }
        </div>
    );
};

export default QuestionarePage;