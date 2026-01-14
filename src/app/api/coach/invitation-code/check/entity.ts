// DTOs for invitation code check API

export interface CheckInvitationCodeAvailabilityDto {
    invitationCode: string;
}

export interface CheckInvitationCodeAvailabilityResponseDto {
    available: boolean;
    message: string;
}