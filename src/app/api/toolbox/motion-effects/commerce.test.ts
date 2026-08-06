import { afterEach, describe, expect, it } from "vitest";
import {
  calculateMotionEffectPrice,
  getMotionEffectPrices,
  normalizeExportQuality,
  normalizeQueueTier,
} from "./_commerce";

const ORIGINAL_ENV = {
  standard: process.env.MOTION_EFFECTS_STANDARD_PRICE_CENTS,
  hd: process.env.MOTION_EFFECTS_HD_PRICE_CENTS,
  priority: process.env.MOTION_EFFECTS_PRIORITY_ADDON_CENTS,
};

afterEach(() => {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore("MOTION_EFFECTS_STANDARD_PRICE_CENTS", ORIGINAL_ENV.standard);
  restore("MOTION_EFFECTS_HD_PRICE_CENTS", ORIGINAL_ENV.hd);
  restore("MOTION_EFFECTS_PRIORITY_ADDON_CENTS", ORIGINAL_ENV.priority);
});

describe("motion effect commerce", () => {
  it("uses the confirmed prices by default", () => {
    delete process.env.MOTION_EFFECTS_STANDARD_PRICE_CENTS;
    delete process.env.MOTION_EFFECTS_HD_PRICE_CENTS;
    delete process.env.MOTION_EFFECTS_PRIORITY_ADDON_CENTS;

    expect(getMotionEffectPrices()).toEqual({
      standardCents: 290,
      hdCents: 490,
      priorityAddonCents: 190,
    });
  });

  it("grants only the standard base export to a registered free user", () => {
    expect(
      calculateMotionEffectPrice({
        quality: "standard",
        queueTier: "standard",
        signupFreeAvailable: true,
      }),
    ).toMatchObject({
      totalCents: 0,
      baseCents: 0,
      priorityCents: 0,
      usesSignupFree: true,
    });

    expect(
      calculateMotionEffectPrice({
        quality: "standard",
        queueTier: "priority",
        signupFreeAvailable: true,
      }),
    ).toMatchObject({
      totalCents: 190,
      baseCents: 0,
      priorityCents: 190,
      usesSignupFree: true,
    });
  });

  it("always charges for HD and falls back to safe option values", () => {
    expect(
      calculateMotionEffectPrice({
        quality: "hd",
        queueTier: "priority",
        signupFreeAvailable: true,
      }),
    ).toMatchObject({
      totalCents: 680,
      baseCents: 490,
      priorityCents: 190,
      usesSignupFree: false,
    });
    expect(normalizeExportQuality("unexpected")).toBe("standard");
    expect(normalizeQueueTier("unexpected")).toBe("standard");
  });
});
