export interface BroadcastMessageDto {
  /**
   * When true, send to all active students of the current coach.
   * When false, send to selected student user ids (users.id).
   */
  sendToAll: boolean;
  studentUserIds?: string[];
  /**
   * Text content of the notification.
   */
  content: string;
}

export interface BroadcastMessageResultItem {
  studentUserId: string;
  roomId?: string;
  success: boolean;
  error?: string;
}

export interface BroadcastMessageResponseDto {
  totalTargets: number;
  successCount: number;
  failedCount: number;
  results: BroadcastMessageResultItem[];
}

