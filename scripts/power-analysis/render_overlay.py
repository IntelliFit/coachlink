"""Draws the analysis overlay on the video: card HUD, skeleton, bar path and posture tags."""
import os
from typing import Any, Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np

import generic_motion as gm
import pose_features as pf
from hud import ACCENT_BGR, Card, Layout, TextItem, draw_cards, pill, render_text

G = 9.80665
FACE_LANDMARK_INDEXES = set(range(0, 11))
BODY_POSE_CONNECTIONS = [
    connection
    for connection in mp.solutions.pose.POSE_CONNECTIONS
    if connection[0] not in FACE_LANDMARK_INDEXES and connection[1] not in FACE_LANDMARK_INDEXES
]
SKELETON_BGR = (255, 214, 120)
JOINT_BGR = (255, 255, 255)
BAR_BGR = (0, 214, 255)
TAG_BGR = {"issue": (64, 64, 226), "warn": (36, 132, 240)}
LABEL_BGR = (34, 30, 28)
JOINT_LABELS = {"knee": ("膝", "Knee"), "hip": ("髋", "Hip"), "elbow": ("肘", "Elbow"), "shoulder": ("肩", "Shoulder")}
TRAIL_BGR = (61, 138, 255)
CARD_LABELS = {
    "power": ("功率  POWER", "POWER"),
    "workout": ("动作  WORKOUT", "WORKOUT"),
    "weight": ("负重  WEIGHT", "WEIGHT"),
    "bar": ("杠铃  BARBELL", "BARBELL"),
    "speed": ("速度  SPEED", "SPEED"),
    "last": ("上一次平均速度", "LAST REP MEAN"),
    "rom": ("幅度  RANGE", "RANGE"),
    "tempo": ("上一次节奏", "LAST REP TEMPO"),
}
KEY_JOINT_BY_MODE = {
    "pullup": "elbow",
    "muscleup": "elbow",
    "dip": "elbow",
    "pushup": "elbow",
    "bench_press": "elbow",
    "squat": "knee",
    "back_squat": "knee",
    "deadlift": "hip",
}

TAG_HEIGHT = 42
TAG_STEP = 48


def place_tag(x: int, y: int, width: int, placed: List[Tuple[int, int, int, int]], frame_height: int) -> int:
    """First vertical position near y that does not overlap an earlier tag; bounded attempts."""
    def overlaps(top: int) -> bool:
        return any(x < bx + bw and bx < x + width and top < by + bh and by < top + TAG_HEIGHT for bx, by, bw, bh in placed)

    lowest = max(0, frame_height - TAG_HEIGHT - 2)
    for offset in (0, TAG_STEP, -TAG_STEP, 2 * TAG_STEP, -2 * TAG_STEP, 3 * TAG_STEP, -3 * TAG_STEP):
        candidate = min(max(0, y + offset), lowest)
        if not overlaps(candidate):
            return candidate
    return y


def upward_speed(y_track: List[Optional[float]], scale: float, fps: float) -> np.ndarray:
    """Smoothed upward speed in m/s for the live speed card (0 while going down)."""
    y = np.array([np.nan if value is None else value for value in y_track], dtype=np.float64)
    step = max(1, int(round(fps * 0.05)))
    speed = np.zeros(y.size)
    if y.size > 2 * step:
        speed[step:-step] = (y[:-2 * step] - y[2 * step:]) * scale * fps / (2 * step)
    speed = pf.smooth(np.nan_to_num(speed), max(1, int(round(fps * 0.1))))
    return np.clip(np.nan_to_num(speed), 0.0, None)


class OverlayRenderer:
    def __init__(
        self,
        metrics: Dict[str, Any],
        preset: Dict[str, Any],
        track: np.ndarray,
        y_track: List[Optional[float]],
        scale_m_per_px: float,
        fps: float,
        frame_size: Tuple[int, int],
        language: str,
        bar_points: Optional[np.ndarray],
        plate_radius_px: Optional[float],
        events: List[Dict[str, Any]],
        side: str,
        custom_motion: Optional[gm.GenericMotion] = None,
    ) -> None:
        self.metrics = metrics
        self.preset = preset
        self.track = track
        self.y_track = y_track
        self.scale = scale_m_per_px
        self.fps = fps
        self.width, self.height = frame_size
        self.is_zh = language == "zh"
        self.bar_points = bar_points
        self.plate_radius_px = plate_radius_px
        self.events = events
        self.side = side
        self.barbell = bool(preset.get("barbell"))
        self.layout = Layout.for_frame(self.width, self.height)
        mass = metrics.get("mass") if isinstance(metrics.get("mass"), dict) else {}
        self.effective_mass = float(mass.get("effectiveMassKg") or 0)
        self.external_load = float(mass.get("externalLoadKg") or 0)
        self.body_weight = float(mass.get("bodyWeightKg") or 0)
        self.reps = [rep for rep in metrics.get("reps") or [] if isinstance(rep, dict)]
        summary = metrics.get("summary") or {}
        self.best_power = max(1.0, float(summary.get("bestPowerW") or 0))
        self.best_speed = max(0.1, float(summary.get("bestVelocityMps") or 0))
        self.best_mean = max(0.05, float(summary.get("bestMeanVelocityMps") or 0))
        self.speed = upward_speed(y_track, scale_m_per_px, fps)
        self.custom = custom_motion if custom_motion is not None and custom_motion.signal is not None else None
        if self.custom is not None:
            self.key_joint = self.custom.main_joint
            self.joint_angles = self.custom.joint_series
            roms = [float(rep.get("displacementM") or 0) for rep in self.reps]
            self.median_rom = max(0.01, float(np.median(roms)) if roms else 0.01)
        else:
            self.key_joint = KEY_JOINT_BY_MODE.get(str(metrics.get("mode") or ""))
            self.joint_angles = (
                pf.smooth(pf.joint_angle(track, self.key_joint, side), max(1, int(round(fps * 0.08))))
                if self.key_joint
                else None
            )

    def _label(self, key: str) -> str:
        return CARD_LABELS[key][0 if self.is_zh else 1]

    def _y(self, index: int) -> Optional[float]:
        return self.y_track[index] if 0 <= index < len(self.y_track) else None

    def _active_rep(self, index: int) -> Optional[Dict[str, Any]]:
        return next((r for r in self.reps if int(r.get("startFrame", -1)) <= index <= int(r.get("endFrame", -1))), None)

    def _last_done(self, index: int) -> Optional[Dict[str, Any]]:
        done = [r for r in self.reps if int(r.get("endFrame", -1)) < index]
        return done[-1] if done else None

    def _live_power(self, index: int, active: Optional[Dict[str, Any]], last: Optional[Dict[str, Any]]) -> float:
        if active:
            start = int(active.get("startFrame", index))
            start_y, current_y = self._y(start), self._y(index)
            elapsed = max((index - start) / self.fps, 1.0 / self.fps)
            if start_y is None or current_y is None:
                return 0.0
            return max(0.0, self.effective_mass * G * (start_y - current_y) * self.scale / elapsed)
        return float(last.get("avgPowerW") or 0) if last else 0.0

    def _custom_cards(self, index: int) -> List[Card]:
        assert self.custom is not None and self.custom.signal is not None
        active, last = self._active_rep(index), self._last_done(index)
        done = sum(1 for r in self.reps if int(r.get("endFrame", -1)) < index) + (1 if active else 0)
        name = str(self.preset["labelZh"] if self.is_zh else self.preset["label"])
        prefix = "动作  " if self.is_zh else ""
        cards = [Card(f"{prefix}{name}", str(done), "次" if self.is_zh else "REPS", big=True)]
        values = self.custom.signal.values
        rom = float(last.get("displacementM") or 0) if last else 0.0
        if active:
            start = int(active.get("startFrame", index))
            if 0 <= start < values.size and index < values.size and np.isfinite(values[start]) and np.isfinite(values[index]):
                rom = abs(float(values[index] - values[start])) * self.scale
        cards.append(Card(self._label("rom"), f"{rom * 100:.0f}", "CM", rom / self.median_rom))
        if self.external_load > 0:
            cards.append(Card(self._label("weight"), f"+{self.external_load:.0f}", "KG", None))
        if last:
            first, second = self.custom.phase_labels_zh
            label = f"上一次 {first}/{second}" if self.is_zh else self._label("tempo")
            tempo = f"{float(last.get('phase1TimeS') or 0):.1f}/{float(last.get('phase2TimeS') or 0):.1f}"
            cards.append(Card(label, tempo, "S", None))
        return cards

    def _draw_primary_trail(self, frame: np.ndarray, index: int) -> None:
        if self.custom is None or self.custom.signal is None:
            return
        points = self.custom.signal.points
        if index >= points.shape[0]:
            return
        s = self.layout.scale
        trail = points[max(0, index - int(self.fps * 1.5)):index + 1]
        trail = trail[np.all(np.isfinite(trail), axis=1)].astype(np.int32)
        if trail.shape[0] >= 2:
            cv2.polylines(frame, [trail.reshape(-1, 1, 2)], False, TRAIL_BGR, max(2, int(4 * s)), cv2.LINE_AA)
        point = points[index]
        if np.all(np.isfinite(point)):
            cv2.circle(frame, (int(point[0]), int(point[1])), max(6, int(10 * s)), TRAIL_BGR, -1, cv2.LINE_AA)

    def _cards(self, index: int) -> List[Card]:
        if self.custom is not None:
            return self._custom_cards(index)
        active, last = self._active_rep(index), self._last_done(index)
        power = self._live_power(index, active, last)
        done = sum(1 for r in self.reps if int(r.get("endFrame", -1)) < index) + (1 if active else 0)
        movement = str(self.preset["labelZh"] if self.is_zh else self.preset["label"]).upper()
        reps_unit = f"{done} 次" if self.is_zh else f"{done} REPS"
        cards = [
            Card(self._label("power"), f"{power:.0f}", "W", power / self.best_power, big=True),
            Card(self._label("workout"), movement, reps_unit),
        ]
        if self.barbell:
            cards.append(Card(self._label("bar"), f"{self.external_load:.0f}", "KG", None))
        else:
            load = f"+{self.external_load:.0f}" if self.external_load > 0 else "0"
            share = self.external_load / max(1.0, self.external_load + self.body_weight)
            cards.append(Card(self._label("weight"), load, "KG", share))
        speed = float(self.speed[index]) if index < self.speed.size else 0.0
        cards.append(Card(self._label("speed"), f"{speed:.2f}", "M/S", speed / self.best_speed))
        if last:
            mean = float(last.get("meanVelocityMps") or 0)
            cards.append(Card(self._label("last"), f"{mean:.2f}", "M/S", mean / self.best_mean))
        return cards

    def _part_point(self, index: int, part: Optional[str]) -> Optional[Tuple[int, int]]:
        if part == "bar" and self.bar_points is not None and index < self.bar_points.shape[0]:
            point = self.bar_points[index]
        elif part in ("knee", "hip", "elbow", "shoulder", "ankle", "wrist"):
            point = pf.side_points(self.track[index:index + 1], self.side, part, 0.3)[0]
        elif part == "nose":
            point = pf.points(self.track[index:index + 1], 0, 0.3)[0]
        else:
            return None
        if not np.all(np.isfinite(point)):
            return None
        return int(point[0]), int(point[1])

    def _draw_skeleton(self, frame: np.ndarray, index: int) -> None:
        row = self.track[index]
        if not np.isfinite(row[0, 0]):
            return
        s = self.layout.scale
        thickness = max(2, int(3 * s))
        for a, b in BODY_POSE_CONNECTIONS:
            if row[a, 2] >= 0.5 and row[b, 2] >= 0.5:
                cv2.line(frame, (int(row[a, 0]), int(row[a, 1])), (int(row[b, 0]), int(row[b, 1])), SKELETON_BGR, thickness, cv2.LINE_AA)
        for i in range(11, 33):
            if row[i, 2] >= 0.5:
                cv2.circle(frame, (int(row[i, 0]), int(row[i, 1])), max(3, int(5 * s)), JOINT_BGR, -1, cv2.LINE_AA)

    def _draw_bar(self, frame: np.ndarray, index: int) -> None:
        if self.bar_points is None or index >= self.bar_points.shape[0]:
            return
        s = self.layout.scale
        start = max(0, index - int(self.fps * 2.5))
        active = self._active_rep(index) or self._last_done(index)
        if active:
            start = max(start, int(active.get("startFrame", start)) - int(self.fps * 0.3))
        trail = self.bar_points[start:index + 1]
        trail = trail[np.all(np.isfinite(trail), axis=1)].astype(np.int32)
        if trail.shape[0] >= 2:
            cv2.polylines(frame, [trail.reshape(-1, 1, 2)], False, BAR_BGR, max(3, int(5 * s)), cv2.LINE_AA)
        point = self.bar_points[index]
        if np.all(np.isfinite(point)):
            center = (int(point[0]), int(point[1]))
            cv2.circle(frame, center, max(5, int(9 * s)), BAR_BGR, -1, cv2.LINE_AA)
            if self.plate_radius_px:
                cv2.circle(frame, center, int(self.plate_radius_px), BAR_BGR, max(2, int(3 * s)), cv2.LINE_AA)

    def _tags(self, frame: np.ndarray, index: int, texts: List[TextItem]) -> None:
        s = self.layout.scale
        before, after = int(self.fps * 0.3), int(self.fps * 1.0)
        active = [event for event in self.events if event["frame"] - before <= index <= event["frame"] + after][:2]
        placed: List[Tuple[int, int, int, int]] = []
        size = 26 * s
        for slot, event in enumerate(active):
            label = event["labelZh"] if self.is_zh else event["labelEn"]
            color = TAG_BGR.get(event["severity"], TAG_BGR["warn"])
            point = self._part_point(index, event.get("part"))
            width = int(size * (len(label) + 1.6))
            if point is None:
                x, y = self.width - width - int(28 * s), int(self.layout.y + slot * 60 * s)
            else:
                cv2.circle(frame, point, max(8, int(14 * s)), color, max(2, int(4 * s)), cv2.LINE_AA)
                x = min(max(8, point[0] + int(26 * s)), self.width - width - 8)
                y = min(max(8, point[1] - int(22 * s)), self.height - int(52 * s))
            y = place_tag(x, y, width, placed, self.height)
            placed.append(pill(frame, x, y, label, size, color, texts))

    def _joint_label(self, frame: np.ndarray, index: int, texts: List[TextItem]) -> None:
        if self.joint_angles is None or self.key_joint is None:
            return
        value = pf.value_at(self.joint_angles, index)
        point = self._part_point(index, self.key_joint)
        if value is None or point is None:
            return
        s = self.layout.scale
        name = JOINT_LABELS[self.key_joint][0 if self.is_zh else 1]
        x = min(point[0] + int(18 * s), self.width - int(150 * s))
        pill(frame, x, point[1] + int(18 * s), f"{name} {value:.0f}°", 22 * s, LABEL_BGR, texts, alpha=0.7)

    def draw(self, frame: np.ndarray, index: int) -> np.ndarray:
        self._draw_skeleton(frame, index)
        self._draw_bar(frame, index)
        self._draw_primary_trail(frame, index)
        texts: List[TextItem] = []
        bottom = draw_cards(frame, self._cards(index), self.layout, texts)
        s = self.layout.scale
        texts.append(TextItem("教链 CoachLink" if self.is_zh else "CoachLink", self.layout.x + 4 * s, bottom + 6 * s, 22 * s, (210, 214, 220), bold=True))
        cv2.rectangle(frame, (self.layout.x, int(bottom + 2 * s)), (self.layout.x + int(4 * s), int(bottom + 30 * s)), ACCENT_BGR, -1)
        self._joint_label(frame, index, texts)
        self._tags(frame, index, texts)
        return render_text(frame, texts)


def render_output_video(input_path: str, output_path: str, renderer_args: Dict[str, Any], on_progress=None) -> None:
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError("Cannot reopen input video")
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    if not out.isOpened():
        cap.release()
        raise RuntimeError("Cannot create intermediate analysis video")
    renderer = OverlayRenderer(frame_size=(width, height), **renderer_args)
    track_frames = renderer.track.shape[0]
    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if index < track_frames:
            frame = renderer.draw(frame, index)
        out.write(frame)
        index += 1
        if on_progress and frame_count and index % max(1, frame_count // 20) == 0:
            on_progress(index / frame_count)
    cap.release()
    out.release()
