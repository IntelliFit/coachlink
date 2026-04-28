import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

import type { ApiData } from '@/types/api';
import type { DeleteCoachReviewsDto, DeleteCoachReviewsResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: 'User is not logged in',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: 'User is not a coach',
            data: null
        }, { status: 403 });
    }

    const {
        reviewId
    } = await req.json() as DeleteCoachReviewsDto;

    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

    if (coachError) {
        return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
            success: false,
            message: coachError.message,
            data: null
        }, { status: 500 });
    }

    if (!coach?.id) {
        return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
            success: false,
            message: 'Coach profile not found',
            data: null
        }, { status: 403 });
    }

    const { data: deletedReview, error } = await supabase
        .from('coach_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('coach_id', coach.id)
        .select('id')
        .maybeSingle();

    if (error) {
        return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
            success: false,
            message: error.message || 'Failed to delete coach review',
            data: null
        }, { status: 500 });
    }

    if (!deletedReview) {
        return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
            success: false,
            message: 'No permission to delete this coach review',
            data: null
        }, { status: 403 });
    }

    return NextResponse.json<ApiData<DeleteCoachReviewsResponseDto>>({
        success: true,
        message: 'Coach review deleted',
        data: null
    });
}
