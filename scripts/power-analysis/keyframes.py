"""Exports de-identified keyframes of custom-mode reps for the vision model.

Per DECISIONS 2026-08-09 the default cloud tier is derived material only: no
original video and no audio. Each keyframe has every face pixelated (the lifter's
from the pose track, anyone else's from a face detector), the pose skeleton
drawn, and is cropped to the person and shrunk, so the model sees the movement
rather than the people or the room. Without a working face detector no keyframes
are written, since bystanders could not be de-identified.

The measured angles are printed next to their joints on each keyframe and also
written to the manifest (per frame, plus a short resampled curve per rep), so
the model reads every number off the measurement instead of estimating it.
"""
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

import face_privacy as fpv
import generic_motion as gm
import pose_features as pf
from hud import ACCENT_BGR, font, pill, render_text
from render_overlay import BODY_POSE_CONNECTIONS, JOINT_BGR, LABEL_BGR, SKELETON_BGR

MAX_REPS = 3
MAX_LONG_SIDE = 640
JPEG_QUALITY = 82
FACE_INDEXES = list(range(0, 11))
CROP_MARGIN = 0.15
# Faces are searched a little beyond the crop, so one cut by the crop edge still has context.
FACE_SEARCH_MARGIN = 0.1
MANIFEST_NAME = "keyframes.json"
MANIFEST_VERSION = 2
# Besides the main joint, these are labelled whenever the landmarks show them.
EXTRA_JOINTS = ("knee", "hip", "elbow")
TRUNK = gm.TRUNK
ANGLE_LABELS_ZH = {"elbow": "肘", "shoulder": "肩", "hip": "髋", "knee": "膝", TRUNK: "躯干"}
SEQUENCE_POINTS = 8
# A rep's curve is only resampled when most of its frames have a measured angle.
MIN_SEQUENCE_COVERAGE = 0.6
LABEL_FONT_SHARE = 1 / 34


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
    fpv.pixelate(frame, (x0, y0, x1, y1))
    return True


def blur_every_face(frame: np.ndarray, row: np.ndarray, face_detect: fpv.Detect, region: Tuple[int, int, int, int]) -> bool:
    """Every face the detector finds around the crop, then the lifter's head from the pose.

    False when either step cannot run, so the frame is skipped instead of half de-identified.
    """
    try:
        fpv.blur_all_faces(frame, face_detect, region)
    except Exception as exc:  # noqa: BLE001 - a failed search must not export the frame
        print(f"keyframe skipped: face detection failed ({exc})", file=sys.stderr, flush=True)
        return False
    return blur_face(frame, row)


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


def _shrink(image: np.ndarray) -> Tuple[np.ndarray, float]:
    """A copy no larger than MAX_LONG_SIDE, and the ratio applied."""
    long_side = max(image.shape[:2])
    if long_side <= MAX_LONG_SIDE:
        return image.copy(), 1.0
    ratio = MAX_LONG_SIDE / long_side
    size = (int(image.shape[1] * ratio), int(image.shape[0] * ratio))
    return cv2.resize(image, size, interpolation=cv2.INTER_AREA), ratio


def angle_series(track: np.ndarray, motion: gm.GenericMotion, fps: float) -> Dict[str, np.ndarray]:
    """Smoothed angle series to label: the main joint first, then knee/hip/elbow, then trunk lean.

    Joints use the side facing the camera, like the main joint; the trunk uses both sides,
    so it reads the same from the front and from the side. Angles this camera position cannot
    measure reliably are left out entirely.
    """
    window = max(1, int(round(fps * 0.08)))
    series: Dict[str, np.ndarray] = {}
    if motion.main_joint and motion.joint_series is not None:
        series[motion.main_joint] = motion.joint_series
    for joint in EXTRA_JOINTS:
        if joint not in series and motion.measurable(joint):
            angle = pf.smooth(gm.joint_angle(track, joint, motion.joint_side), window)
            # Like the main joint choice: an angle this small is a flattened 2D projection.
            with np.errstate(invalid="ignore"):
                series[joint] = np.where(angle >= gm.MIN_PLAUSIBLE_DEG, angle, np.nan)
    if motion.measurable(TRUNK):
        series[TRUNK] = pf.smooth(gm.trunk_angle(track), window)
    return series


def frame_angles(series: Dict[str, np.ndarray], frame: int) -> Dict[str, int]:
    """Whole-degree angles measured at this frame; joints without a reading are left out."""
    angles: Dict[str, int] = {}
    for name, values in series.items():
        value = pf.value_at(values, frame)
        if value is not None:
            angles[name] = int(round(value))
    return angles


def resample_rep(values: np.ndarray, start: int, end: int, points: int = SEQUENCE_POINTS) -> Optional[List[int]]:
    """The rep's curve at evenly spaced moments from start to end, in whole degrees."""
    start, end = max(0, start), min(values.size - 1, end)
    if end <= start:
        return None
    chunk = values[start:end + 1]
    finite = np.flatnonzero(np.isfinite(chunk))
    if finite.size < 2 or finite.size < MIN_SEQUENCE_COVERAGE * chunk.size:
        return None
    targets = np.linspace(0, chunk.size - 1, points)
    return [int(round(value)) for value in np.interp(targets, finite, chunk[finite])]


def rep_angle_curves(series: Dict[str, np.ndarray], reps: List[Dict[str, Any]], main_joint: Optional[str]) -> List[Dict[str, Any]]:
    """Per rep: the main joint and trunk lean resampled to a few points (each only when measured)."""
    names = [name for name in (main_joint, TRUNK) if name and name in series]
    curves = []
    for rep in reps:
        angles = {}
        for name in names:
            curve = resample_rep(series[name], int(rep["startFrame"]), int(rep["endFrame"]))
            if curve is not None:
                angles[name] = curve
        if angles:
            curves.append({"repIndex": int(rep["repIndex"]), "anglesDeg": angles})
    return curves


def angle_anchor(row: np.ndarray, name: str, side: str) -> Optional[Tuple[float, float]]:
    """Where a label belongs: the joint vertex, or the middle of the trunk line."""
    track = row[None, ...]
    if name == TRUNK:
        shoulder = pf.side_points(track, "both", "shoulder")[0]
        hip = pf.side_points(track, "both", "hip")[0]
        point = (shoulder + hip) / 2
    else:
        point = pf.side_points(track, side, name)[0]
    if not np.all(np.isfinite(point)):
        return None
    return float(point[0]), float(point[1])


def _overlaps(box: Tuple[int, int, int, int], placed: List[Tuple[int, int, int, int]]) -> bool:
    x, y, w, h = box
    return any(x < px + pw and px < x + w and y < py + ph and py < y + h for px, py, pw, ph in placed)


def place_label(
    anchor: Tuple[int, int], size: Tuple[int, int], placed: List[Tuple[int, int, int, int]], image_size: Tuple[int, int]
) -> Tuple[int, int]:
    """Beside the joint, right first, then left; shifted up or down to clear earlier labels."""
    (ax, ay), (w, h), (width, height) = anchor, size, image_size
    gap = max(4, h // 3)
    candidates = []
    for x in (ax + gap, ax - gap - w):
        for y in (ay - h // 2, ay - h // 2 - h - 2, ay + h // 2 + 2):
            candidates.append((min(max(0, x), max(0, width - w)), min(max(0, y), max(0, height - h))))
    for x, y in candidates:
        if not _overlaps((x, y, w, h), placed):
            return x, y
    return candidates[0]


def draw_angle_labels(
    image: np.ndarray,
    row: np.ndarray,
    angles: Dict[str, int],
    side: str,
    origin: Tuple[int, int],
    ratio: float,
    main_joint: Optional[str],
) -> np.ndarray:
    """Prints each measured angle beside its joint on a cropped, shrunk keyframe.

    The main joint gets the accent colour so it stands out from the context angles.
    """
    if not angles:
        return image
    size = max(13.0, max(image.shape[:2]) * LABEL_FONT_SHARE)
    texts = []
    placed: List[Tuple[int, int, int, int]] = []
    for name, value in angles.items():
        anchor = angle_anchor(row, name, side)
        if anchor is None:
            continue
        point = (int((anchor[0] - origin[0]) * ratio), int((anchor[1] - origin[1]) * ratio))
        if not (0 <= point[0] < image.shape[1] and 0 <= point[1] < image.shape[0]):
            continue
        text = f"{ANGLE_LABELS_ZH[name]} {value}°"
        box = (int(font(size, True).getlength(text) + size * 1.2), int(size * 1.7))
        x, y = place_label(point, box, placed, (image.shape[1], image.shape[0]))
        color = ACCENT_BGR if name == main_joint else LABEL_BGR
        cv2.circle(image, point, max(3, int(size / 4)), color, -1, cv2.LINE_AA)
        placed.append(pill(image, x, y, text, size, color, texts, alpha=0.82))
    return render_text(image, texts)


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
    motion: Optional[gm.GenericMotion] = None,
    face_detect: Optional[fpv.Detect] = None,
) -> Optional[Dict[str, Any]]:
    plan = plan_keyframes(reps, phase_labels, axis, rest)
    if not plan:
        return None
    if face_detect is not None:
        return _export(video_path, track, reps, out_dir, fps, plan, motion, face_detect)
    try:
        detector = fpv.FaceDetector()
    except Exception as exc:  # noqa: BLE001 - any load failure means bystanders cannot be blurred
        print(f"keyframes skipped: face detector unavailable ({exc})", file=sys.stderr, flush=True)
        return None
    try:
        return _export(video_path, track, reps, out_dir, fps, plan, motion, detector)
    finally:
        detector.close()


def face_search_region(boxes: List[Tuple[int, int, int, int]], width: int, height: int) -> Tuple[int, int, int, int]:
    """Union of the crops cut from one frame, grown by FACE_SEARCH_MARGIN and clipped to it."""
    x0, y0 = min(box[0] for box in boxes), min(box[1] for box in boxes)
    x1, y1 = max(box[2] for box in boxes), max(box[3] for box in boxes)
    margin = int(FACE_SEARCH_MARGIN * max(x1 - x0, y1 - y0))
    return max(0, x0 - margin), max(0, y0 - margin), min(width, x1 + margin), min(height, y1 + margin)


def _export(
    video_path: str,
    track: np.ndarray,
    reps: List[Dict[str, Any]],
    out_dir: str,
    fps: float,
    plan: List[Dict[str, Any]],
    motion: Optional[gm.GenericMotion],
    face_detect: fpv.Detect,
) -> Optional[Dict[str, Any]]:
    wanted: Dict[int, List[Dict[str, Any]]] = {}
    for item in plan:
        wanted.setdefault(item["frame"], []).append(item)
    series = angle_series(track, motion, fps) if motion is not None else {}
    main_joint = motion.main_joint if motion is not None else None
    side = motion.joint_side if motion is not None else "left"
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
                crops = [
                    crop_box(track, int(item["rep"]["startFrame"]), int(item["rep"]["endFrame"]), width, height)
                    for item in wanted[index]
                ]
                # No pose means no known face position: skip rather than send an unblurred person.
                if np.isfinite(row[0, 0]) and blur_every_face(frame, row, face_detect, face_search_region(crops, width, height)):
                    draw_skeleton(frame, row)
                    angles = frame_angles(series, index)
                    for item, (x0, y0, x1, y1) in zip(wanted[index], crops):
                        name = f"rep{item['repIndex']}_{item['phase']}.jpg"
                        image, ratio = _shrink(frame[y0:y1, x0:x1])
                        image = draw_angle_labels(image, row, angles, side, (x0, y0), ratio, main_joint)
                        cv2.imwrite(os.path.join(out_dir, name), image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                        frames.append(
                            {
                                "file": name,
                                "repIndex": item["repIndex"],
                                "phase": item["phase"],
                                "phaseZh": item["phaseZh"],
                                "timeS": round(index / max(fps, 1.0), 2),
                                "anglesDeg": angles,
                            }
                        )
            index += 1
    finally:
        cap.release()
    if not frames:
        return None
    frames.sort(key=lambda item: (item["repIndex"], item["timeS"]))
    manifest = {
        "version": MANIFEST_VERSION,
        "faceBlurred": True,
        "audio": False,
        "mainJoint": main_joint,
        "unmeasurable": motion.unmeasurable_angles if motion is not None else [],
        "frames": frames,
        "repAngles": rep_angle_curves(series, reps, main_joint),
    }
    with open(os.path.join(out_dir, MANIFEST_NAME), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    return manifest
