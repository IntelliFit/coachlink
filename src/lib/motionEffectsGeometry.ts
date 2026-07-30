export type MotionEffectPoint = {
  x: number;
  y: number;
  z: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function smoothstep(start: number, end: number, value: number) {
  const progress = clamp((value - start) / Math.max(0.000001, end - start), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function cross2d(a: MotionEffectPoint, b: MotionEffectPoint) {
  return a.x * b.y - a.y * b.x;
}

function subtractPoint(
  a: MotionEffectPoint,
  b: MotionEffectPoint,
): MotionEffectPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function lerpPoint(
  a: MotionEffectPoint,
  b: MotionEffectPoint,
  amount: number,
): MotionEffectPoint {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount,
  };
}

export function segmentIntersection(
  firstStart: MotionEffectPoint,
  firstEnd: MotionEffectPoint,
  secondStart: MotionEffectPoint,
  secondEnd: MotionEffectPoint,
) {
  const firstVector = subtractPoint(firstEnd, firstStart);
  const secondVector = subtractPoint(secondEnd, secondStart);
  const denominator = cross2d(firstVector, secondVector);
  if (Math.abs(denominator) < 0.0001) return null;
  const delta = subtractPoint(secondStart, firstStart);
  const firstAmount = cross2d(delta, secondVector) / denominator;
  const secondAmount = cross2d(delta, firstVector) / denominator;
  const margin = 0.025;
  if (
    firstAmount <= margin ||
    firstAmount >= 1 - margin ||
    secondAmount <= margin ||
    secondAmount >= 1 - margin
  ) {
    return null;
  }
  return lerpPoint(firstStart, firstEnd, firstAmount);
}

export function buildSideTriangles(
  leftFirst: MotionEffectPoint,
  rightFirst: MotionEffectPoint,
  leftSecond: MotionEffectPoint,
  rightSecond: MotionEffectPoint,
) {
  const intersection = segmentIntersection(
    leftFirst,
    rightFirst,
    leftSecond,
    rightSecond,
  );
  if (intersection) {
    return [
      [leftFirst, leftSecond, intersection],
      [rightFirst, rightSecond, intersection],
    ];
  }
  return [
    [leftFirst, rightFirst, rightSecond],
    [leftFirst, rightSecond, leftSecond],
  ];
}
