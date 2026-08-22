export type CameraPoint = {
  x: number
  y: number
}

export type CameraSize = {
  height: number
  width: number
}

export type CameraHeadAnchor = CameraPoint & {
  headRadiusX: number
  headRadiusY: number
}

export type ProjectedHeadAnchor = CameraPoint & {
  radiusX: number
  radiusY: number
}

export type HeadCompanionMetrics = {
  hitboxHalfHeight: number
  hitboxHalfWidth: number
  visualHalfHeight: number
  visualHalfWidth: number
}

type HeadCompanionOptions = {
  gap?: number
  halfHeight?: number
  halfWidth?: number
}

const WEAPP_DESIGN_WIDTH_RPX = 750
const COMPANION_VISUAL_WIDTH_RPX = 64
const COMPANION_VISUAL_HEIGHT_RPX = 48
// 命中框收在小鸟身体内部，翅膀、描边和装饰喙不造成“看起来没碰到却掉命”。
const COMPANION_HITBOX_WIDTH_RPX = 48
const COMPANION_HITBOX_HEIGHT_RPX = 32

/**
 * 工具箱实时相机统一约定：只使用面向用户的前置摄像头，CameraFrame、
 * 检测坐标、页面叠层与合成回放都不再额外做水平翻转。
 */
export const USER_FACING_CAMERA = {
  devicePosition: 'front' as const,
  frameSize: 'medium' as const,
  resolution: 'medium' as const
}

export function projectCameraPointToStage(
  point: CameraPoint,
  frame: CameraSize,
  stage: CameraSize
) {
  if (!frame.width || !frame.height || !stage.width || !stage.height) {
    return point
  }

  let x = point.x
  let y = point.y
  const frameAspect = frame.width / frame.height
  const stageAspect = stage.width / stage.height

  // Camera 组件以 aspect-fill 展示。把模型的整帧坐标换算到裁剪后的可见区域，
  // 避免人物靠近边缘时角色/跟踪点产生持续偏移。
  if (frameAspect > stageAspect) {
    const visibleWidth = stageAspect / frameAspect
    x = (x - (1 - visibleWidth) / 2) / visibleWidth
  } else if (frameAspect < stageAspect) {
    const visibleHeight = frameAspect / stageAspect
    y = (y - (1 - visibleHeight) / 2) / visibleHeight
  }

  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y))
  }
}

export function projectHeadAnchorToStage(
  anchor: CameraHeadAnchor,
  frame: CameraSize,
  stage: CameraSize
) {
  const center = projectCameraPointToStage(anchor, frame, stage)
  const left = projectCameraPointToStage(
    { x: anchor.x - anchor.headRadiusX, y: anchor.y },
    frame,
    stage
  )
  const right = projectCameraPointToStage(
    { x: anchor.x + anchor.headRadiusX, y: anchor.y },
    frame,
    stage
  )
  const top = projectCameraPointToStage(
    { x: anchor.x, y: anchor.y - anchor.headRadiusY },
    frame,
    stage
  )
  const bottom = projectCameraPointToStage(
    { x: anchor.x, y: anchor.y + anchor.headRadiusY },
    frame,
    stage
  )

  return {
    ...center,
    radiusX: Math.max(0, Math.abs(right.x - left.x) / 2),
    radiusY: Math.max(0, Math.abs(bottom.y - top.y) / 2)
  }
}

/**
 * 把小游戏角色放在头框外侧，默认优先位于脸的左边；左侧空间不足时
 * 自动切到右边。角色中心始终与脸中心同高，既能跟随头部，也不会遮住表情。
 */
export function placeCompanionBesideHead(
  anchor: ProjectedHeadAnchor,
  options: HeadCompanionOptions = {}
) {
  const gap = options.gap ?? 0.012
  const halfWidth = options.halfWidth ?? 0.04
  const halfHeight = options.halfHeight ?? 0.024
  const minimumX = halfWidth + 0.024
  const maximumX = 1 - minimumX
  // 头框本身在 UI 中最多展示 24% 宽。定位也必须使用同一上限，避免
  // VisionKit 偶发返回过大的脸框时把小鸟推到屏幕最左边。
  const faceRadiusX = Math.min(0.12, Math.max(0.05, anchor.radiusX))
  const leftX = anchor.x - faceRadiusX - gap - halfWidth
  const rightX = anchor.x + faceRadiusX + gap + halfWidth
  const canUseLeft = leftX >= minimumX
  const canUseRight = rightX <= maximumX
  const x = canUseLeft ? leftX : canUseRight ? rightX : anchor.x <= 0.5 ? rightX : leftX

  return {
    x: Math.min(maximumX, Math.max(minimumX, x)),
    y: Math.min(1 - halfHeight - 0.024, Math.max(halfHeight + 0.024, anchor.y))
  }
}

export function getHeadCompanionMetrics(
  stage: CameraSize,
  viewportWidth: number
): HeadCompanionMetrics {
  if (!stage.width || !stage.height || !viewportWidth) {
    return {
      hitboxHalfHeight: 0.018,
      hitboxHalfWidth: 0.032,
      visualHalfHeight: 0.024,
      visualHalfWidth: 0.04
    }
  }

  const pixelsPerRpx = viewportWidth / WEAPP_DESIGN_WIDTH_RPX
  return {
    hitboxHalfHeight: (COMPANION_HITBOX_HEIGHT_RPX * pixelsPerRpx) / 2 / stage.height,
    hitboxHalfWidth: (COMPANION_HITBOX_WIDTH_RPX * pixelsPerRpx) / 2 / stage.width,
    visualHalfHeight: (COMPANION_VISUAL_HEIGHT_RPX * pixelsPerRpx) / 2 / stage.height,
    visualHalfWidth: (COMPANION_VISUAL_WIDTH_RPX * pixelsPerRpx) / 2 / stage.width
  }
}

export function headCompanionHitsRect(
  player: CameraPoint,
  metrics: HeadCompanionMetrics,
  rect: CameraPoint & CameraSize
) {
  return (
    Math.abs(player.x - rect.x) <= metrics.hitboxHalfWidth + rect.width / 2
    && Math.abs(player.y - rect.y) <= metrics.hitboxHalfHeight + rect.height / 2
  )
}
