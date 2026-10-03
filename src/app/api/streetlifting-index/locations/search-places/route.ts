import { NextResponse } from 'next/server'
import { getServerSession } from '../../../auth/[...nextauth]/auth'
import { PlaceSearchBusyError, searchGlobalPlaces, reverseGlobalPlace } from '@/lib/globalPlaceSearch'
import { isValidLocationCoordinates } from '@coachlink/core'

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 })
    let body: unknown
    try { body = await request.json() } catch { return NextResponse.json({ success: false, message: '搜索参数无效' }, { status: 400 }) }
    if ((body as any)?.mode === 'reverse') {
      const { latitude, longitude } = body as any
      if (!isValidLocationCoordinates(latitude, longitude)) return NextResponse.json({ success: false, message: '地图位置无效' }, { status: 400 })
      const results = await reverseGlobalPlace(latitude, longitude)
      return NextResponse.json({ success: true, data: results })
    }
    const query = typeof (body as any)?.query === 'string' ? (body as any).query.trim() : ''
    if (query.length < 2 || query.length > 160) return NextResponse.json({ success: false, message: '请输入2至160个字符的城市、公园或地址' }, { status: 400 })
    return NextResponse.json({ success: true, data: await searchGlobalPlaces(query) })
  } catch (error) {
    const busy = error instanceof PlaceSearchBusyError
    return NextResponse.json({ success: false, message: busy ? error.message : '地点搜索暂不可用，可直接在地图上选点' }, { status: busy ? 429 : 502 })
  }
}
