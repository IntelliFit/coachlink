import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({ serviceRoleSupabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { mapPowerAnalysisJob, mapPowerAnalysisJobWithQueueInfo } from "@/app/api/toolbox/power-analysis/_helpers";

function doneJob(metadata: Record<string, unknown>) {
  return {
    id: "job-1",
    user_id: "user-1",
    mode: "pullup",
    status: "done",
    metrics_json: { mode: "pullup", reps: [], summary: { bestPowerW: 500, bestVelocityMps: 1.2 } },
    metadata,
    expires_at: "2999-01-01T00:00:00Z",
  };
}

describe("power analysis subject (测自己 / 测别人)", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("treats old jobs without a subject as the uploader's own video", () => {
    expect(mapPowerAnalysisJob(doneJob({})).subject).toBe("self");
    expect(mapPowerAnalysisJob(doneJob({ subject: "other" })).subject).toBe("other");
  });

  it("syncs the challenge board for the uploader's own video", async () => {
    await mapPowerAnalysisJobWithQueueInfo(doneJob({ subject: "self" }));
    expect(rpc).toHaveBeenCalledWith("record_power_analysis_best", { p_job_id: "job-1", p_user_id: "user-1" });
  });

  it("never puts someone else's video on the uploader's challenge board", async () => {
    const dto = await mapPowerAnalysisJobWithQueueInfo(doneJob({ subject: "other" }));
    expect(rpc).not.toHaveBeenCalled();
    expect(dto.ranking).toBeUndefined();
  });
});
