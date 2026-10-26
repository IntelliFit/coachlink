import { describe, expect, it } from "vitest";
import {
  getPowerAnalysisCancelDecision,
  isActivePowerAnalysisJobStatus,
  isTerminalPowerAnalysisJobStatus,
} from "@coachlink/core/src/powerAnalysisJobs";

describe("power-analysis job lifecycle", () => {
  it("treats only queued and processing as the one active job", () => {
    expect(isActivePowerAnalysisJobStatus("queued")).toBe(true);
    expect(isActivePowerAnalysisJobStatus("processing")).toBe(true);
    for (const status of ["awaiting_upload", "done", "failed", "expired", "canceled", undefined]) {
      expect(isActivePowerAnalysisJobStatus(status)).toBe(false);
    }
  });

  it("stops polling on every finished status, including canceled", () => {
    for (const status of ["done", "failed", "expired", "canceled"]) {
      expect(isTerminalPowerAnalysisJobStatus(status)).toBe(true);
    }
    for (const status of ["awaiting_upload", "queued", "processing"]) {
      expect(isTerminalPowerAnalysisJobStatus(status)).toBe(false);
    }
  });

  it("cancels a job that has not produced a result yet", () => {
    for (const status of ["awaiting_upload", "queued", "processing"]) {
      expect(getPowerAnalysisCancelDecision(status)).toEqual({ action: "cancel" });
    }
  });

  it("treats a second cancel as already done", () => {
    expect(getPowerAnalysisCancelDecision("canceled")).toEqual({ action: "already_canceled" });
  });

  it("refuses to cancel a finished job with a reason", () => {
    for (const status of ["done", "failed", "expired", "bogus", null]) {
      const decision = getPowerAnalysisCancelDecision(status);
      expect(decision.action).toBe("reject");
      expect(decision.action === "reject" && decision.message.length > 0).toBe(true);
    }
  });
});
