"""Exports de-identified keyframes of custom-mode reps for the vision model.

Per DECISIONS 2026-08-09 the default cloud tier is derived material only: no
original video and no audio. Each keyframe has the face pixelated, the pose
skeleton drawn, and is cropped to the person and shrunk, so the model sees the
movement rather than the person or the room.
"""
import json
import os
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from render_overlay import BODY_POSE_CONNECTIONS, JOINT_BGR, SKELETON_BGR

MAX_REPS = 3
MAX_LONG_SIDE = 640
JPEG_QUALITY = 82
FACE_INDEXES = list(range(0, 11))
CROP_MARGIN = 0.15
MANIFEST_NAME = "keyframes.json"


def pick_reps(reps: List[Dict[str, Any]], limit: int = MAX_REPS) -> List[Dict[str, Any]]:
    """First, middle and last rep, so the model sees how the set starts and ends."""
    if len(reps) <= limit:
        return list(reps)
    indexes = sorted({0, len(reps) // 2, len(reps) - 1})
    return [reps[index] for index in indexes][:limit]


def rep_keyframes(rep: Dict[str, Any], phase_labels: Tuple[str, str], far_label: str) -> List[Tuple[int, str, str]]:
    """(frame, phase code, Chinese label): start, mid first phase, far end, mid second phase."""
    start, end = int(rep["startFrame"]), int(rep["endFrame"])
    far_start = int(rep.get("farStartFrame", rep["peakFrame"]))
    far_end = int(rep.get("farEndFrame", rep["peakFrame"]))
    frames = [
        (start, "start", "起始"),
        ((start + far_start) // 2, "phase1", f"{phase_labels[0]}中段"),
        (int(rep["peakFrame"]), "far", far_label),
        ((far_end + end) // 2, "phase2", f"{phase_labels[1]}中段"),
    ]
    unique: List[Tuple[int, str, str]] = []
    for item in frames:
        if not unique or item[0] != unique[-1][0]:
            unique.append(item)
    return unique


def far_label_zh(axis: str, rest: str) -> str:
    if axis != "vertical":
        return "最远端"
    return "最高点" if rest == "min" else "最低点"


def blur_face(frame: np.ndarray, row: np.ndarray) -> bool:
    """Pixelates the head region from face landmark positions; False if no face position is known."""
    face = row[FACE_INDEXES, :2]
    face = face[np.all(np.isfinite(face), axis=1)]
    if face.shape[0] == 0:
        return False
    shoulders = row[[11, 12], :2]
    hips = row[[23, 24], :2]
    shoulder_width = float(np.linalg.norm(shoulders[0] - shoulders[1])) if np.all(np.isfinite(shoulders)) else 0.0
    torso = float(np.linalg.norm(shoulders.mean(axis=0) - hips.mean(axis=0))) if np.all(np.isfinite(row[[11, 12, 23, 24], :2])) else 0.0
    span = float(max(np.ptp(face[:, 0]), np.ptp(face[:, 1])))
    # Cover the whole head (hair, ears, profile), not only the face landmarks.
    half = max(span * 1.6, shoulder_width * 0.6, torso * 0.32, 0.04 * max(frame.shape[:2]), 16.0)
    cx, cy = face.mean(axis=0)
    x0, y0 = int(max(0, cx - half)), int(max(0, cy - half * 1.4))
    x1, y1 = int(min(frame.shape[1], cx + half)), int(min(frame.shape[0], cy + half))
    if x1 <= x0 or y1 <= y0:
        return False
    roi = frame[y0:y1, x0:x1]
    small = cv2.resize(roi, (6, 6), interpolation=cv2.INTER_AREA)
    frame[y0:y1, x0:x1] = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
    return True


def draw_skeleton(frame: np.ndarray, row: np.ndarray) -> None:
    thickness = max(2, int(min(frame.shape[:2]) / 360))
    for a, b in BODY_POSE_CONNECTIONS:
        if row[a, 2] >= 0.5 and row[b, 2] >= 0.5:
            cv2.line(frame, (int(row[a, 0]), int(row[a, 1])), (int(row[b, 0]), int(row[b, 1])), SKELETON_BGR, thickness, cv2.LINE_AA)
    for index in range(11, 33):
        if row[index, 2] >= 0.5:
            cv2.circle(frame, (int(row[index, 0]), int(row[index, 1])), thickness + 2, JOINT_BGR, -1, cv2.LINE_AA)


def crop_box(track: np.ndarray, start: int, end: int, width: int, height: int) -> Tuple[int, int, int, int]:
    """Person bounding box over the whole rep, so every keyframe of a rep shares one crop."""
    window = track[max(0, start):end + 1, 11:33, :]
    xy = window[..., :2][window[..., 2] >= 0.3]
    xy = xy[np.all(np.isfinite(xy), axis=1)]
    if xy.shape[0] == 0:
        return 0, 0, width, height
    x0, y0 = xy.min(axis=0)
    x1, y1 = xy.max(axis=0)
    margin = CROP_MARGIN * max(x1 - x0, y1 - y0)
    # Head sits above the shoulder landmarks; leave room for it.
    return (
        int(max(0, x0 - margin)),
        int(max(0, y0 - 2 * margin)),
        int(min(width, x1 + margin)),
        int(min(height, y1 + margin)),
    )


def _shrink(image: np.ndarray) -> np.ndarray:
    long_side = max(image.shape[:2])
    if long_side <= MAX_LONG_SIDE:
        return image
    ratio = MAX_LONG_SIDE / long_side
    return cv2.resize(image, (int(image.shape[1] * ratio), int(image.shape[0] * ratio)), interpolation=cv2.INTER_AREA)


def plan_keyframes(
    reps: List[Dict[str, Any]], phase_labels: Tuple[str, str], axis: str, rest: str
) -> List[Dict[str, Any]]:
    far = far_label_zh(axis, rest)
    plan = []
    for rep in pick_reps(reps):
        for frame, phase, label in rep_keyframes(rep, phase_labels, far):
            plan.append({"frame": frame, "repIndex": int(rep["repIndex"]), "phase": phase, "phaseZh": label, "rep": rep})
    return plan


def export_keyframes(
    video_path: str,
    track: np.ndarray,
    reps: List[Dict[str, Any]],
    out_dir: str,
    fps: float,
    phase_labels: Tuple[str, str],
    axis: str,
    rest: str,
) -> Optional[Dict[str, Any]]:
    plan = plan_keyframes(reps, phase_labels, axis, rest)
    if not plan:
        return None
    wanted: Dict[int, List[Dict[str, Any]]] = {}
    for item in plan:
        wanted.setdefault(item["frame"], []).append(item)
    os.makedirs(out_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frames: List[Dict[str, Any]] = []
    last = max(wanted)
    index = 0
    try:
        while index <= last:
            ok, frame = cap.read()
            if not ok:
                break
            if index in wanted and index < track.shape[0]:
                row = track[index]
                # No pose means no known face position: skip rather than send an unblurred person.
                if np.isfinite(row[0, 0]) and blur_face(frame, row):
                    draw_skeleton(frame, row)
                    for item in wanted[index]:
                        rep = item["rep"]
                        x0, y0, x1, y1 = crop_box(track, int(rep["startFrame"]), int(rep["endFrame"]), width, height)
                        name = f"rep{item['repIndex']}_{item['phase']}.jpg"
                        cv2.imwrite(os.path.join(out_dir, name), _shrink(frame[y0:y1, x0:x1]), [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                        frames.append(
                            {
                                "file": name,
                                "repIndex": item["repIndex"],
                                "phase": item["phase"],
                                "phaseZh": item["phaseZh"],
                                "timeS": round(index / max(fps, 1.0), 2),
                            }
                        )
            index += 1
    finally:
        cap.release()
    if not frames:
        return None
    frames.sort(key=lambda item: (item["repIndex"], item["timeS"]))
    manifest = {"version": 1, "faceBlurred": True, "audio": False, "frames": frames}
    with open(os.path.join(out_dir, MANIFEST_NAME), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    return manifest
