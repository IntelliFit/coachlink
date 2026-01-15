import { BaseService } from '@/lib/baseService'; 
import { ApiData } from '@/types/api'; 
 
"// OG Image related interfaces" 
"import type {" 
"    GenerateInvitationOgImageDto," 
"    GenerateInvitationOgImageResponseDto" 
"} from '@/app/api/og/invitation/entity';" 
 
"class OgService extends BaseService {" 
"    /**" 
"     * Generate invitation Open Graph image" 
"     */" 
"    async generateInvitationOgImage(reqData: GenerateInvitationOgImageDto) {" 
"        const res = await this.post<GenerateInvitationOgImageResponseDto>('og/invitation', reqData);" 
"        if (res.data && res.data.success) {" 
"            return res.data.data || null;" 
"        }" 
"    }" 
"}" 
 
"export const ogService = new OgService('/api');" 
