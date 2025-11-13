export interface GetLeaderboardDto {
    leaderboardType: 'pullup' | 'bench_press' | 'squat' | 'deadlift'
}

export interface GetLeaderboardResponseDto {
    records: any[]
}