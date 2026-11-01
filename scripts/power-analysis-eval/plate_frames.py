"""Exports de-identified frames for the plate question and writes the model requests.

Follows the 2026-08-09 derived-material rule: faces pixelated (the lifter's from the
pose, anyone else's from the detector), cropped around the person, long side at most
640, no audio. The crop margin is wider than the custom-mode keyframes because a plate
can sit well off the body when the camera stands near the bar end.

usage: python plate_frames.py [--repeats 3]
Writes vlm-eval/plate/frames/<clip>/fNNNNN.jpg, manifest.json and requests.json.
"""
import argparse
import json
import os
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

import clips as cl
import face_privacy as fpv
import keyframes as kf

# Evenly placed but weighted to the start: optical flow only runs forward from the seed.
FRAME_SHARES = (0.0, 0.1, 0.3, 0.55, 0.8)
CROP_MARGIN = 0.35
JPEG_QUALITY = 85
MAX_TOKENS = 200

SYSTEM = "你是健身视频的测量助手，只输出一个 JSON 对象，不输出其他文字。"
PROMPT = (
    "图中的人在做{action}。请框出他正在举的那根杠铃上、离镜头最近的那一片杠铃片（最外侧的大圆盘）。"
    "不要框地上或架子上的片，不要框人的头（头部已打马赛克），不要框灯、镜子里的倒影或其他圆形物体。\n"
    "框要贴紧杠铃片的外缘。坐标归一化到 0 到 1000 的整数，原点在图片左上角，x 向右，y 向下，格式 [x0, y0, x1, y1]。\n"
    '只输出 JSON：{{"found": true 或 false, "box": [x0, y0, x1, y1] 或 null, "confidence": 0 到 1 的小数}}。'
    "看不到杠铃片或不确定时 found 为 false，box 为 null，不要猜。"
)


def person_crop(track: np.ndarray, width: int, height: int) -> Tuple[int, int, int, int]:
    """Person box over the whole clip with a wide margin, so every frame shares one crop."""
    window = track[:, 11:33, :]
    xy = window[..., :2][window[..., 2] >= 0.3]
    xy = xy[np.all(np.isfinite(xy), axis=1)]
    if xy.shape[0] == 0:
        return 0, 0, width, height
    x0, y0 = np.percentile(xy, 1, axis=0)
    x1, y1 = np.percentile(xy, 99, axis=0)
    margin = CROP_MARGIN * max(x1 - x0, y1 - y0)
    return int(max(0, x0 - margin)), int(max(0, y0 - margin)), int(min(width, x1 + margin)), int(min(height, y1 + margin))


def export_clip(clip: cl.Clip, detector: fpv.FaceDetector) -> Dict[str, Any]:
    fps, width, height, track = cl.pose_track(clip)
    total = track.shape[0]
    wanted = sorted({min(total - 1, int(round(share * (total - 1)))) for share in FRAME_SHARES})
    crop = person_crop(track, width, height)
    out_dir = os.path.join(cl.OUT, "plate", "frames", clip.name)
    os.makedirs(out_dir, exist_ok=True)
    frames: List[Dict[str, Any]] = []
    skipped: List[int] = []
    cap = cv2.VideoCapture(clip.path)
    index = 0
    while index <= wanted[-1]:
        ok, frame = cap.read()
        if not ok:
            break
        if index in wanted:
            row = track[index]
            if not np.isfinite(row[0, 0]) or not kf.blur_every_face(frame, row, detector, kf.face_search_region([crop], width, height)):
                skipped.append(index)
            else:
                image, ratio = kf._shrink(frame[crop[1]:crop[3], crop[0]:crop[2]])
                name = f"f{index:05d}.jpg"
                cv2.imwrite(os.path.join(out_dir, name), image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                frames.append({"frame": index, "file": name, "ratio": ratio, "imageSize": [image.shape[1], image.shape[0]]})
        index += 1
    cap.release()
    return {"clip": clip.name, "action": clip.action_zh, "fps": fps, "total": total, "crop": list(crop), "frames": frames, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeats", type=int, default=3)
    args = parser.parse_args()
    detector = fpv.FaceDetector()
    manifests = [export_clip(clip, detector) for clip in cl.barbell_clips()]
    detector.close()
    requests = []
    for manifest in manifests:
        for item in manifest["frames"]:
            image = os.path.join(cl.OUT, "plate", "frames", manifest["clip"], item["file"])
            for repeat in range(args.repeats):
                requests.append(
                    {
                        "id": f"{manifest['clip']}/{item['frame']}/r{repeat}",
                        "images": [image],
                        "system": SYSTEM,
                        "prompt": PROMPT.format(action=manifest["action"]),
                        "maxTokens": MAX_TOKENS,
                    }
                )
    base = os.path.join(cl.OUT, "plate")
    with open(os.path.join(base, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifests, handle, ensure_ascii=False, indent=2)
    with open(os.path.join(base, "requests.json"), "w", encoding="utf-8") as handle:
        json.dump(requests, handle, ensure_ascii=False, indent=2)
    for manifest in manifests:
        print(manifest["clip"], "crop", manifest["crop"], "frames", [item["frame"] for item in manifest["frames"]], "skipped", manifest["skipped"])
    print("requests", len(requests))


if __name__ == "__main__":
    main()
