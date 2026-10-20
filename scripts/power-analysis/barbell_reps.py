"""Concentric phase timing for barbell reps.

A rep's start and end are where the bar is within a small distance (delta) of
its lowest / highest point. Any distance threshold cuts off the slow part of
the turnaround, so each end is corrected assuming constant acceleration from
rest: covering delta from rest at speed v takes 2 * delta / v. This keeps mean
velocity unbiased for fast and slow reps and does not depend on how much the
track was smoothed.
"""
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

G = 9.80665
HP_WATT = 735.499
MOVING_VELOCITY = 0.05
DELTA_M = 0.01
MERGE_GAP_S = 0.6
MERGE_MAX_DIP_M = 0.03
# No squat, bench or deadlift moves the bar this far; longer "reps" are the lifter moving without the bar.
MAX_BAR_TRAVEL_M = 0.9


def _round(value: float, digits: int = 3) -> float:
    return round(float(value), digits) if math.isfinite(value) else 0.0


def to_array(values: List[Optional[float]]) -> np.ndarray:
    return np.array([np.nan if value is None else value for value in values], dtype=np.float64)


def upward_velocity(y: np.ndarray, fps: float, scale: float, step: int) -> np.ndarray:
    """Upward speed in m/s from a centered difference over +-step frames."""
    velocity = np.full(y.size, np.nan)
    if y.size > 2 * step:
        velocity[step:-step] = (y[:-2 * step] - y[2 * step:]) * scale * fps / (2 * step)
    return velocity


def moving_window(rep: Dict[str, Any], velocity: np.ndarray, fps: float) -> Tuple[int, int]:
    """Widens a detected ascent to include the still frames on both sides."""
    start, end = int(rep["startFrame"]), int(rep["endFrame"])
    moving = np.isfinite(velocity) & (velocity >= MOVING_VELOCITY)
    inside = np.flatnonzero(moving[start:end + 1])
    if inside.size == 0:
        return start, max(end, start + 1)
    bottom = start + int(inside[0])
    lower = max(0, start - int(fps * 0.8))
    while bottom > lower and moving[bottom - 1]:
        bottom -= 1
    top = start + int(inside[-1])
    upper = min(velocity.size - 1, end + int(fps * 0.5))
    while top < upper and moving[top + 1]:
        top += 1
    return max(0, bottom - 2), min(velocity.size - 1, top + 2)


def _value_at(series: np.ndarray, position: float) -> Optional[float]:
    low = int(math.floor(position))
    high = min(low + 1, series.size - 1)
    if low < 0 or not math.isfinite(series[low]):
        return None
    if not math.isfinite(series[high]):
        return float(series[low])
    return float(series[low] + (series[high] - series[low]) * (position - low))


def _extreme_level(segment: np.ndarray, fps: float, pick) -> float:
    """Bar height at the turnaround: median around the extreme, so one noisy frame does not set it."""
    radius = max(1, int(round(fps * 0.05)))
    filled = np.where(np.isfinite(segment), segment, np.nanmedian(segment))
    smoothed = np.convolve(filled, np.ones(3) / 3, mode="same") if filled.size >= 3 else filled
    center = int(pick(smoothed))
    window = segment[max(0, center - radius):center + radius + 1]
    return float(np.nanmedian(window))


def _crossing(y: np.ndarray, first: int, level: float) -> float:
    """Sub-frame time between first and first+1 where y passes level."""
    second = min(first + 1, y.size - 1)
    a, b = y[first], y[second]
    if not (math.isfinite(a) and math.isfinite(b)) or a == b:
        return float(first)
    return first + float(np.clip((a - level) / (a - b), 0.0, 1.0))


def _corrected(cross: float, velocity: np.ndarray, delta_m: float, fps: float, sign: int) -> float:
    """Moves a threshold crossing back to the turnaround: 2 * delta / v seconds, at most 0.3 s."""
    speed = _value_at(velocity, cross)
    if speed is None or speed <= MOVING_VELOCITY:
        return cross
    shift_frames = min(2.0 * delta_m / speed, 0.3) * fps
    return cross + sign * shift_frames


def measure_concentric(
    window: Tuple[int, int],
    y: np.ndarray,
    velocity: np.ndarray,
    fps: float,
    scale: float,
    mass: float,
) -> Optional[Dict[str, Any]]:
    start, end = window
    segment_velocity = velocity[start:end + 1]
    if not np.any(np.isfinite(segment_velocity)):
        return None
    peak = start + int(np.nanargmax(segment_velocity))
    before, after = y[start:peak + 1], y[peak:end + 1]
    if not np.any(np.isfinite(before)) or not np.any(np.isfinite(after)):
        return None
    lowest = _extreme_level(before, fps, np.nanargmax)
    highest = _extreme_level(after, fps, np.nanargmin)
    rom_px = lowest - highest
    if rom_px <= 0:
        return None
    delta_px = min(DELTA_M / scale, 0.1 * rom_px)
    delta_m = delta_px * scale
    near_bottom = np.flatnonzero(np.isfinite(before) & (before >= lowest - delta_px))
    near_top = np.flatnonzero(np.isfinite(after) & (after <= highest + delta_px))
    onset = _corrected(_crossing(y, start + int(near_bottom[-1]), lowest - delta_px), velocity, delta_m, fps, -1)
    top_index = peak + int(near_top[0])
    offset = _corrected(_crossing(y, max(start, top_index - 1), highest + delta_px), velocity, delta_m, fps, 1)
    time_s = max(1.0 / fps, (offset - onset) / fps)
    displacement = rom_px * scale
    mean_velocity = displacement / time_s
    power = mass * G * displacement / time_s
    bottom_frame = int(np.clip(round(onset), 0, y.size - 1))
    top_frame = int(np.clip(round(offset), bottom_frame + 1, y.size - 1))
    peak_velocity = float(np.nanmax(segment_velocity))
    return {
        "displacementM": _round(displacement),
        "ascentTimeS": _round(time_s),
        "avgPowerW": _round(power, 2),
        "horsepowerHp": _round(power / HP_WATT, 3),
        "maxVelocityMps": _round(max(peak_velocity, mean_velocity), 3),
        "meanVelocityMps": _round(mean_velocity, 3),
        "startFrame": bottom_frame,
        "endFrame": top_frame,
        "peakFrame": int(peak),
        "bottomFrame": bottom_frame,
        "topFrame": top_frame,
        "startTimeS": _round(onset / fps, 2),
        "endTimeS": _round(offset / fps, 2),
    }


def _merge_windows(windows: List[Tuple[int, int]], y: np.ndarray, fps: float, scale: float) -> List[Tuple[int, int]]:
    """Joins ascents split by a slow sticking point (short gap, bar barely sank)."""
    merged: List[List[int]] = []
    for start, end in windows:
        if merged:
            previous = merged[-1]
            gap_ok = start - previous[1] <= fps * MERGE_GAP_S
            between = y[min(previous[1], start):max(previous[1], start) + 1]
            reference = y[previous[1]]
            if gap_ok and np.any(np.isfinite(between)) and math.isfinite(reference):
                if (float(np.nanmax(between)) - reference) * scale <= MERGE_MAX_DIP_M:
                    previous[1] = max(previous[1], end)
                    continue
        merged.append([start, end])
    return [(start, end) for start, end in merged]


def refine_barbell_reps(
    reps: List[Dict[str, Any]],
    detect_y: List[Optional[float]],
    timing_y: np.ndarray,
    fps: float,
    scale: float,
    mass: float,
    min_displacement: float,
) -> List[Dict[str, Any]]:
    """detect_y is the heavily smoothed track used to find ascents; timing_y the lightly smoothed one used to time them."""
    detect_velocity = upward_velocity(to_array(detect_y), fps, scale, max(1, int(round(fps * 0.05))))
    timing_velocity = upward_velocity(timing_y, fps, scale, max(1, int(round(fps * 0.05))))
    windows = [moving_window(rep, detect_velocity, fps) for rep in reps]
    result: List[Dict[str, Any]] = []
    for window in _merge_windows(windows, timing_y, fps, scale):
        rep = measure_concentric(window, timing_y, timing_velocity, fps, scale, mass)
        if rep and min_displacement <= rep["displacementM"] <= MAX_BAR_TRAVEL_M:
            rep["repIndex"] = len(result) + 1
            result.append(rep)
    return result
