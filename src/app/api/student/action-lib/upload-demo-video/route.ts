import { NextResponse } from 'next/server'
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth'
import { cosUpload, buildDatedKey } from '@/lib/cos'
import type { ApiData } from '@/types/api'

export const runtime = 'nodejs'
export const maxDuration = 300
export const preferredRegion = 'auto'

function getRequestId(req: Request) {
  return (
    req.headers.get('x-request-id') ||
    req.headers.get('x-vercel-id') ||
    crypto.randomUUID()
  )
}

export async function POST(req: Request) {
  const requestId = getRequestId(req)

  try {
    const session = await getServerSession()
    const userId = session?.user?.id || null

    if (!userId) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: '用户未登录', data: null },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: '缺少视频文件', data: null },
        { status: 400 }
      )
    }

    if (!file.type?.startsWith('video/')) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: '仅支持上传视频文件', data: null },
        { status: 400 }
      )
    }

    const maxSizeBytes = 200 * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: '视频过大，单个视频请小于 200MB', data: null },
        { status: 413 }
      )
    }

    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const filePath = buildDatedKey(ext, userId, 'student-actions')
    const buffer = new Uint8Array(await file.arrayBuffer())

    let publicUrl: string
    try {
      const uploaded = await cosUpload('videos', filePath, buffer, {
        contentType: file.type
      })
      publicUrl = uploaded.url
    } catch (uploadError: any) {
      console.error(
        `[student-action-lib/upload-demo-video][${requestId}] upload failed:`,
        uploadError
      )
      return NextResponse.json<ApiData<null>>(
        {
          success: false,
          message: uploadError?.message || '上传失败',
          data: null
        },
        { status: 500 }
      )
    }

    return NextResponse.json<ApiData<{ url: string; storage_bucket: string; storage_path: string }>>({
      success: true,
      message: '上传成功',
      data: {
        url: publicUrl,
        storage_bucket: 'videos',
        storage_path: filePath
      }
    })
  } catch (error) {
    console.error(
      `[student-action-lib/upload-demo-video][${requestId}] unexpected error:`,
      error
    )
    return NextResponse.json<ApiData<null>>(
      {
        success: false,
        message: error instanceof Error ? error.message : '上传失败',
        data: null
      },
      { status: 500 }
    )
  }
}
