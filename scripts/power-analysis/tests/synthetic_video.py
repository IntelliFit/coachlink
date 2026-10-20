"""Synthetic barbell videos with a known plate trajectory, for tracker tests."""
import math
from typing import List, Tuple

import cv2
import numpy as np


def rep_trajectory(
    fps: float,
    reps: int,
    bottom_y: float,
    rom_px: float,
    ascent_s: float,
    pause_s: float = 0.6,
    descent_s: float = 1.0,
    lead_s: float = 1.0,
) -> np.ndarray:
    """Plate center y per frame: rest at bottom, then up/hold/down cycles."""
    ys: List[float] = []

    def hold(seconds: float, y: float) -> None:
        ys.extend([y] * int(round(seconds * fps)))

    def move(seconds: float, start: float, end: float) -> None:
        n = max(2, int(round(seconds * fps)))
        for i in range(n):
            t = i / (n - 1)
            ys.append(start + (end - start) * (0.5 - 0.5 * math.cos(math.pi * t)))

    hold(lead_s, bottom_y)
    for _ in range(reps):
        move(ascent_s, bottom_y, bottom_y - rom_px)
        hold(pause_s, bottom_y - rom_px)
        move(descent_s, bottom_y - rom_px, bottom_y)
        hold(pause_s, bottom_y)
    return np.array(ys)


def draw_plate(frame: np.ndarray, center: Tuple[float, float], radius: float, angle_deg: float) -> None:
    cx, cy = int(round(center[0])), int(round(center[1]))
    cv2.circle(frame, (cx, cy), int(radius), (30, 30, 30), -1, cv2.LINE_AA)
    cv2.circle(frame, (cx, cy), int(radius * 0.92), (70, 70, 200), 3, cv2.LINE_AA)
    cv2.circle(frame, (cx, cy), int(radius * 0.18), (200, 200, 200), -1, cv2.LINE_AA)
    for k in range(3):
        a = math.radians(angle_deg + k * 120)
        end = (int(cx + math.cos(a) * radius * 0.7), int(cy + math.sin(a) * radius * 0.7))
        cv2.line(frame, (cx, cy), end, (230, 230, 230), 2, cv2.LINE_AA)


def write_plate_video(
    path: str,
    ys: np.ndarray,
    x: float,
    radius: float,
    fps: float = 30.0,
    size: Tuple[int, int] = (720, 1280),
    seed: int = 7,
) -> None:
    height, width = size
    rng = np.random.default_rng(seed)
    background = rng.integers(150, 200, size=(height, width, 3), dtype=np.uint8)
    background = cv2.GaussianBlur(background, (0, 0), 6)
    cv2.rectangle(background, (0, int(height * 0.85)), (width, height), (90, 110, 120), -1)
    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    for index, y in enumerate(ys):
        frame = background.copy()
        draw_plate(frame, (x, y), radius, angle_deg=index * 0.8)
        noise = rng.normal(0, 3, size=frame.shape)
        writer.write(np.clip(frame + noise, 0, 255).astype(np.uint8))
    writer.release()
