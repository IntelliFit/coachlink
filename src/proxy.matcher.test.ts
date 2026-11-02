import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/middleware/api-trace", () => ({ matcher: [], handle: async () => undefined }));

import { config } from "./proxy";

function runsProxy(pathname: string) {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));
}

const JOB = "7d3276cf-0000-4000-8000-000000000000";

describe("proxy matcher", () => {
  // Next 16.0.1 does not wait for its body clone before running the route, so a body
  // still arriving through nginx (proxy_request_buffering off) reaches the route without
  // the bytes that came in meanwhile. Live: 519 of 675 chunk requests failed this way.
  it("skips the power-analysis routes that read a streamed video body", () => {
    expect(runsProxy(`/api/toolbox/power-analysis/jobs/${JOB}/upload-chunk`)).toBe(false);
    expect(runsProxy(`/api/toolbox/power-analysis/jobs/${JOB}/upload`)).toBe(false);
  });

  it("still runs for the rest of the power-analysis API", () => {
    for (const route of ["", "/client-event", "/enqueue", "/cancel", "/download", "/upload-url"]) {
      expect(runsProxy(`/api/toolbox/power-analysis/jobs/${JOB}${route}`)).toBe(true);
    }
    expect(runsProxy("/api/toolbox/power-analysis/create-upload-url")).toBe(true);
  });

  it("still runs for pages and other upload routes", () => {
    expect(runsProxy("/toolbox/power-analysis")).toBe(true);
    expect(runsProxy("/api/execution/upload-set-video-chunk")).toBe(true);
    expect(runsProxy("/_next/static/chunk.js")).toBe(false);
  });
});
