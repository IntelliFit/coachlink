export type UploadResult = { ok: boolean; status: number; json: any }

/** 原生上传只给状态码和文本，这里转成和 fetch 差不多的结果；服务端返回的不是 JSON 时 json 为 null。 */
export function readUploadResult(status: number, body: string): UploadResult {
  let json: any = null
  try {
    json = JSON.parse(body)
  } catch {
    json = null
  }
  return { ok: status >= 200 && status < 300, status, json }
}
