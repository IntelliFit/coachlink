"""Follows one identified plate through the video.

Optical flow (pyramidal Lucas-Kanade on corner features inside the plate) moves
the estimate from frame to frame; whenever a circle is found close to the
estimate it snaps to that circle's center. Inner and outer rims of one plate
share a center, so any rim corrects drift, while the neighbouring plates in a
stack sit too far away to be mistaken for it.
"""
from typing import Optional, Tuple

import cv2
import numpy as np

WORK_SIDE = 540
FEATURE_COUNT = 120
RESEED_EVERY = 10
MIN_FEATURES = 15
SNAP_SHARE = 0.25
LOST_AFTER_S = 1.0


def _gray(frame: np.ndarray, scale: float) -> np.ndarray:
    small = frame if scale == 1.0 else cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)


def _seed_features(gray: np.ndarray, center: np.ndarray, radius: float) -> Optional[np.ndarray]:
    mask = np.zeros_like(gray)
    cv2.circle(mask, (int(center[0]), int(center[1])), max(4, int(radius * 0.85)), 255, -1)
    return cv2.goodFeaturesToTrack(gray, FEATURE_COUNT, 0.01, 5, mask=mask)


def _flow_step(prev: np.ndarray, cur: np.ndarray, points: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    """Median feature motion and the surviving features, or (None, None) if too few survive."""
    moved, status, _ = cv2.calcOpticalFlowPyrLK(prev, cur, points, None, winSize=(31, 31), maxLevel=4)
    if moved is None:
        return None, None
    good = status.reshape(-1) == 1
    if good.sum() < 6:
        return None, None
    delta = (moved[good] - points[good]).reshape(-1, 2)
    median = np.median(delta, axis=0)
    inliers = np.hypot(*(delta - median).T) < 3.0
    if inliers.sum() >= 6:
        median = np.median(delta[inliers], axis=0)
        return median, moved[good][inliers].reshape(-1, 1, 2)
    return median, moved[good].reshape(-1, 1, 2)


def _snap(gray: np.ndarray, center: np.ndarray, radius: float) -> Optional[np.ndarray]:
    """Center of a circle (any rim of this plate) near the estimate, searched in a small window."""
    half = int(radius * 1.3)
    x0, y0 = max(0, int(center[0]) - half), max(0, int(center[1]) - half)
    window = gray[y0:int(center[1]) + half, x0:int(center[0]) + half]
    if min(window.shape[:2]) < 16:
        return None
    blurred = cv2.GaussianBlur(window, (5, 5), 1.5)
    found = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT_ALT,
        dp=1.5,
        minDist=max(4.0, radius * 0.1),
        param1=150,
        param2=0.7,
        minRadius=max(3, int(radius * 0.35)),
        maxRadius=max(4, int(radius * 1.2)),
    )
    if found is None:
        return None
    best, best_distance = None, SNAP_SHARE * radius
    for x, y, _ in found[0]:
        candidate = np.array([x + x0, y + y0])
        distance = float(np.hypot(*(candidate - center)))
        if distance <= best_distance:
            best, best_distance = candidate, distance
    return best


def follow_plate(
    video_path: str,
    seed_frame: int,
    seed_center: Tuple[float, float],
    radius_px: float,
    total: int,
    fps: float,
) -> Tuple[np.ndarray, float]:
    """(frames, 2) plate centers from seed_frame on (NaN before or once lost) and the share of frames snapped to a circle."""
    centers = np.full((total, 2), np.nan)
    cap = cv2.VideoCapture(video_path)
    scale, radius = 1.0, radius_px
    prev = points = None
    center = None
    snapped = followed = 0
    unsnapped_run = 0
    index = 0
    while index < total:
        ok, frame = cap.read()
        if not ok:
            break
        if index == 0:
            scale = min(1.0, WORK_SIDE / max(1, min(frame.shape[:2])))
            radius = radius_px * scale
        if index < seed_frame:
            index += 1
            continue
        gray = _gray(frame, scale)
        if index == seed_frame:
            center = np.array(seed_center, dtype=float) * scale
        else:
            if points is None or len(points) < MIN_FEATURES or index % RESEED_EVERY == 0:
                points = _seed_features(prev, center, radius)
            if points is None:
                break
            motion, points = _flow_step(prev, gray, points)
            if motion is None:
                break
            center = center + motion
        found = _snap(gray, center, radius)
        if found is not None:
            center, unsnapped_run = found, 0
            snapped += 1
        else:
            unsnapped_run += 1
            if unsnapped_run > fps * LOST_AFTER_S * 3:
                break
        centers[index] = center / scale
        followed += 1
        prev = gray
        index += 1
    cap.release()
    return centers, snapped / max(1, followed)
