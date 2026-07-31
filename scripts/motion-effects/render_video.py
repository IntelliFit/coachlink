#!/usr/bin/env python3
"""Render the 教链 finger-membrane effect onto a video.

Only hand landmarks are used. Matching fingertips are paired by finger name.
Collapsed/occluded fingers stay out of the topology through hysteresis.
"""

from __future__ import annotations

import argparse
import colorsys
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
BASE_HUES = (174.0, 214.0, 267.0, 329.0, 39.0)
PALM_CENTER_INDICES = (0, 5, 9, 13, 17)
REVEAL_DISTANCE_START = 0.14
REVEAL_DISTANCE_END = 0.30
FONT_CANDIDATES = (
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
)
PRESET_PATH = Path(__file__).resolve().parents[2] / "config" / "motion-effects-presets.json"
CURRENT_STYLE: dict[str, Any] = {
    "key": "aurora",
    "name": "极光流体",
    "hues": list(BASE_HUES),
    "hueSpeed": 28.0,
    "saturation": 94.0,
    "faceAlpha": 0.25,
    "textureAlpha": 0.46,
    "sweepSpeed": 0.38,
    "edgeGlow": 1.0,
    "motionSpeed": "balanced",
    "glowStrength": "balanced",
    "surfaceDensity": "balanced",
}


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def load_style(
    style_key: str,
    motion_speed: str,
    glow_strength: str,
    surface_density: str,
) -> dict[str, Any]:
    payload = json.loads(PRESET_PATH.read_text(encoding="utf-8"))
    styles = payload.get("styles") or []
    preset = next((item for item in styles if item.get("key") == style_key), None)
    if preset is None:
        preset = next((item for item in styles if item.get("key") == "aurora"), None)
    if preset is None:
        raise RuntimeError("motion effect presets are missing")

    speed_scale = {"gentle": 0.72, "balanced": 1.0, "energetic": 1.35}[motion_speed]
    glow_scale = {"soft": 0.78, "balanced": 1.0, "strong": 1.25}[glow_strength]
    density_scale = {"transparent": 0.76, "balanced": 1.0, "rich": 1.18}[surface_density]
    return {
        **preset,
        "hueSpeed": float(preset["hueSpeed"]) * speed_scale,
        "sweepSpeed": float(preset["sweepSpeed"]) * speed_scale,
        "edgeGlow": float(preset["edgeGlow"]) * glow_scale,
        "faceAlpha": clamp(float(preset["faceAlpha"]) * density_scale, 0.08, 0.48),
        "textureAlpha": clamp(float(preset["textureAlpha"]) * density_scale, 0.16, 0.68),
        "motionSpeed": motion_speed,
        "glowStrength": glow_strength,
        "surfaceDensity": surface_density,
    }


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


def update_state(state: dict[str, Any], score: float) -> float:
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
    return float(state["weight"]) if state["weight"] > 0.08 else 0.0


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


def smoothstep(start: float, end: float, value: float) -> float:
    progress = clamp((value - start) / max(1e-7, end - start), 0.0, 1.0)
    return progress * progress * (3.0 - 2.0 * progress)


def segment_intersection(
    first_start: tuple[int, int],
    first_end: tuple[int, int],
    second_start: tuple[int, int],
    second_end: tuple[int, int],
) -> tuple[int, int] | None:
    first = np.asarray(first_start, dtype=np.float32)
    first_vector = np.asarray(first_end, dtype=np.float32) - first
    second = np.asarray(second_start, dtype=np.float32)
    second_vector = np.asarray(second_end, dtype=np.float32) - second

    def cross2d(a: np.ndarray, b: np.ndarray) -> float:
        return float(a[0] * b[1] - a[1] * b[0])

    denominator = cross2d(first_vector, second_vector)
    if abs(denominator) < 1e-5:
        return None
    delta = second - first
    first_amount = cross2d(delta, second_vector) / denominator
    second_amount = cross2d(delta, first_vector) / denominator
    margin = 0.025
    if not (
        margin < first_amount < 1.0 - margin
        and margin < second_amount < 1.0 - margin
    ):
        return None
    point = first + first_vector * first_amount
    return int(round(float(point[0]))), int(round(float(point[1])))


def build_side_triangles(
    left_first: tuple[int, int],
    right_first: tuple[int, int],
    left_second: tuple[int, int],
    right_second: tuple[int, int],
) -> list[list[tuple[int, int]]]:
    intersection = segment_intersection(
        left_first,
        right_first,
        left_second,
        right_second,
    )
    if intersection is not None:
        return [
            [left_first, left_second, intersection],
            [right_first, right_second, intersection],
        ]
    return [
        [left_first, right_first, right_second],
        [left_first, right_second, left_second],
    ]


def animated_color(finger_index: int, timestamp: float, offset: float = 0.0) -> tuple[int, int, int]:
    hues = CURRENT_STYLE["hues"]
    hue = (
        (float(hues[finger_index]) + timestamp * float(CURRENT_STYLE["hueSpeed"]) + offset)
        % 360.0
    ) / 360.0
    saturation = clamp(float(CURRENT_STYLE["saturation"]) / 100.0, 0.0, 1.0)
    red, green, blue = colorsys.hsv_to_rgb(hue, saturation, 1.0)
    return int(round(blue * 255)), int(round(green * 255)), int(round(red * 255))


def palm_separation_alpha(hands: list[np.ndarray], width: int, height: int) -> float:
    centers = []
    for hand in hands[:2]:
        normalized_center = np.mean(hand[list(PALM_CENTER_INDICES), :2], axis=0)
        centers.append(
            np.asarray(
                [normalized_center[0] * width, normalized_center[1] * height],
                dtype=np.float32,
            )
        )
    normalized_distance = float(np.linalg.norm(centers[0] - centers[1])) / math.hypot(
        width,
        height,
    )
    return smoothstep(
        REVEAL_DISTANCE_START,
        REVEAL_DISTANCE_END,
        normalized_distance,
    )


def lerp_pixel(
    start: tuple[int, int],
    end: tuple[int, int],
    amount: float,
) -> tuple[int, int]:
    return (
        int(round(start[0] + (end[0] - start[0]) * amount)),
        int(round(start[1] + (end[1] - start[1]) * amount)),
    )


def draw_textured_triangle(
    canvas: np.ndarray,
    texture: np.ndarray,
    triangle: list[tuple[int, int]],
    color: tuple[int, int, int],
    alpha: float,
) -> None:
    if len(triangle) != 3 or alpha <= 0.0:
        return
    points = np.asarray(triangle, dtype=np.int32)
    mask = np.zeros(canvas.shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [points], 255)
    texture_alpha = float(CURRENT_STYLE["textureAlpha"])
    tinted = cv2.addWeighted(
        texture,
        texture_alpha,
        np.full_like(texture, color),
        1.0 - texture_alpha,
        0,
    )
    blended = cv2.addWeighted(canvas, 1.0 - alpha, tinted, alpha, 0)
    canvas[mask > 0] = blended[mask > 0]


def draw_effect(
    frame: np.ndarray,
    hands: list[np.ndarray],
    finger_weights: list[list[float]],
    timestamp: float,
) -> tuple[np.ndarray, int]:
    if len(hands) < 2:
        return frame, 0
    height, width = frame.shape[:2]
    left, right = hands[0], hands[1]
    left_weights, right_weights = finger_weights[0], finger_weights[1]
    pair_weights = [min(left_weights[index], right_weights[index]) for index in range(5)]
    paired = [index for index in range(5) if pair_weights[index] > 0.08]
    if not paired:
        return frame, 0
    reveal_alpha = palm_separation_alpha(hands, width, height)
    if reveal_alpha <= 0.01:
        return frame, 0
    overall_alpha = (
        sum(pair_weights[index] for index in paired) / max(1, len(paired))
    ) * reveal_alpha
    stable_pair_count = sum(1 for index in paired if pair_weights[index] >= 0.5)

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
    triangles: list[tuple[list[tuple[int, int]], int, float, float]] = []
    segments: list[tuple[tuple[int, int], tuple[int, int], int, float]] = []

    if len(paired) == 1:
        segments.append((left_points[0], right_points[0], paired[0], 0.0))
    else:
        side_count = 1 if len(paired) == 2 else len(paired)
        for index in range(side_count):
            nxt = (index + 1) % len(paired)
            for triangle_index, triangle in enumerate(
                build_side_triangles(
                    left_points[index],
                    right_points[index],
                    left_points[nxt],
                    right_points[nxt],
                )
            ):
                triangles.append(
                    (
                        triangle,
                        paired[index],
                        triangle_index * 38.0 + index * 17.0,
                        index * 0.19 + triangle_index * 0.31,
                    )
                )
            segments.extend(
                [
                    (
                        left_points[index],
                        left_points[nxt],
                        paired[index],
                        index + 0.25,
                    ),
                    (
                        right_points[index],
                        right_points[nxt],
                        paired[nxt],
                        index + 0.65,
                    ),
                ]
            )

        segments.extend(
            (
                left_points[index],
                right_points[index],
                finger,
                float(index),
            )
            for index, finger in enumerate(paired)
        )

        if len(paired) >= 3:
            for index in range(1, len(paired) - 1):
                triangles.extend(
                    [
                        (
                            [left_points[0], left_points[index], left_points[index + 1]],
                            paired[index],
                            52.0,
                            index * 0.23,
                        ),
                        (
                            [right_points[0], right_points[index + 1], right_points[index]],
                            paired[index],
                            118.0,
                            index * 0.23 + 0.41,
                        ),
                    ]
                )

    sweep_layer = np.zeros_like(output)
    for triangle, finger, offset, phase in triangles:
        draw_textured_triangle(
            output,
            texture,
            triangle,
            animated_color(finger, timestamp, offset),
            float(CURRENT_STYLE["faceAlpha"]) * 1.36 * overall_alpha,
        )
        sweep = (timestamp * float(CURRENT_STYLE["sweepSpeed"]) + phase) % 1.0
        sweep_start = lerp_pixel(triangle[0], triangle[2], sweep)
        sweep_end = lerp_pixel(triangle[1], triangle[2], sweep)
        cv2.line(
            sweep_layer,
            sweep_start,
            sweep_end,
            animated_color(finger, timestamp, offset + 48.0),
            max(2, round(min(width, height) * 0.003)),
            cv2.LINE_AA,
        )
    if triangles:
        sweep_glow = cv2.GaussianBlur(
            sweep_layer,
            (0, 0),
            sigmaX=max(3, min(width, height) * 0.004),
        )
        output = cv2.addWeighted(output, 1.0, sweep_glow, 0.42 * overall_alpha, 0)
        output = cv2.addWeighted(output, 1.0, sweep_layer, 0.58 * overall_alpha, 0)

    glow = np.zeros_like(output)
    thin = np.zeros_like(output)
    moving_nodes = np.zeros_like(output)
    base_width = max(2, round(min(width, height) * 0.003))
    for start, end, finger, phase in segments:
        color = animated_color(finger, timestamp)
        cv2.line(glow, start, end, color, base_width * 5, cv2.LINE_AA)
        cv2.line(thin, start, end, (245, 255, 255), base_width, cv2.LINE_AA)
        traveling = (timestamp * 0.55 + phase * 0.17) % 1.0
        cv2.circle(
            moving_nodes,
            lerp_pixel(start, end, traveling),
            base_width * 2,
            animated_color(finger, timestamp, 54.0),
            -1,
            cv2.LINE_AA,
        )
    glow = cv2.GaussianBlur(glow, (0, 0), sigmaX=max(4, base_width * 2.5))
    moving_glow = cv2.GaussianBlur(
        moving_nodes,
        (0, 0),
        sigmaX=max(4, base_width * 2.0),
    )
    output = cv2.addWeighted(
        output,
        1.0,
        glow,
        0.65 * float(CURRENT_STYLE["edgeGlow"]) * overall_alpha,
        0,
    )
    output = cv2.addWeighted(output, 1.0, thin, 0.92 * overall_alpha, 0)
    output = cv2.addWeighted(output, 1.0, moving_glow, 0.72 * overall_alpha, 0)
    output = cv2.addWeighted(output, 1.0, moving_nodes, 0.9 * overall_alpha, 0)

    for index, finger in enumerate(paired):
        color = animated_color(finger, timestamp)
        for point in (left_points[index], right_points[index]):
            node_layer = output.copy()
            cv2.circle(node_layer, point, base_width * 4, color, -1, cv2.LINE_AA)
            cv2.circle(node_layer, point, base_width * 2, (255, 255, 255), -1, cv2.LINE_AA)
            output = cv2.addWeighted(
                output,
                1.0 - pair_weights[finger] * reveal_alpha,
                node_layer,
                pair_weights[finger] * reveal_alpha,
                0,
            )
    return output, stable_pair_count


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


def render(
    input_path: Path,
    output_path: Path,
    result_path: Path,
    style_key: str,
    motion_speed: str,
    glow_strength: str,
    surface_density: str,
) -> None:
    global CURRENT_STYLE
    CURRENT_STYLE = load_style(style_key, motion_speed, glow_strength, surface_density)
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
                active: list[list[float]] = []
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

                rendered, pair_count = draw_effect(
                    frame,
                    hands,
                    active,
                    analyzed_frames / fps,
                )
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
        "effectVersion": "v5",
        "analyzedFrames": analyzed_frames,
        "handFrames": hand_frames,
        "peakPairs": peak_pairs,
        "pairFrameCounts": pair_counts,
        "durationSeconds": analyzed_frames / fps,
        "audioPreserved": audio_preserved,
        "watermark": "教链",
        "styleKey": CURRENT_STYLE["key"],
        "styleName": CURRENT_STYLE["name"],
        "motionSpeed": CURRENT_STYLE["motionSpeed"],
        "glowStrength": CURRENT_STYLE["glowStrength"],
        "surfaceDensity": CURRENT_STYLE["surfaceDensity"],
    }
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    emit_progress(95)


def main() -> None:
    parser = argparse.ArgumentParser(description="教链手指光膜服务端渲染器")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--result", required=True)
    parser.add_argument(
        "--style",
        choices=["aurora", "cyber", "lava", "candy", "ice", "galaxy", "emerald", "gold"],
        default="aurora",
    )
    parser.add_argument(
        "--motion-speed",
        choices=["gentle", "balanced", "energetic"],
        default="balanced",
    )
    parser.add_argument(
        "--glow-strength",
        choices=["soft", "balanced", "strong"],
        default="balanced",
    )
    parser.add_argument(
        "--surface-density",
        choices=["transparent", "balanced", "rich"],
        default="balanced",
    )
    args = parser.parse_args()
    render(
        Path(args.input),
        Path(args.output),
        Path(args.result),
        args.style,
        args.motion_speed,
        args.glow_strength,
        args.surface_density,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"[motion-effects-renderer] {error}", file=sys.stderr)
        raise
