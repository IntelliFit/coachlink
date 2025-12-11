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
            {
                <>
                    <IntakeQuestionSettings coachId={coach.id} />
                </>
            }
        </div>
    );
};

export default QuestionarePage;