import { describe, expect, it, vi } from "vitest";
import { withCanonicalReferenceImages } from "./actionReferenceImages";

function fakeClient(rows: Array<{ id: string; reference_image_url: string | null }>, error: unknown = null) {
  const inFn = vi.fn(async () => ({ data: rows, error }));
  const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ in: inFn })) })) };
  return { client, inFn };
}

describe("withCanonicalReferenceImages", () => {
  it("adds the canonical image to linked actions without mutating the input", async () => {
    const actions = {
      a1: { id: "a1", name: "负重引体", canonical_action_id: "c1" },
      a2: { id: "a2", name: "自定义动作" },
    };
    const { client, inFn } = fakeClient([{ id: "c1", reference_image_url: "https://cdn/x.png" }]);
    const result = await withCanonicalReferenceImages(client as any, actions);

    expect(inFn).toHaveBeenCalledWith("id", ["c1"]);
    expect(result.a1.reference_image_url).toBe("https://cdn/x.png");
    expect(result.a2).toBe(actions.a2);
    expect((actions.a1 as any).reference_image_url).toBeUndefined();
  });

  it("keeps an action's own image and skips the lookup when nothing is linked", async () => {
    const own = { a1: { id: "a1", canonical_action_id: "c1", reference_image_url: "own.png" } };
    const { client, inFn } = fakeClient([]);
    const result = await withCanonicalReferenceImages(client as any, own);
    expect(result).toBe(own);
    expect(inFn).not.toHaveBeenCalled();
  });

  it("returns the original map when the lookup fails", async () => {
    const actions = { a1: { id: "a1", canonicalActionId: "c1" } };
    const { client } = fakeClient([], new Error("db down"));
    expect(await withCanonicalReferenceImages(client as any, actions)).toBe(actions);
  });
});
