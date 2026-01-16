import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import qrcode from 'qrcode-generator';

export const runtime = 'edge';

const themeColor = '#F28631';

export async function POST(req: NextRequest) {
    try {
        const { coachId } = await req.json();

        const loadBoldFont = fetch(
            new URL(process.env.NEXTAUTH_URL + '/fonts/AlibabaPuHuiTi-3-85-Bold.ttf')
        ).then((res) => res.arrayBuffer());

        const loadChineseFont = fetch(
            new URL(process.env.NEXTAUTH_URL + '/fonts/AlibabaPuHuiTi-3-55-Regular.ttf')
        ).then((res) => res.arrayBuffer());

        const [boldFontData, chineseFontData] = await Promise.all([
            loadBoldFont,
            loadChineseFont
        ]);

        // 1. 获取教练数据
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: coach, error } = await supabase.from('coaches').select('*').eq('id', coachId).single();
        if (error || !coach) throw new Error('Coach not found');

        // 2. 预抓取资源：Favicon 图标
        const iconUrl = `${process.env.NEXTAUTH_URL}/favicon.jpg`;
        const iconData = await fetch(iconUrl).then(res => res.arrayBuffer()).catch(() => null);

        // 3. 生成二维码
        const registerUrl = `${req.nextUrl.origin}/register?invite=${coach.invitation_code}&mode=${coach.invitation_mode}`;
        const qr = qrcode(0, 'M');
        qr.addData(registerUrl);
        qr.make();
        const qrCodeBase64 = qr.createDataURL(10, 0);

        return new ImageResponse(
            (
                <div style={{
                    height: '1000px',
                    width: '800px',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#07111f',
                    fontFamily: 'CustomBold',
                    backgroundImage: `
                    radial-gradient(ellipse 2000px 1200px at 50% -60px, rgba(242, 134, 49, 0.35) 0%, rgba(242, 134, 49, 0.1) 45%, transparent 80%),
                    linear-gradient(180deg, #0d1a2d 0%, #07111f 100%)
                    `,
                    padding: '80px 60px',
                    color: 'white',
                    position: 'relative'
                }}>
                    {/* 1. 顶部品牌区 */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        position: 'relative',
                        zIndex: 10,
                        width: '100%'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{
                                fontSize: '24px', // 对应 text-[12px] 放大
                                fontWeight: 900,
                                letterSpacing: '0.2em',
                                color: 'white'
                            }}>
                                COACHLINK<span style={{ color: themeColor }}>.FIT</span>
                            </span>
                            <span style={{
                                fontSize: '14px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                marginTop: '4px',
                                color: 'rgba(255,255,255,0.4)'
                            }}>
                                教链 - 专业数字化教练平台
                            </span>
                        </div>

                        {/* 右侧 Logo 图片框 */}
                        <div style={{
                            display: 'flex',
                            height: '64px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            overflow: 'hidden'
                        }}>
                            {iconData ? (
                                <img
                                    src={iconData as any}
                                    style={{
                                        height: '64px',
                                    }}
                                />
                            ) : (
                                // 备用占位，防止 iconData 加载失败导致布局崩溃
                                <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                            )}
                        </div>
                    </div>

                    {/* 教练主体信息 - 修正内容包装 */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'center'
                    }}>
                        <img
                            src={coach.avatar_url || 'https://via.placeholder.com/200'}
                            style={{
                                width: '160px',
                                height: '160px',
                                borderRadius: '40px',
                                marginBottom: '40px',
                                objectFit: 'cover',
                                border: '4px solid rgba(255,255,255,0.1)'
                            }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ fontSize: '84px', fontWeight: 900 }}>{coach.name}</span>
                            <div style={{
                                marginLeft: '24px',
                                display: 'flex',
                                background: 'rgba(242,134,49,0.15)',
                                padding: '8px 20px',
                                borderRadius: '12px',
                                border: '1px solid #F28631'
                            }}>
                                <span style={{ color: themeColor, fontSize: '24px', fontWeight: 'bold' }}>{coach.years_experience} 年经验</span>
                            </div>
                        </div>
                        <span style={{ fontSize: '32px', opacity: 0.7 }}>{coach.title}</span>
                        {/* 装饰线条 */}
                        <div style={{ display: 'flex', width: '80px', height: '6px', backgroundColor: themeColor, marginTop: '40px' }} />
                    </div>

                    {/* 底部扫码卡片 */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: '40px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: '32px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <img src={qrCodeBase64} style={{ width: '180px', height: '180px', borderRadius: '16px', backgroundColor: 'white', padding: '10px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '32px' }}>
                            <span style={{ fontSize: '32px', fontWeight: 'bold' }}>立即扫码加入</span>
                            <span style={{ fontSize: '20px', opacity: 0.5, marginTop: '10px' }}>扫码建立专属教练关联 <br />
                                开启数字化训练体验</span>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 800,
                height: 1000,
                fonts: [
                    {
                        name: 'CustomBold',
                        data: chineseFontData,
                        style: 'normal',
                        weight: 900, // 明确告知 Satori 这是 900 字重
                    },
                    {
                        name: 'Inter',
                        data: boldFontData,
                        style: 'normal',
                        weight: 900,
                    },
                ],
            }
        );
    } catch (error: any) {
        console.error('OG Error:', error.message);
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}