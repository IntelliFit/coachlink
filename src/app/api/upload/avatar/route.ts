import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { cosUpload, buildDatedKey } from '@/lib/cos'

const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export async function POST(req: Request) {
  try {
    const authResult = await getAuthUser(req)
    if (!authResult.isAuthenticated || !authResult.userId) {
      return NextResponse.json(
        { success: false, message: '用户未登录' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, message: '未选择文件' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: '仅支持 PNG/JPEG/WEBP 图片' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, message: '图片大小不能超过 2MB' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.type.split('/')[1] || 'png'
    const key = buildDatedKey(ext, authResult.userId)

    const { url } = await cosUpload('avatars', key, buffer, { contentType: file.type })

    return NextResponse.json({
      success: true,
      message: '上传成功',
      data: { url },
    })
  } catch (err: any) {
    console.error('upload avatar unexpected error', err)
    return NextResponse.json(
      { success: false, message: err?.message || '上传失败' },
      { status: 500 }
    )
  }
}
