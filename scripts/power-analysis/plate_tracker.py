"""Barbell plate detection and tracking.

Every frame is searched for near-perfect circles (OpenCV HOUGH_GRADIENT_ALT,
which ignores the many partial arcs in a gym: rack holes, cables, mirrors).
Concentric rims of the same plate are merged, detections are linked into
tracks across frames, and the plate is the track whose vertical motion best
follows the lifter's body. Choosing by motion rather than distance matters
because a camera beside the bar end sees the plate well away from the hands
or shoulders. The known plate diameter then gives a metric scale on the plane
of the plate.
"""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

import cv2
import numpy as np

from plate_follow import follow_plate
from pose_features import interpolate_gaps, smooth

DETECT_SIDE = 640
MIN_RADIUS_SHARE = 0.05
MAX_RADIUS_SHARE = 0.35
CIRCLE_QUALITY = 0.75
CONCENTRIC_SHARE = 0.2
TRACK_EXPIRY_S = 1.0
MIN_TRACK_FRAMES = 15
MIN_COVERAGE = 0.5
MIN_BODY_CORRELATION = 0.6
GAP_FILL_S = 0.4


@dataclass
class PlateTrack:
    # Smoothed plate centers for drawing and posture rules.
    centers: np.ndarray
    # Unsmoothed (gaps filled) centers: rep timing must not be blurred by smoothing.
    raw_centers: np.ndarray
    radius_px: float
    lock_frame: int
    coverage: float
    scale_m_per_px: float
    radius_spread: float
    body_correlation: Optional[float]
    confidence: str


@dataclass
class _Track:
    points: Dict[int, Tuple[float, float]] = field(default_factory=dict)
    radii: List[float] = field(default_factory=list)
    last_frame: int = -1

    @property
    def radius(self) -> float:
        return float(np.median(self.radii))

    def last_point(self) -> np.ndarray:
        return np.array(self.points[self.last_frame])


def detect_circles(frame: np.ndarray) -> List[Tuple[float, float, float]]:
    """Plate candidates in full-resolution pixels; concentric rims merged, largest radius kept."""
    scale = min(1.0, DETECT_SIDE / max(1, min(frame.shape[:2])))
    small = frame if scale == 1.0 else cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (5, 5), 1.5)
    shortest = min(gray.shape[:2])
    found = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT_ALT,
        dp=1.5,
        minDist=max(8.0, shortest * 0.05),
        param1=150,
        param2=CIRCLE_QUALITY,
        minRadius=int(shortest * MIN_RADIUS_SHARE),
        maxRadius=int(shortest * MAX_RADIUS_SHARE),
    )
    if found is None:
        return []
    merged: List[List[float]] = []
    for x, y, r in sorted(found[0].tolist(), key=lambda item: -item[2]):
        owner = next((m for m in merged if np.hypot(x - m[0], y - m[1]) <= CONCENTRIC_SHARE * m[2]), None)
        if owner is None:
            merged.append([x, y, r])
    return [(x / scale, y / scale, r / scale) for x, y, r in merged]


def _link(tracks: List[_Track], frame_index: int, circles: List[Tuple[float, float, float]], fps: float) -> None:
    """Greedy nearest-neighbour linking; inner rims make the radius vary, so radius is only loosely checked."""
    live = [t for t in tracks if frame_index - t.last_frame <= fps * TRACK_EXPIRY_S]
    used = set()
    for x, y, r in sorted(circles, key=lambda item: -item[2]):
        best, best_distance = None, None
        for track in live:
            if id(track) in used:
                continue
            gap = frame_index - track.last_frame
            allowed = track.radius * min(1.2, 0.35 + 0.15 * gap)
            ratio = r / track.radius
            distance = float(np.hypot(*(np.array([x, y]) - track.last_point())))
            if distance <= allowed and 0.4 <= ratio <= 1.6 and (best_distance is None or distance < best_distance):
                best, best_distance = track, distance
        if best is None:
            best = _Track()
            tracks.append(best)
        best.points[frame_index] = (x, y)
        best.radii.append(r)
        best.last_frame = frame_index
        used.add(id(best))


def _correlation(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    mask = np.isfinite(a) & np.isfinite(b)
    if int(mask.sum()) < 30:
        return None
    x, y = a[mask], b[mask]
    if float(np.std(x)) < 1e-6 or float(np.std(y)) < 1e-6:
        return None
    return float(np.corrcoef(x, y)[0, 1])


def _track_series(track: _Track, total: int) -> np.ndarray:
    series = np.full((total, 2), np.nan)
    for frame_index, point in track.points.items():
        if frame_index < total:
            series[frame_index] = point
    return series


def _on_head(track: _Track, head: Optional[np.ndarray]) -> bool:
    """A round head moves with the lifter too; a track sitting on the face is not a plate."""
    if head is None:
        return False
    distances = [
        float(np.hypot(*(np.array(point) - head[f])))
        for f, point in track.points.items()
        if f < head.shape[0] and np.all(np.isfinite(head[f]))
    ]
    return bool(distances) and float(np.median(distances)) < 1.2 * track.radius


def _pick_track(
    tracks: List[_Track], expected: np.ndarray, total: int, head: Optional[np.ndarray] = None
) -> Tuple[Optional[_Track], Optional[float], str]:
    """The long track whose height follows the lifter; static circles correlate with nothing."""
    anchors = [t for t in tracks if len(t.points) >= MIN_TRACK_FRAMES and not _on_head(t, head)]
    if not anchors:
        return None, None, "plate_not_found"
    scored = []
    for track in anchors:
        correlation = _correlation(_track_series(track, total)[:, 1], expected[:total, 1])
        if correlation is not None and correlation >= MIN_BODY_CORRELATION:
            scored.append((len(track.points) * correlation, track, correlation))
    if not scored:
        return None, None, "plate_not_following_lifter"
    _, anchor, correlation = max(scored, key=lambda item: item[0])
    return anchor, correlation, "ok"


def _edge_distance(gray: np.ndarray, center: np.ndarray, radius: float, angles: Tuple[int, ...]) -> Optional[float]:
    """Median distance from the center to the strongest intensity step along a few nearby rays."""
    rhos = np.arange(radius * 0.5, radius * 1.3, 1.0)
    found = []
    for angle in np.radians(angles):
        xs = np.round(center[0] + rhos * np.cos(angle)).astype(int)
        ys = np.round(center[1] + rhos * np.sin(angle)).astype(int)
        if xs.min() < 0 or ys.min() < 0 or xs.max() >= gray.shape[1] or ys.max() >= gray.shape[0]:
            continue
        steps = np.abs(np.diff(gray[ys, xs]))
        best = int(np.argmax(steps))
        if steps[best] >= 15:
            found.append(float(rhos[best]))
    return float(np.median(found)) if len(found) >= 2 else None


def _vertical_radius(video_path: str, centers: np.ndarray, radius: float, samples: int = 30) -> float:
    """Half the plate's top-to-bottom size, averaged over frames.

    A plate seen at an angle is an ellipse whose vertical size is still the true diameter,
    while circle fits and all-round edge searches drift toward rims or the plates behind it.
    Measuring top plus bottom also cancels any offset of the tracked center.
    """
    frames = np.flatnonzero(np.all(np.isfinite(centers), axis=1))
    if frames.size == 0:
        return radius
    cap = cv2.VideoCapture(video_path)
    diameters = []
    for frame_index in frames[np.linspace(0, frames.size - 1, min(samples, frames.size)).astype(int)]:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(frame_index))
        ok, frame = cap.read()
        if not ok:
            continue
        gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (5, 5), 0).astype(np.float64)
        down = _edge_distance(gray, centers[frame_index], radius, (80, 85, 90, 95, 100))
        up = _edge_distance(gray, centers[frame_index], radius, (260, 265, 270, 275, 280))
        if down is not None and up is not None:
            diameters.append(down + up)
    cap.release()
    if len(diameters) < 5:
        return radius
    middle = float(np.median(diameters))
    spread = float(np.percentile(diameters, 75) - np.percentile(diameters, 25))
    if spread > 0.25 * middle or abs(middle / 2 - radius) > 0.3 * radius:
        return radius
    return middle / 2


def track_plate(
    video_path: str,
    expected_points: np.ndarray,
    fps: float,
    plate_diameter_cm: float,
    on_progress: Optional[Callable[[float], None]] = None,
    head_points: Optional[np.ndarray] = None,
) -> Tuple[Optional[PlateTrack], str]:
    """Returns (track, reason). expected_points is (frames, 2) full-resolution pixels of a body part near the bar."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None, "cannot_open_video"
    # The pose track decoded every frame; container frame counts are only estimates.
    total = expected_points.shape[0]
    tracks: List[_Track] = []
    index = 0
    while index < total:
        ok, frame = cap.read()
        if not ok:
            break
        _link(tracks, index, detect_circles(frame), fps)
        index += 1
        if on_progress and index % max(1, total // 10) == 0:
            on_progress(index / total)
    cap.release()

    anchor, _, reason = _pick_track(tracks, expected_points, total, head_points)
    if anchor is None:
        return None, reason
    radii = np.array(anchor.radii)
    # Inner rims are detected too; the plate's outer edge is the large end of the radius spread.
    radius_px = float(np.percentile(radii, 90))
    seed = min(anchor.points)
    followed, snapped_share = follow_plate(video_path, seed, anchor.points[seed], radius_px, total, fps)
    radius_px = _vertical_radius(video_path, followed, radius_px)
    coverage = float(np.mean(np.isfinite(followed[seed:, 1])))
    if coverage < MIN_COVERAGE:
        return None, "plate_tracking_lost"
    correlation = _correlation(followed[:, 1], expected_points[:total, 1])
    if correlation is None or correlation < MIN_BODY_CORRELATION:
        return None, "plate_not_following_lifter"

    max_gap = max(1, int(round(fps * GAP_FILL_S)))
    window = max(1, int(round(fps * 0.1)) | 1)
    raw_centers = np.stack([interpolate_gaps(followed[:, axis], max_gap) for axis in (0, 1)], axis=1)
    centers = np.stack([smooth(raw_centers[:, axis], window) for axis in (0, 1)], axis=1)
    spread = float((np.percentile(radii, 90) - np.percentile(radii, 50)) / max(radius_px, 1e-6))
    confidence = "high" if coverage >= 0.8 and snapped_share >= 0.5 and correlation >= 0.85 else "medium"
    return (
        PlateTrack(
            centers=centers,
            raw_centers=raw_centers,
            radius_px=radius_px,
            lock_frame=seed,
            coverage=coverage,
            scale_m_per_px=(plate_diameter_cm / 100.0) / max(2.0 * radius_px, 1.0),
            radius_spread=spread,
            body_correlation=correlation,
            confidence=confidence,
        ),
        "ok",
    )
