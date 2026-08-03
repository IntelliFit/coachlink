import Taro from '@tarojs/taro'

export type LivePoint = {
  x: number
  y: number
}

export type LiveHand = {
  confidence?: number[]
  points: LivePoint[]
  score?: number
}

export type LivePreviewStyle = {
  colors: string[]
  glowAlpha: number
  surfaceAlpha: number
}

type CanvasSize = {
  height: number
  width: number
}

type FrameSize = CanvasSize

const FINGER_CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20]
] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(first: LivePoint, second: LivePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function jointAngle(first: LivePoint, middle: LivePoint, last: LivePoint) {
  const ax = first.x - middle.x
  const ay = first.y - middle.y
  const bx = last.x - middle.x
  const by = last.y - middle.y
  const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by)
  if (denominator < 0.000001) return 0
  return Math.acos(clamp((ax * bx + ay * by) / denominator, -1, 1))
}

function fingerExtensionScore(points: LivePoint[], fingerIndex: number) {
  const [mcpIndex, pipIndex, dipIndex, tipIndex] = FINGER_CHAINS[fingerIndex]
  const mcp = points[mcpIndex]
  const pip = points[pipIndex]
  const dip = points[dipIndex]
  const tip = points[tipIndex]
  const wrist = points[0]
  if (!mcp || !pip || !dip || !tip || !wrist) return 0

  const pathLength = distance(mcp, pip) + distance(pip, dip) + distance(dip, tip)
  const straightness = pathLength
    ? clamp((distance(mcp, tip) / pathLength - 0.58) / 0.4, 0, 1)
    : 0
  const firstAngle = clamp((jointAngle(mcp, pip, dip) - 1.72) / 1.18, 0, 1)
  const secondAngle = clamp((jointAngle(pip, dip, tip) - 1.72) / 1.18, 0, 1)

  if (fingerIndex === 0) {
    const palmWidth = Math.max(distance(points[5], points[17]), 0.0001)
    const thumbSpread = clamp((distance(tip, points[5]) / palmWidth - 0.52) / 0.78, 0, 1)
    return straightness * 0.34 + firstAngle * 0.2 + secondAngle * 0.18 + thumbSpread * 0.28
  }

  const baseDistance = Math.max(distance(wrist, mcp), 0.0001)
  const reach = clamp((distance(wrist, tip) / baseDistance - 1.42) / 1.15, 0, 1)
  return straightness * 0.34 + firstAngle * 0.23 + secondAngle * 0.23 + reach * 0.2
}

function toCanvasPoint(
  point: LivePoint,
  frame: FrameSize,
  canvas: CanvasSize,
  mirrored: boolean
) {
  const isNormalized = Math.abs(point.x) <= 2 && Math.abs(point.y) <= 2
  let normalizedX = isNormalized ? point.x : point.x / Math.max(1, frame.width)
  let normalizedY = isNormalized ? point.y : point.y / Math.max(1, frame.height)
  if (mirrored) normalizedX = 1 - normalizedX

  const frameAspect = frame.width / Math.max(1, frame.height)
  const canvasAspect = canvas.width / Math.max(1, canvas.height)
  if (frameAspect > canvasAspect) {
    const visibleWidth = canvasAspect / frameAspect
    normalizedX = (normalizedX - (1 - visibleWidth) / 2) / visibleWidth
  } else if (frameAspect < canvasAspect) {
    const visibleHeight = frameAspect / canvasAspect
    normalizedY = (normalizedY - (1 - visibleHeight) / 2) / visibleHeight
  }

  return {
    x: normalizedX * canvas.width,
    y: normalizedY * canvas.height
  }
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return `rgba(207, 109, 78, ${alpha})`
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function drawLine(context: any, start: LivePoint, end: LivePoint, color: string, alpha: number) {
  context.beginPath()
  context.moveTo(start.x, start.y)
  context.lineTo(end.x, end.y)
  context.setLineCap('round')
  context.setLineWidth(2)
  context.setStrokeStyle(hexToRgba(color, alpha))
  context.setShadow(0, 0, 8, hexToRgba(color, Math.min(1, alpha + 0.28)))
  context.stroke()
}

function drawNode(context: any, point: LivePoint, color: string, alpha: number) {
  context.beginPath()
  context.arc(point.x, point.y, 7, 0, Math.PI * 2)
  context.setFillStyle(hexToRgba(color, alpha * 0.28))
  context.setShadow(0, 0, 12, hexToRgba(color, alpha))
  context.fill()
  context.beginPath()
  context.arc(point.x, point.y, 3, 0, Math.PI * 2)
  context.setFillStyle(`rgba(255, 255, 255, ${Math.min(1, alpha + 0.18)})`)
  context.fill()
}

function drawMembrane(
  context: any,
  left: LivePoint,
  right: LivePoint,
  nextLeft: LivePoint,
  nextRight: LivePoint,
  color: string,
  alpha: number
) {
  context.beginPath()
  context.moveTo(left.x, left.y)
  context.lineTo(right.x, right.y)
  context.lineTo(nextRight.x, nextRight.y)
  context.lineTo(nextLeft.x, nextLeft.y)
  context.closePath()
  context.setFillStyle(hexToRgba(color, alpha))
  context.setShadow(0, 0, 16, hexToRgba(color, Math.min(0.86, alpha + 0.24)))
  context.fill()
}

function segmentIntersection(
  firstStart: LivePoint,
  firstEnd: LivePoint,
  secondStart: LivePoint,
  secondEnd: LivePoint
) {
  const firstVector = {
    x: firstEnd.x - firstStart.x,
    y: firstEnd.y - firstStart.y
  }
  const secondVector = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y
  }
  const denominator = firstVector.x * secondVector.y - firstVector.y * secondVector.x
  if (Math.abs(denominator) < 0.0001) return false
  const delta = {
    x: secondStart.x - firstStart.x,
    y: secondStart.y - firstStart.y
  }
  const firstAmount = (delta.x * secondVector.y - delta.y * secondVector.x) / denominator
  const secondAmount = (delta.x * firstVector.y - delta.y * firstVector.x) / denominator
  const margin = 0.025
  return firstAmount > margin && firstAmount < 1 - margin &&
    secondAmount > margin && secondAmount < 1 - margin
}

function drawSurfaceMembrane(
  context: any,
  points: LivePoint[],
  color: string,
  alpha: number
) {
  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y))
  context.closePath()
  context.setFillStyle(hexToRgba(color, alpha))
  context.setShadow(0, 0, 16, hexToRgba(color, Math.min(0.86, alpha + 0.24)))
  context.fill()
}

function drawTwoPairSurface(
  context: any,
  pairs: Array<{ color: string; left: LivePoint; right: LivePoint }>,
  style: LivePreviewStyle
) {
  const [first, second] = pairs
  const crosses = segmentIntersection(first.left, first.right, second.left, second.right)
  const topRight = crosses ? second.right : first.right
  const bottomRight = crosses ? first.right : second.right
  const face = [first.left, topRight, bottomRight, second.left]
  const boundary: [LivePoint, LivePoint][] = [
    [first.left, topRight],
    [topRight, bottomRight],
    [bottomRight, second.left],
    [second.left, first.left]
  ]

  drawSurfaceMembrane(context, face, first.color, style.surfaceAlpha)
  boundary.forEach(([start, end], index) => {
    drawLine(
      context,
      start,
      end,
      pairs[index % pairs.length].color,
      style.glowAlpha
    )
  })
}

export function drawLivePreview(options: {
  canvas: CanvasSize
  canvasId: string
  frame: FrameSize
  hands: LiveHand[]
  mirrored: boolean
  style: LivePreviewStyle
}) {
  const context = Taro.createCanvasContext(options.canvasId)
  context.clearRect(0, 0, options.canvas.width, options.canvas.height)

  const hands = options.hands
    .filter((hand) => hand.points?.length >= 21 && Number(hand.score ?? 1) >= 0.35)
    .slice(0, 2)
    .map((hand) => ({
      ...hand,
      canvasPoints: hand.points.map((point) =>
        toCanvasPoint(point, options.frame, options.canvas, options.mirrored)
      )
    }))
    .sort((first, second) => first.canvasPoints[0].x - second.canvasPoints[0].x)

  if (hands.length < 2) {
    hands.forEach((hand) => {
      FINGER_CHAINS.forEach((chain, fingerIndex) => {
        const color = options.style.colors[fingerIndex % options.style.colors.length]
        for (let index = 0; index < chain.length - 1; index += 1) {
          drawLine(
            context,
            hand.canvasPoints[chain[index]],
            hand.canvasPoints[chain[index + 1]],
            color,
            0.5
          )
        }
        drawNode(context, hand.canvasPoints[chain[3]], color, 0.68)
      })
    })
    context.draw(false)
    return { handCount: hands.length, pairCount: 0 }
  }

  const pairs = FINGER_CHAINS.map((chain, fingerIndex) => ({
    color: options.style.colors[fingerIndex % options.style.colors.length],
    fingerIndex,
    left: hands[0].canvasPoints[chain[3]],
    right: hands[1].canvasPoints[chain[3]],
    score: Math.min(
      fingerExtensionScore(hands[0].canvasPoints, fingerIndex),
      fingerExtensionScore(hands[1].canvasPoints, fingerIndex)
    )
  })).filter((pair) => pair.score >= 0.5)

  if (pairs.length === 1) {
    drawLine(
      context,
      pairs[0].left,
      pairs[0].right,
      pairs[0].color,
      options.style.glowAlpha
    )
  } else if (pairs.length === 2) {
    drawTwoPairSurface(context, pairs, options.style)
  } else if (pairs.length > 2) {
    const sectionCount = pairs.length
    for (let index = 0; index < sectionCount; index += 1) {
      const nextIndex = (index + 1) % pairs.length
      drawMembrane(
        context,
        pairs[index].left,
        pairs[index].right,
        pairs[nextIndex].left,
        pairs[nextIndex].right,
        pairs[index].color,
        options.style.surfaceAlpha
      )
      drawLine(
        context,
        pairs[index].left,
        pairs[nextIndex].left,
        pairs[index].color,
        options.style.glowAlpha
      )
      drawLine(
        context,
        pairs[index].right,
        pairs[nextIndex].right,
        pairs[nextIndex].color,
        options.style.glowAlpha
      )
    }
  }

  pairs.forEach((pair) => {
    if (pairs.length !== 2) {
      drawLine(context, pair.left, pair.right, pair.color, options.style.glowAlpha)
    }
    drawNode(context, pair.left, pair.color, options.style.glowAlpha)
    drawNode(context, pair.right, pair.color, options.style.glowAlpha)
  })
  context.draw(false)
  return { handCount: hands.length, pairCount: pairs.length }
}

export function clearLivePreview(canvasId: string, canvas: CanvasSize) {
  const context = Taro.createCanvasContext(canvasId)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.draw(false)
}

export function smoothLiveHands(previous: LiveHand[], current: LiveHand[]) {
  const sorted = current
    .filter((hand) => hand.points?.length >= 21)
    .slice(0, 2)
    .sort((first, second) => first.points[0].x - second.points[0].x)
  if (previous.length !== sorted.length) return sorted

  return sorted.map((hand, handIndex) => ({
    ...hand,
    points: hand.points.map((point, pointIndex) => {
      const oldPoint = previous[handIndex]?.points?.[pointIndex]
      if (!oldPoint) return point
      const movement = distance(oldPoint, point)
      const currentWeight = clamp(0.74 + movement * 4.5, 0.74, 0.92)
      return {
        x: oldPoint.x * (1 - currentWeight) + point.x * currentWeight,
        y: oldPoint.y * (1 - currentWeight) + point.y * currentWeight
      }
    })
  }))
}
