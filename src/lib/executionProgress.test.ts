import { describe, expect, it } from "vitest";
import { computeExecutionProgress } from "./executionProgress";

describe("executionProgress", () => {
  it("counts strength sets as items", () => {
    const { totalItems, completedItems } = computeExecutionProgress([
      { sets: [{ status: "completed" }, { status: "pending" }] },
      { sets: [{ status: "completed" }] },
    ]);
    expect(totalItems).toBe(3);
    expect(completedItems).toBe(2);
  });

  it("counts non-strength items as 1 and uses completed/status", () => {
    const { totalItems, completedItems } = computeExecutionProgress([
      { status: "completed" },
      { completed: true },
      { status: "pending" },
    ]);
    expect(totalItems).toBe(3);
    expect(completedItems).toBe(2);
  });

  it("handles mixed action types", () => {
    const { totalItems, completedItems } = computeExecutionProgress([
      { sets: [{ status: "completed" }, { status: "completed" }] },
      { status: "completed" },
      { completed: false },
    ]);
    expect(totalItems).toBe(4);
    expect(completedItems).toBe(3);
  });

  it("handles null/undefined safely", () => {
    expect(computeExecutionProgress(undefined)).toEqual({ totalItems: 0, completedItems: 0 });
    expect(computeExecutionProgress(null)).toEqual({ totalItems: 0, completedItems: 0 });
  });
});

