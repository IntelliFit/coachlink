#!/usr/bin/env python3
"""Render the 教链 finger-membrane effect onto a video.

Only hand landmarks are used. Matching fingertips are paired by finger name.
Collapsed/occluded fingers stay out of the topology through hysteresis.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw, ImageFont


FINGER_CHAINS = (
    (1, 2, 3, 4),
    (5, 6, 7, 8),
    (9, 10, 11, 12),
    (13, 14, 15, 16),
    (17, 18, 19, 20),
)
TIP_INDICES = (4, 8, 12, 16, 20)
FACE_COLORS = (
    (210, 244, 51),
    (255, 142, 55),
    (243, 68, 202),
    (83, 219, 255),
    (64, 252, 161),
)
EDGE_COLORS = (
    (95, 255, 239),
    (255, 209, 91),
    (255, 121, 231),
    (122, 211, 255),
    (152, 255, 202),
)
FONT_CANDIDATES = (
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def distance3d(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a[:3] - b[:3]))


def joint_angle(first: np.ndarray, middle: np.ndarray, last: np.ndarray) -> float:
    a = first[:3] - middle[:3]
    b = last[:3] - middle[:3]
    denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denominator < 1e-7:
        return 0.0
    cosine = clamp(float(np.dot(a, b)) / denominator, -1.0, 1.0)
    return math.acos(cosine)


def extension_score(points: np.ndarray, finger_index: int) -> float:
    mcp_i, pip_i, dip_i, tip_i = FINGER_CHAINS[finger_index]
    mcp, pip, dip, tip, wrist = (
        points[mcp_i],
        points[pip_i],
        points[dip_i],
        points[tip_i],
        points[0],
    )
    path = distance3d(mcp, pip) + distance3d(pip, dip) + distance3d(dip, tip)
    straightness = clamp((distance3d(mcp, tip) / max(path, 1e-7) - 0.58) / 0.4, 0, 1)
    first_angle = clamp((joint_angle(mcp, pip, dip) - 1.72) / 1.18, 0, 1)
    second_angle = clamp((joint_angle(pip, dip, tip) - 1.72) / 1.18, 0, 1)
    if finger_index == 0:
        palm_width = max(distance3d(points[5], points[17]), 1e-7)
        spread = clamp((distance3d(tip, points[5]) / palm_width - 0.52) / 0.78, 0, 1)
        return straightness * 0.34 + first_angle * 0.2 + second_angle * 0.18 + spread * 0.28
    base_distance = max(distance3d(wrist, mcp), 1e-7)
    reach = clamp((distance3d(wrist, tip) / base_distance - 1.42) / 1.15, 0, 1)
    return straightness * 0.34 + first_angle * 0.23 + second_angle * 0.23 + reach * 0.2


def fresh_states() -> list[dict[str, Any]]:
    return [
        {"active": False, "high": 0, "low": 0, "weight": 0.0}
        for _ in range(5)
    ]


def update_state(state: dict[str, Any], score: float) -> bool:
    if score >= 0.63:
        state["high"] += 1
        state["low"] = 0
    elif score <= 0.46:
        state["low"] += 1
        state["high"] = 0
    else:
        state["high"] = max(0, state["high"] - 1)
        state["low"] = max(0, state["low"] - 1)
    if not state["active"] and state["high"] >= 2:
        state["active"] = True
    if state["active"] and state["low"] >= 3:
        state["active"] = False
    state["weight"] = clamp(state["weight"] + (0.34 if state["active"] else -0.22), 0, 1)
    return bool(state["active"] and state["weight"] > 0.08)


def smooth(previous: np.ndarray | None, current: np.ndarray, alpha: float = 0.58) -> np.ndarray:
    if previous is None or previous.shape != current.shape:
        return current.copy()
    return previous * (1.0 - alpha) + current * alpha


def find_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def draw_watermark(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    size = max(18, round(min(width, height) * 0.027))
    label = "教链"
    rgba = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
    layer = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = find_font(size)
    box = draw.textbbox((0, 0), label, font=font)
    text_width = box[2] - box[0]
    text_height = box[3] - box[1]
    padding_x = max(10, size // 2)
    padding_y = max(5, size // 4)
    x = width - text_width - padding_x * 2 - max(12, width // 60)
    y = height - text_height - padding_y * 2 - max(12, height // 45)
    draw.rounded_rectangle(
        (x, y, x + text_width + padding_x * 2, y + text_height + padding_y * 2),
        radius=max(8, size // 3),
        fill=(9, 19, 18, 92),
    )
    draw.text(
        (x + padding_x, y + padding_y - box[1]),
        label,
        font=font,
        fill=(255, 255, 255, 205),
    )
    output = Image.alpha_composite(rgba, layer).convert("RGB")
    return cv2.cvtColor(np.asarray(output), cv2.COLOR_RGB2BGR)


def draw_textured_face(
    canvas: np.ndarray,
    texture: np.ndarray,
    polygon: list[tuple[int, int]],
    color: tuple[int, int, int],
    alpha: float,
) -> None:
    if len(polygon) < 3:
        return
    points = np.asarray(polygon, dtype=np.int32)
    mask = np.zeros(canvas.shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [points], 255)
    tinted = cv2.addWeighted(texture, 0.68, np.full_like(texture, color), 0.32, 0)
    blended = cv2.addWeighted(canvas, 1.0 - alpha, tinted, alpha, 0)
    canvas[mask > 0] = blended[mask > 0]


def draw_effect(
    frame: np.ndarray,
    hands: list[np.ndarray],
    active_fingers: list[list[bool]],
) -> tuple[np.ndarray, int]:
    if len(hands) < 2:
        return frame, 0
    height, width = frame.shape[:2]
    left, right = hands[0], hands[1]
    left_active, right_active = active_fingers[0], active_fingers[1]
    paired = [index for index in range(5) if left_active[index] and right_active[index]]
    if not paired:
        return frame, 0

    def pixel(hand: np.ndarray, finger_index: int) -> tuple[int, int]:
        tip = hand[TIP_INDICES[finger_index]]
        return (
            int(clamp(float(tip[0]), 0, 1) * (width - 1)),
            int(clamp(float(tip[1]), 0, 1) * (height - 1)),
        )

    left_points = [pixel(left, index) for index in paired]
    right_points = [pixel(right, index) for index in paired]
    texture = cv2.flip(frame, 1)
    output = frame.copy()
    faces: list[list[tuple[int, int]]] = []

    if len(paired) == 2:
        faces.append([left_points[0], left_points[1], right_points[1], right_points[0]])
    elif len(paired) >= 3:
        # Consecutive quads plus the wraparound face form one closed projected prism.
        for index in range(len(paired)):
            nxt = (index + 1) % len(paired)
            faces.append([
                left_points[index],
                left_points[nxt],
                right_points[nxt],
                right_points[index],
            ])

    for index, face in enumerate(faces):
        draw_textured_face(
            output,
            texture,
            face,
            FACE_COLORS[(paired[index % len(paired)] + index) % len(FACE_COLORS)],
            0.38 if len(paired) >= 3 else 0.44,
        )

    glow = np.zeros_like(output)
    thin = np.zeros_like(output)
    base_width = max(2, round(min(width, height) * 0.003))
    if len(paired) == 1:
        segments = [(left_points[0], right_points[0], paired[0])]
    else:
        segments = []
        for index in range(len(paired)):
            nxt = (index + 1) % len(paired)
            segments.extend([
                (left_points[index], right_points[index], paired[index]),
                (left_points[index], left_points[nxt], paired[index]),
                (right_points[index], right_points[nxt], paired[index]),
            ])
        # Same-finger crossbars make the correspondence explicit inside the solid.
        segments.extend(
            (left_points[index], right_points[index], finger)
            for index, finger in enumerate(paired)
        )

    for start, end, finger in segments:
        color = EDGE_COLORS[finger]
        cv2.line(glow, start, end, color, base_width * 5, cv2.LINE_AA)
        cv2.line(thin, start, end, (245, 255, 255), base_width, cv2.LINE_AA)
    glow = cv2.GaussianBlur(glow, (0, 0), sigmaX=max(4, base_width * 2.5))
    output = cv2.addWeighted(output, 1.0, glow, 0.65, 0)
    output = cv2.addWeighted(output, 1.0, thin, 0.92, 0)

    for index, finger in enumerate(paired):
        color = EDGE_COLORS[finger]
        for point in (left_points[index], right_points[index]):
            cv2.circle(output, point, base_width * 4, color, -1, cv2.LINE_AA)
            cv2.circle(output, point, base_width * 2, (255, 255, 255), -1, cv2.LINE_AA)
    return output, len(paired)


def probe(path: Path) -> dict[str, Any]:
    command = [
        "ffprobe", "-v", "error", "-show_streams", "-show_format",
        "-of", "json", str(path),
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def has_audio(info: dict[str, Any]) -> bool:
    return any(stream.get("codec_type") == "audio" for stream in info.get("streams", []))


def finalize_video(rendered: Path, original: Path, output: Path) -> bool:
    input_info = probe(original)
    input_has_audio = has_audio(input_info)
    command = [
        "ffmpeg", "-y", "-i", str(rendered), "-i", str(original),
        "-map", "0:v:0", "-map", "1:a:0?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "160k", "-shortest", str(output),
    ]
    subprocess.run(command, check=True, capture_output=True)
    output_has_audio = has_audio(probe(output))
    if input_has_audio and not output_has_audio:
        raise RuntimeError("输入视频包含音频，但输出音频写入失败")
    return input_has_audio and output_has_audio


def emit_progress(value: float) -> None:
    print(json.dumps({"progress": round(value, 1)}, ensure_ascii=False), flush=True)


def render(input_path: Path, output_path: Path, result_path: Path) -> None:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("ffmpeg/ffprobe not found")
    capture = cv2.VideoCapture(str(input_path))
    if not capture.isOpened():
        raise RuntimeError("无法打开输入视频")
    capture.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    if not math.isfinite(fps) or fps <= 1:
        fps = 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if width <= 0 or height <= 0:
        raise RuntimeError("无法读取视频尺寸")

    result_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="jiaolian-motion-render-") as directory:
        silent_path = Path(directory) / "rendered.avi"
        writer = cv2.VideoWriter(
            str(silent_path),
            cv2.VideoWriter_fourcc(*"MJPG"),
            fps,
            (width, height),
        )
        if not writer.isOpened():
            raise RuntimeError("无法创建中间视频")

        previous: list[np.ndarray | None] = [None, None]
        states = [fresh_states(), fresh_states()]
        missing = [0, 0]
        analyzed_frames = 0
        hand_frames = 0
        peak_pairs = 0
        pair_counts = [0, 0, 0, 0, 0, 0]

        hands_api = mp.solutions.hands
        with hands_api.Hands(
            static_image_mode=False,
            max_num_hands=2,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as detector:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                analyzed_frames += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                detected = detector.process(rgb)
                candidates: list[np.ndarray] = []
                for hand_landmarks in detected.multi_hand_landmarks or []:
                    points = np.asarray(
                        [(lm.x, lm.y, lm.z) for lm in hand_landmarks.landmark],
                        dtype=np.float32,
                    )
                    candidates.append(points)
                candidates.sort(key=lambda points: float(points[0, 0]))

                hands: list[np.ndarray] = []
                active: list[list[bool]] = []
                if len(candidates) >= 2:
                    hand_frames += 1
                    for slot, current in enumerate(candidates[:2]):
                        smoothed = smooth(previous[slot], current)
                        previous[slot] = smoothed
                        missing[slot] = 0
                        hands.append(smoothed)
                        active.append([
                            update_state(states[slot][finger], extension_score(smoothed, finger))
                            for finger in range(5)
                        ])
                else:
                    for slot in range(2):
                        missing[slot] += 1
                        if missing[slot] >= 3:
                            previous[slot] = None
                            states[slot] = fresh_states()

                rendered, pair_count = draw_effect(frame, hands, active)
                peak_pairs = max(peak_pairs, pair_count)
                pair_counts[pair_count] += 1
                writer.write(draw_watermark(rendered))
                if frame_count > 0 and analyzed_frames % max(1, round(fps / 2)) == 0:
                    emit_progress(10 + min(80, analyzed_frames / frame_count * 80))

        writer.release()
        capture.release()
        if analyzed_frames <= 0:
            raise RuntimeError("视频没有可读取的画面")
        emit_progress(92)
        audio_preserved = finalize_video(silent_path, input_path, output_path)

    result = {
        "effectType": "finger_membrane",
        "effectVersion": "v4",
        "analyzedFrames": analyzed_frames,
        "handFrames": hand_frames,
        "peakPairs": peak_pairs,
        "pairFrameCounts": pair_counts,
        "durationSeconds": analyzed_frames / fps,
        "audioPreserved": audio_preserved,
        "watermark": "教链",
    }
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    emit_progress(95)


def main() -> None:
    parser = argparse.ArgumentParser(description="教链手指光膜服务端渲染器")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--result", required=True)
    args = parser.parse_args()
    render(Path(args.input), Path(args.output), Path(args.result))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"[motion-effects-renderer] {error}", file=sys.stderr)
        raise
