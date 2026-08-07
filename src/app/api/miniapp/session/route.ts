import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/**
 * Lightweight token probe used by the mini program before removing local auth.
 * A feature endpoint may use 401 for permission failures; only this endpoint is
 * authoritative for deciding whether the stored JWT itself is invalid.
 */
export async function GET(req: NextRequest) {
  const authResult = await getAuthUser(req)

  if (!authResult.isAuthenticated || !authResult.userId) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized', data: null },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    data: { userId: authResult.userId }
  })
}
