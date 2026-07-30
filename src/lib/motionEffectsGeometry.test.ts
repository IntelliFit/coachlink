import { describe, expect, it } from "vitest";
import {
  buildSideTriangles,
  smoothstep,
  type MotionEffectPoint,
} from "./motionEffectsGeometry";

const point = (x: number, y: number): MotionEffectPoint => ({ x, y, z: 0 });

function triangleArea(triangle: MotionEffectPoint[]) {
  const [a, b, c] = triangle;
  return (
    Math.abs(
      a.x * (b.y - c.y) +
        b.x * (c.y - a.y) +
        c.x * (a.y - b.y),
    ) / 2
  );
}

describe("motion effect geometry", () => {
  it("splits crossing finger pairs into two bow-tie lobes without filling the convex hull", () => {
    const triangles = buildSideTriangles(
      point(0, 0),
      point(10, 10),
      point(0, 10),
      point(10, 0),
    );

    expect(triangles).toEqual([
      [point(0, 0), point(0, 10), point(5, 5)],
      [point(10, 10), point(10, 0), point(5, 5)],
    ]);
    expect(triangles.reduce((sum, triangle) => sum + triangleArea(triangle), 0)).toBe(50);
  });

  it("triangulates non-crossing finger pairs as a complete quadrilateral", () => {
    const triangles = buildSideTriangles(
      point(0, 0),
      point(10, 0),
      point(0, 10),
      point(10, 10),
    );

    expect(triangles.reduce((sum, triangle) => sum + triangleArea(triangle), 0)).toBe(100);
  });

  it("keeps the hand-distance reveal clamped and eased", () => {
    expect(smoothstep(0.14, 0.3, 0.1)).toBe(0);
    expect(smoothstep(0.14, 0.3, 0.22)).toBeCloseTo(0.5);
    expect(smoothstep(0.14, 0.3, 0.35)).toBe(1);
  });
});
