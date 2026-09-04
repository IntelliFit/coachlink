export interface DeleteAccountDto {
    confirmationText: string;
}

export interface DeleteAccountResponseDto {
    success: true;
    deletionRequestId: string;
    pendingDataDeletion: true;
}
