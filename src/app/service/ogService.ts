import { BaseService } from '@/lib/baseService';
import { ApiData } from '@/types/api';

// OG Image related interfaces
import type {
    OgInvitationDto,
    OgInvitationResponseDto
} from '@/app/api/og/invitation/entity';

class OgService extends BaseService {
    /**
     * Generate invitation Open Graph image
     */
    async generateInvitationOgImage(reqData: OgInvitationDto) {
        const res = await this.post<OgInvitationResponseDto>('og/invitation', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }
}

export const ogService = new OgService('/api');