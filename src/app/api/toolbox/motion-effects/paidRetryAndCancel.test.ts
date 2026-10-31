import { describe, expect, it } from "vitest";
import { canCancelMotionJob, isPaidMotionRetry, MAX_PAID_MOTION_RETRIES, paidMotionRetryCount } from "./_commerce";

describe("paid motion job retry", () => {
  it("only lets a failed job that was paid for requeue without a new order", () => {
    expect(isPaidMotionRetry({ status: "failed", payment_status: "paid" })).toBe(true);
    expect(isPaidMotionRetry({ status: "failed", payment_status: "free" })).toBe(false);
    expect(isPaidMotionRetry({ status: "failed", payment_status: "refunded" })).toBe(false);
    expect(isPaidMotionRetry({ status: "failed", payment_status: "unpaid" })).toBe(false);
    expect(isPaidMotionRetry({ status: "done", payment_status: "paid" })).toBe(false);
  });

  it("reads the retry count from metadata and defaults to zero", () => {
    expect(paidMotionRetryCount(null)).toBe(0);
    expect(paidMotionRetryCount({})).toBe(0);
    expect(paidMotionRetryCount({ paid_retry_count: "x" })).toBe(0);
    expect(paidMotionRetryCount({ paid_retry_count: 2 })).toBe(2);
    expect(MAX_PAID_MOTION_RETRIES).toBeGreaterThan(0);
  });
});

describe("cancelling a motion job", () => {
  it("is allowed while no payment was started", () => {
    expect(canCancelMotionJob({ status: "awaiting_upload", payment_status: "unpaid", payment_order_id: null })).toBe(true);
    expect(canCancelMotionJob({ status: "awaiting_upload", payment_status: "free", payment_order_id: null })).toBe(true);
  });

  it("is refused once an order exists or the job was paid, because the user may be paying", () => {
    expect(canCancelMotionJob({ status: "awaiting_payment", payment_status: "pending", payment_order_id: "o1" })).toBe(false);
    expect(canCancelMotionJob({ status: "awaiting_upload", payment_status: "paid", payment_order_id: null })).toBe(false);
  });

  it("is refused for jobs already running or finished", () => {
    for (const status of ["queued", "processing", "done", "failed", "expired"]) {
      expect(canCancelMotionJob({ status, payment_status: "unpaid", payment_order_id: null })).toBe(false);
    }
  });
});
