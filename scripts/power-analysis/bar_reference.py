"""Hands on the bar as a fixed point: subtracts a moving phone and drops frames off the bar.

Measuring the body against the hands, and dropping frames with the hands off the bar,
comes from jeremyipark/vision-demos (Apache-2.0, pull_ups/how-it-works.md). This is our
own implementation on MediaPipe landmarks, and it differs on purpose: the shoulder stays
the measured point and the hands only correct it when the camera really moved, so a
fixed-camera video keeps its exact 2.1.0 numbers. The old-vs-new comparison is in
docs/done/system-design/power-analysis-pullup-muscleup-comparison.md.
"""
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

import pose_features as pf

# Arms count as overhead once the wrists are this far above the shoulders, in torso lengths.
OVERHEAD_MARGIN_TORSO = 0.3
MIN_OVERHEAD_SECONDS = 0.5
# A dismount moves the wrists far beyond any phone sway; the pad covers the start of the fall.
OFF_BAR_TORSO = 0.6
OFF_BAR_PAD_SECONDS = 0.2
WRIST_MEDIAN_SECONDS = 0.2
# Muscle-up: removing the step leaves spikes where it and the shoulder crossing disagree by a few frames.
STEP_MEDIAN_SECONDS = 0.4
GAP_SECONDS = 0.5
# Hips out of frame: a straight arm reads about as long as the torso (0.94-1.12 on real clips).
ARM_TO_TORSO = 1.05
# Fixed cameras read 0.04-0.09 torso lengths from landmark noise and hands rolling on the bar.
CAMERA_MOVED_TORSO = 0.15
# Changes leaderboard numbers for shaky videos, so it stays off until the owner confirms the
# comparison (DECISIONS.md 2026-11-01). The diagnostics in metrics.measurement are always written.
HAND_REFERENCE_ENABLED = False


@dataclass
class BarReference:
    on_bar: np.ndarray
    camera_y: np.ndarray
    ruler_px: float
    camera_travel_torso: float
    grip_step_px: float

    @property
    def camera_moved(self) -> bool:
        return self.camera_travel_torso >= CAMERA_MOVED_TORSO


def hands_y(track: np.ndarray) -> np.ndarray:
    return pf.side_points(track, "both", "wrist", 0.3)[:, 1]


def shoulders_y(track: np.ndarray) -> np.ndarray:
    return pf.side_points(track, "both", "shoulder", 0.3)[:, 1]


def torso_ruler_px(track: np.ndarray) -> Optional[float]:
    """Torso length while hanging; leaning back at the top only shortens it on screen."""
    lengths = pf.torso_length(track)
    if not np.any(np.isfinite(lengths)):
        arm = np.linalg.norm(pf.side_points(track, "both", "shoulder", 0.3) - pf.side_points(track, "both", "wrist", 0.3), axis=-1)
        arm = arm[np.isfinite(arm)]
        return ARM_TO_TORSO * float(np.percentile(arm, 75)) if arm.size else None
    with np.errstate(invalid="ignore"):
        overhead = hands_y(track) < shoulders_y(track) - OVERHEAD_MARGIN_TORSO * np.nanpercentile(lengths, 75)
    hanging = lengths[overhead & np.isfinite(lengths)]
    ruler = float(np.median(hanging)) if hanging.size else float(np.nanpercentile(lengths, 75))
    return ruler if ruler > 0 else None


def on_bar_mask(track: np.ndarray, fps: float, ruler: float) -> Optional[np.ndarray]:
    """True while the hands stay near the bar; None when they never hang overhead."""
    hands, shoulders = hands_y(track), shoulders_y(track)
    with np.errstate(invalid="ignore"):
        overhead = hands < shoulders - OVERHEAD_MARGIN_TORSO * ruler
    if np.count_nonzero(overhead) < MIN_OVERHEAD_SECONDS * fps:
        return None
    bar = float(np.median(hands[overhead]))
    # Wrists unseen for longer than a blink count as off the bar: hands drop behind the body after a dismount.
    known = pf.interpolate_gaps(hands, int(round(fps * GAP_SECONDS)))
    with np.errstate(invalid="ignore"):
        off = ~(np.abs(known - bar) <= OFF_BAR_TORSO * ruler)
    pad = max(1, int(round(fps * OFF_BAR_PAD_SECONDS)))
    if off.size < 2 * pad + 1:
        return None
    return np.convolve(off.astype(np.float64), np.ones(2 * pad + 1), mode="same") == 0


def remove_grip_step(hands: np.ndarray, shoulders: np.ndarray, on_bar: np.ndarray, ruler: float, fps: float) -> Tuple[np.ndarray, float]:
    """Hands sit under the bar when hanging and on top of it in support, so the wrists jump
    about 15 cm through the transition. That is not the camera; the shoulder crossing the
    wrists marks which side of the bar the body is on, and it does not depend on the camera.
    """
    with np.errstate(invalid="ignore"):
        support = (shoulders < hands) & on_bar
        hanging = (shoulders > hands + OVERHEAD_MARGIN_TORSO * ruler) & on_bar
    if not np.any(support) or not np.any(hanging):
        return hands, 0.0
    step = float(np.nanmedian(hands[support]) - np.nanmedian(hands[hanging]))
    with np.errstate(invalid="ignore"):
        stepped = hands - step * (shoulders < hands).astype(np.float64)
    return pf.median_filter(stepped, int(round(fps * STEP_MEDIAN_SECONDS))), step


def build_bar_reference(track: np.ndarray, fps: float, mode: str) -> Optional[BarReference]:
    ruler = torso_ruler_px(track)
    if ruler is None:
        return None
    on_bar = on_bar_mask(track, fps, ruler)
    if on_bar is None or not np.any(on_bar):
        return None
    filtered = pf.median_filter(hands_y(track), int(round(fps * WRIST_MEDIAN_SECONDS)))
    hands = pf.interpolate_gaps(filtered, int(round(fps * GAP_SECONDS)))
    step = 0.0
    if mode == "muscleup":
        hands, step = remove_grip_step(hands, shoulders_y(track), on_bar, ruler, fps)
    usable = hands[on_bar & np.isfinite(hands)]
    if usable.size < MIN_OVERHEAD_SECONDS * fps:
        return None
    camera = hands - float(np.median(usable))
    travel = float(np.percentile(usable, 95) - np.percentile(usable, 5)) / ruler
    return BarReference(on_bar=on_bar, camera_y=camera, ruler_px=ruler, camera_travel_torso=travel, grip_step_px=step)


def reference_anchor(anchor_y: np.ndarray, reference: BarReference) -> np.ndarray:
    """The anchor with frames off the bar removed, minus the camera only if it really moved."""
    corrected = anchor_y - reference.camera_y if reference.camera_moved else anchor_y
    return np.where(reference.on_bar, corrected, np.nan)
