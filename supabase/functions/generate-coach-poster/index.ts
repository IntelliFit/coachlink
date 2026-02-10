import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import satori from 'https://esm.sh/satori@0.1.0';
import React from 'https://esm.sh/react@18';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const themeColor = '#F28631';

// Helper function to validate and load image as data URL
async function loadImageAsDataUrl(url: string, label: string = 'image'): Promise<string | null> {
  try {
    console.log(`[${label}] Loading image from: ${url}`);
    const response = await fetch(url, { 
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.warn(`[${label}] HTTP error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    console.log(`[${label}] Content-Type: ${contentType}`);
    
    if (!contentType.startsWith('image/')) {
      console.warn(`[${label}] Invalid image content type: ${contentType}`);
      // Try to read first few bytes to see what we got
      const text = await response.text();
      console.warn(`[${label}] Response preview: ${text.substring(0, 200)}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[${label}] Loaded ${arrayBuffer.byteLength} bytes`);
    
    // Verify it's actually an image by checking magic bytes
    const bytes = new Uint8Array(arrayBuffer);
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const isSVG = bytes[0] === 0x3C || (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF && bytes[3] === 0x3C);
    
    if (!isJPEG && !isPNG && !isGIF && !isSVG) {
      console.warn(`[${label}] File doesn't appear to be a valid image (magic bytes: ${Array.from(bytes.slice(0, 4)).map(b => '0x' + b.toString(16)).join(', ')})`);
      return null;
    }
    
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    const dataUrl = `data:${contentType};base64,${btoa(binary)}`;
    console.log(`[${label}] Successfully converted to data URL (${dataUrl.length} chars)`);
    return dataUrl;
  } catch (e) {
    console.error(`[${label}] Failed to load image from ${url}:`, e);
    return null;
  }
}

// QR Code generator using a simple approach
// For production, consider using: https://deno.land/x/qrcode
async function generateQRCode(data: string): Promise<string> {
  try {
    // Use an external QR code API as a fallback
    // Or implement a simple QR code generator
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data)}`;
    const response = await fetch(qrApiUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
      return `data:image/png;base64,${btoa(binary)}`;
    }
  } catch (e) {
    console.error('QR code generation failed:', e);
  }
  
  // Fallback: return a simple placeholder
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
      <rect width="180" height="180" fill="white"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" fill="black">QR Code</text>
    </svg>
  `)}`;
}

Deno.serve(async (req) => {
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    // Parse request body
    const { coachId } = await req.json();
    
    if (!coachId) {
      return new Response(JSON.stringify({
        error: 'coachId is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch coach data
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return new Response(JSON.stringify({
        error: 'Coach not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 2. Load fonts
    const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('NEXTAUTH_URL') || 'https://coachlink.fit';
    
    const [boldFontData, chineseFontData] = await Promise.all([
      fetch(`${APP_URL}/fonts/AlibabaPuHuiTi-3-85-Bold.ttf`)
        .then(res => res.arrayBuffer())
        .catch(() => null),
      fetch(`${APP_URL}/fonts/AlibabaPuHuiTi-3-55-Regular.ttf`)
        .then(res => res.arrayBuffer())
        .catch(() => null)
    ]);

    // 3. Load favicon with proper error handling
    const iconUrl = `${APP_URL}/favicon.jpg`;
    console.log(`[favicon] APP_URL: ${APP_URL}, iconUrl: ${iconUrl}`);
    const iconData = await loadImageAsDataUrl(iconUrl, 'favicon');
    
    // 4. Load and validate coach avatar
    let avatarDataUrl: string | null = null;
    if (coach.avatar_url && coach.avatar_url.startsWith('http')) {
      console.log(`[avatar] Loading coach avatar from: ${coach.avatar_url}`);
      avatarDataUrl = await loadImageAsDataUrl(coach.avatar_url, 'avatar');
    } else {
      console.log(`[avatar] No valid avatar URL, using placeholder`);
    }

    // 5. Generate QR code
    const registerUrl = `https://coachlink.fit/register?invite=${coach.invitation_code}&mode=${coach.invitation_mode}`;
    const qrCodeBase64 = await generateQRCode(registerUrl);

    // 6. Generate SVG using Satori with React elements
    const svg = await satori(
      React.createElement('div', {
        style: {
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
        }
      }, [
        // Top brand section
        React.createElement('div', {
          key: 'brand',
          style: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 10,
            width: '100%'
          }
        }, [
          React.createElement('div', {
            key: 'brand-text',
            style: { display: 'flex', flexDirection: 'column' }
          }, [
            React.createElement('span', {
              key: 'logo',
              style: {
                fontSize: '24px',
                fontWeight: 900,
                letterSpacing: '0.2em',
                color: 'white'
              }
            }, [
              'COACHLINK',
              React.createElement('span', {
                key: 'fit',
                style: { color: themeColor }
              }, '.FIT')
            ]),
            React.createElement('span', {
              key: 'tagline',
              style: {
                fontSize: '14px',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginTop: '4px',
                color: 'rgba(255,255,255,0.4)'
              }
            }, '教链 - 专业数字化教练平台')
          ]),
          React.createElement('div', {
            key: 'logo-img',
            style: {
              display: 'flex',
              height: '64px',
              border: '1px solid rgba(255,255,255,0.2)',
              overflow: 'hidden'
            }
          }, iconData ? React.createElement('img', {
            src: iconData,
            style: { height: '64px', width: '64px', objectFit: 'cover' }
          }) : React.createElement('div', {
            style: {
              display: 'flex',
              width: '64px',
              height: '64px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: 'rgba(255,255,255,0.5)'
            }
          }, 'C'))
        ]),
        // Coach main info
        React.createElement('div', {
          key: 'coach-info',
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center'
          }
        }, [
          // Avatar image - use data URL if available, otherwise placeholder
          avatarDataUrl 
            ? React.createElement('img', {
                key: 'avatar',
                src: avatarDataUrl,
                style: {
                  width: '160px',
                  height: '160px',
                  borderRadius: '40px',
                  marginBottom: '40px',
                  objectFit: 'cover',
                  border: '4px solid rgba(255,255,255,0.1)'
                }
              })
            : React.createElement('div', {
                key: 'avatar',
                style: {
                  width: '160px',
                  height: '160px',
                  borderRadius: '40px',
                  marginBottom: '40px',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '4px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '64px',
                  fontWeight: 'bold',
                  color: 'rgba(255,255,255,0.5)'
                }
              }, (coach.name || '教').charAt(0)),
          React.createElement('div', {
            key: 'name-row',
            style: {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: '16px'
            }
          }, [
            React.createElement('span', {
              key: 'name',
              style: { fontSize: '84px', fontWeight: 900 }
            }, coach.name || '教练'),
            React.createElement('div', {
              key: 'experience',
              style: {
                marginLeft: '24px',
                display: 'flex',
                background: 'rgba(242,134,49,0.15)',
                padding: '8px 20px',
                borderRadius: '12px',
                border: '1px solid #F28631'
              }
            }, React.createElement('span', {
              style: { color: themeColor, fontSize: '24px', fontWeight: 'bold' }
            }, `${coach.years_experience || 0} 年经验`))
          ]),
          React.createElement('span', {
            key: 'title',
            style: { fontSize: '32px', opacity: 0.7 }
          }, coach.title || ''),
          React.createElement('div', {
            key: 'divider',
            style: {
              display: 'flex',
              width: '80px',
              height: '6px',
              backgroundColor: themeColor,
              marginTop: '40px'
            }
          })
        ]),
        // Bottom QR code card
        React.createElement('div', {
          key: 'qr-card',
          style: {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '40px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '32px',
            border: '1px solid rgba(255,255,255,0.1)'
          }
        }, [
          qrCodeBase64 && qrCodeBase64.startsWith('data:image') ? React.createElement('img', {
            key: 'qr',
            src: qrCodeBase64,
            style: {
              width: '180px',
              height: '180px',
              borderRadius: '16px',
              backgroundColor: 'white',
              padding: '10px'
            }
          }) : React.createElement('div', {
            key: 'qr',
            style: {
              width: '180px',
              height: '180px',
              borderRadius: '16px',
              backgroundColor: 'white',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#000',
              textAlign: 'center'
            }
          }, 'QR Code'),
          React.createElement('div', {
            key: 'qr-text',
            style: {
              display: 'flex',
              flexDirection: 'column',
              marginLeft: '32px'
            }
          }, [
            React.createElement('span', {
              key: 'qr-title',
              style: { fontSize: '32px', fontWeight: 'bold' }
            }, '立即扫码加入'),
            React.createElement('span', {
              key: 'qr-desc',
              style: { fontSize: '20px', opacity: 0.5, marginTop: '10px' }
            }, '扫码建立专属教练关联\n开启数字化训练体验')
          ])
        ])
      ]),
      {
        width: 800,
        height: 1000,
        fonts: [
          ...(chineseFontData ? [{
            name: 'CustomBold',
            data: chineseFontData,
            style: 'normal' as const,
            weight: 900
          }] : []),
          ...(boldFontData ? [{
            name: 'Inter',
            data: boldFontData,
            style: 'normal' as const,
            weight: 900
          }] : [])
        ]
      }
    );

    // 7. Return SVG directly
    // Note: @resvg/resvg-js requires native bindings not available in Supabase Edge Functions
    // SVG can be converted to PNG on the client side using libraries like sharp, canvas, or
    // by using an external conversion service
    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('OG Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
