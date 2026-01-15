import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { NextResponse } from "next/server";
import { ApiData } from "@/types/api";
import type { GenerateInvitationOgImageDto } from './entity';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);

    // 获取动态参数
    const name = searchParams.get('name') || '主教练';
    const title = searchParams.get('title') || '专业健身指导';
    const experience = searchParams.get('exp');
    const avatar = searchParams.get('avatar');
    const qrCode = searchParams.get('qr');

    const themeColor = '#F28631';

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#07111f',
                    backgroundImage: `radial-gradient(circle at 0% 0%, rgba(242,134,49,0.25) 0%, transparent 55%), radial-gradient(circle at 100% 10%, rgba(242,134,49,0.18) 0%, transparent 55%)`,
                    padding: '40px',
                    color: 'white',
                }}
            >
                {/* 顶部品牌 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '2px' }}>
                            COACHLINK<span style={{ color: themeColor }}>.FIT</span>
                        </span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                            教链 - 专业数字化教练平台
                        </span>
                    </div>
                </div>

                {/* 教练信息 */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                    <img
                        src={avatar || 'https://your-default-avatar.com/c.png'}
                        style={{ width: '80px', height: '80px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.2)', marginBottom: '24px', objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '8px' }}>
                        <span style={{ fontSize: '48px', fontWeight: 900, fontStyle: 'italic', marginRight: '12px' }}>{name}</span>
                        {experience && (
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <span style={{ color: themeColor, fontSize: '14px', fontWeight: 900 }}>
                                    {experience.includes('年经验') ? experience.replace('年经验', '') : experience}
                                </span>
                                <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.7 }}>年经验</span>
                            </div>
                        )}
                    </div>
                    <span style={{ fontSize: '16px', opacity: 0.6, letterSpacing: '2px' }}>{title}</span>
                    <div style={{ width: '32px', height: '4px', backgroundColor: themeColor, marginTop: '16px' }} />
                </div>

                {/* 底部扫码区 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={qrCode!} style={{ width: '80px', height: '80px', padding: '8px', backgroundColor: 'white', borderRadius: '12px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '16px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 900 }}>立即扫码加入</span>
                        <span style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>扫码建立专属教练关联</span>
                    </div>
                </div>
            </div>
        ),
        {
            width: 400,
            height: 600,
        }
    );
}

// For the POST endpoint, we'll return the URL that can be used to generate the image
// This follows the pattern of creating a URL that can be used for image generation
export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as GenerateInvitationOgImageDto;

        // Construct query parameters from the request body
        const params = new URLSearchParams();
        if (body.name) params.append('name', body.name);
        if (body.title) params.append('title', body.title);
        if (body.experience) {
            // Extract numeric value if it contains "年经验"
            const expValue = body.experience.includes('年经验')
                ? body.experience.replace('年经验', '')
                : body.experience;
            params.append('exp', expValue);
        }
        if (body.avatar) params.append('avatar', body.avatar);
        if (body.qrCode) params.append('qr', body.qrCode);

        // Return the URL that can be used to generate the image
        const imageUrl = `${req.nextUrl.origin}/api/og/invitation?${params.toString()}`;

        return NextResponse.json<ApiData<{ imageUrl: string }>>({
            success: true,
            message: "邀请海报URL生成成功",
            data: {
                imageUrl
            },
        });
    } catch (error: any) {
        console.error('Error generating invitation OG image URL:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || "生成邀请海报URL失败",
            data: null,
        }, { status: 500 });
    }
}