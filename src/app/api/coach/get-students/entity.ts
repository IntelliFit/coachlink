export interface GetStudentsDto {

}

export interface StudentSubscription {
    id: string;
    student_id: string;
    tier: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    updated_at: string;
    user: {
        id: string;
        email: string;
        nickname: string | null;
        primary_role: string | null;
    } | null;
    profile: {
        user_id: string;
        nickname: string | null;
        avatar_url: string | null;
        fitness_level: string | null;
    } | null;
}

export interface GetStudentsResponseDto {
    students: StudentSubscription[];
}