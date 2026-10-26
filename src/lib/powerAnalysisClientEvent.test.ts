import { describe, expect, it } from "vitest";
import { appendPowerAnalysisClientEvent, parsePowerAnalysisClientEvent } from "./powerAnalysisClientEvent";

const NOW = new Date("2026-10-26T09:00:00.000Z");

describe("parsePowerAnalysisClientEvent", () => {
  it("keeps known events with cleaned, bounded fields", () => {
    const event = parsePowerAnalysisClientEvent(
      {
        event: "upload_failed",
        stage: "upload",
        message: `request:fail timeout\n${"x".repeat(500)}`,
        progress: 37.6,
        client: { brand: "HUAWEI", model: "Mate 60", system: "Android 14", token: "secret", platform: "android" },
      },
      NOW,
    );
    expect(event).toMatchObject({
      event: "upload_failed",
      stage: "upload",
      progress: 38,
      client: { brand: "HUAWEI", model: "Mate 60", system: "Android 14", platform: "android" },
      at: NOW.toISOString(),
    });
    expect(event?.message?.length).toBe(300);
    expect(event?.message).not.toContain("\n");
    expect(event?.client).not.toHaveProperty("token");
  });

  it("rejects unknown events and non-objects", () => {
    expect(parsePowerAnalysisClientEvent({ event: "delete_everything" })).toBeNull();
    expect(parsePowerAnalysisClientEvent("upload_failed")).toBeNull();
    expect(parsePowerAnalysisClientEvent(null)).toBeNull();
  });

  it("clamps progress and drops non-numbers", () => {
    expect(parsePowerAnalysisClientEvent({ event: "left_during_upload", progress: 140 })?.progress).toBe(100);
    expect(parsePowerAnalysisClientEvent({ event: "left_during_upload", progress: "abc" })?.progress).toBeNull();
  });
});

describe("appendPowerAnalysisClientEvent", () => {
  it("returns new metadata, keeps other keys and the last five events", () => {
    const event = parsePowerAnalysisClientEvent({ event: "left_without_start" }, NOW)!;
    const metadata = { uploaded_at: "x", client_events: [1, 2, 3, 4, 5] };
    const next = appendPowerAnalysisClientEvent(metadata, event);
    expect(next).not.toBe(metadata);
    expect(metadata.client_events).toHaveLength(5);
    expect(next.uploaded_at).toBe("x");
    expect(next.client_events).toEqual([2, 3, 4, 5, event]);
  });
});
