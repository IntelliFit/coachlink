import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 获取参数
    const rank = searchParams.get('rank') || '-';
    const score = searchParams.get('score') || '-';
    const name = searchParams.get('name') || '学员';
    const avatar = searchParams.get('avatar');
    const title = searchParams.get('title') || '挑战赛';
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 字体加载 (使用系统字体或在线字体，这里简化使用系统字体回退)
    // 实际生产中建议 fetch 字体文件

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f172a', // slate-900
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '40px',
            position: 'relative',
          }}
        >
          {/* 背景装饰 */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              left: '-100px',
              width: '400px',
              height: '400px',
              background: 'linear-gradient(135deg, #3b82f6 0%, transparent 70%)',
              opacity: 0.3,
              borderRadius: '50%',
              filter: 'blur(80px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, transparent 70%)',
              opacity: 0.3,
              borderRadius: '50%',
              filter: 'blur(80px)',
            }}
          />

          {/* 头部 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#94a3b8', letterSpacing: '4px' }}>
              COACHLINK
            </div>
            <div style={{ 
              fontSize: 48, 
              fontWeight: 900, 
              marginTop: 20, 
              textAlign: 'center',
              backgroundImage: 'linear-gradient(90deg, #60a5fa, #c084fc)',
              backgroundClip: 'text',
              color: 'transparent', 
            }}>
              {title}
            </div>
          </div>

          {/* 核心成绩区 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'baseline', 
              background: 'rgba(255,255,255,0.05)',
              padding: '20px 40px',
              borderRadius: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <span style={{ fontSize: 32, color: '#94a3b8', marginRight: 16 }}>NO.</span>
              <span style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, color: '#fbbf24' }}>
                {rank}
              </span>
            </div>
            
            <div style={{ 
              fontSize: 56, 
              fontWeight: 'bold', 
              marginTop: 40,
              textShadow: '0 4px 20px rgba(0,0,0,0.5)' 
            }}>
              {score}
            </div>
            <div style={{ fontSize: 20, color: '#94a3b8', marginTop: 10 }}>
              {date}
            </div>
          </div>

          {/* 用户信息与底部 */}
          <div style={{ 
            display: 'flex', 
            width: '100%', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'rgba(255,255,255,0.05)',
            padding: '20px',
            borderRadius: '20px',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {avatar && (
                <img
                  src={avatar}
                  width="64"
                  height="64"
                  style={{ borderRadius: '50%', marginRight: 16, border: '2px solid #3b82f6' }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 24, fontWeight: 'bold' }}>{name}</span>
                <span style={{ fontSize: 16, color: '#94a3b8' }}>正在 CoachLink 挑战极限</span>
              </div>
            </div>

            {/* 模拟二维码区域 */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              background: 'white',
              padding: '8px',
              borderRadius: '8px',
            }}>
               <div style={{ width: 48, height: 48, background: '#000', opacity: 0.1 }} /> 
               <span style={{ fontSize: 10, color: '#000', marginTop: 4, fontWeight: 'bold' }}>扫码挑战</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1440,
      },
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
