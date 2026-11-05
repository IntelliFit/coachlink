/**
 * 从微信人脸识别结果里取“眼睛那一条线”的高度（0–1，画面高度为 1）。
 *
 * 人脸框的中心大约在鼻子，张嘴、用力皱脸时下巴把框撑大，中心会往下跑。
 * 眼睛这条线不受嘴巴影响：取 106 个五官关键点里最靠上的一带（眉毛、眼睛、太阳穴处的轮廓），
 * 用中位数抗个别点跳动。官方没写每个点的编号，所以不依赖编号。
 * 取不到关键点时，退回用人脸框上沿往下推：框的上沿和宽度都不受张嘴影响。
 */

export type FacePoint = { x: number; y: number }

export type EyeLine = { eyeY: number; source: 'box' | 'points' }

type FaceGeometry = {
  frameHeight: number
  frameWidth: number
  /** 人脸框上沿，0–1 */
  originY: number
  points?: unknown
  /** 人脸框宽度，0–1（以画面宽为 1） */
  sizeWidth: number
}

const MIN_POINTS = 20
/** 关键点最上沿往下这么多个“脸宽”以内算眼睛这一带。 */
const EYE_BAND = 0.28
/** 退回方案：眼睛大约在框上沿往下 0.42 个脸宽。 */
const BOX_EYE_OFFSET = 0.42

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** 关键点可能是 0–1，也可能是像素；按实际数值判断，统一成 0–1。 */
export function normalizeFacePoints(points: unknown, frameWidth: number, frameHeight: number): FacePoint[] {
  if (!Array.isArray(points)) return []
  const parsed = points
    .map((point: any) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  const inPixels = parsed.some((point) => point.x > 1.5 || point.y > 1.5)
  if (!inPixels) return parsed
  if (!frameWidth || !frameHeight) return []
  return parsed.map((point) => ({ x: point.x / frameWidth, y: point.y / frameHeight }))
}

type ScoredPoint = { score: number; x: number; y: number }

/**
 * 兼容识别（17 个人体关键点：0 鼻子，1–2 眼睛，3–4 耳朵）里的眼睛高度。
 * 两眼优先；看不清眼睛时用耳朵，耳朵和眼睛差不多高。鼻子在眼睛下面，不算。
 */
export function eyeYFromPose(points: ScoredPoint[], minScore: number): number | undefined {
  const pick = (indices: number[]) => indices
    .map((index) => points[index])
    .filter((point) => point && point.score >= minScore)
  const eyes = pick([1, 2])
  const source = eyes.length ? eyes : pick([3, 4])
  if (!source.length) return undefined
  return source.reduce((sum, point) => sum + point.y, 0) / source.length
}

export function eyeLineFromFace(face: FaceGeometry): EyeLine {
  const aspect = face.frameHeight > 0 ? face.frameWidth / face.frameHeight : 0.75
  const faceWidthY = face.sizeWidth * aspect
  const points = normalizeFacePoints(face.points, face.frameWidth, face.frameHeight)
  if (points.length >= MIN_POINTS && faceWidthY > 0) {
    const top = Math.min(...points.map((point) => point.y))
    const band = points.map((point) => point.y).filter((y) => y <= top + faceWidthY * EYE_BAND)
    if (band.length >= 8) return { eyeY: median(band), source: 'points' }
  }
  return { eyeY: face.originY + faceWidthY * BOX_EYE_OFFSET, source: 'box' }
}
