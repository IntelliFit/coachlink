"""Exports frames for the rounded-back question and writes the model requests.

For each rep: 3 to 5 frames from the bar leaving the floor to the bar passing the knee,
faces pixelated, cropped to the person, long side at most 640, no skeleton (a line drawn
along the back would hide the very thing being judged), no audio. The question asks about
spine shape and states that lean is not rounding, because forward lean is the expected
false alarm.

Clips come from a CSV (see labels.example.csv): file,label,mode,note. label is one of
straight, straight_lean, rounded, or unlabelled. An unlabelled clip only checks the
pipeline and cost; it never counts toward accuracy.

usage: python back_frames.py --labels <csv> [--repeats 3] [--run <name>]
Writes vlm-eval/back/<run>/frames/<clip>/repN_fNNNNN.jpg, manifest.json, requests.json.
"""
import argparse
import csv
import json
import os
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

import clips as cl
import face_privacy as fpv
import keyframes as kf
import pose_features as pf

FRAMES_PER_REP = 5
MIN_FRAMES = 3
MAX_TOKENS = 200
# Without a knee reading, the window ends at this share of the rep's travel.
FALLBACK_TRAVEL_SHARE = 0.5
JPEG_QUALITY = 88

SYSTEM = "你是力量训练动作的观察助手，只输出一个 JSON 对象，不输出其他文字。"
PROMPT = (
    "这些图片是同一个人做{action}时，杠铃从离地到过膝这一段的连续画面，头部已打马赛克。\n"
    "请只判断脊柱的形状，不要判断上身前倾了多少。硬拉起始时上身本来就前倾很多，背部平直地前倾仍然算直背。\n"
    "直背（straight）：从髋到颈基本是一条直线或自然弧度，即使上身接近水平。\n"
    "弓背（rounded）：腰背或上背向外拱起成弧形，骨盆后倾，肩向前卷。\n"
    "下列情况必须回答 can_judge=false，不要猜：不是侧面拍摄（看不到背部的侧面轮廓）；背部被杠铃片、护具、宽松衣服或别的人挡住；画面太暗或太模糊。\n"
    "不要输出任何角度、厘米等数字结论。\n"
    '只输出 JSON：{{"can_judge": true 或 false, "p_straight": 0 到 1, "p_rounded": 0 到 1, "reason": "不超过 20 字"}}。'
    "两个概率之和为 1；can_judge 为 false 时两个概率都填 null。"
)


def pull_window(track: np.ndarray, side: str, start: int, end: int) -> Tuple[int, int]:
    """Frames from the start of the pull to the wrists passing the knees (image y grows downward)."""
    wrist = pf.side_points(track, side, "wrist", 0.1)[:, 1]
    knee = pf.side_points(track, side, "knee", 0.1)[:, 1]
    span = np.arange(start, end + 1)
    finite = np.isfinite(wrist[span]) & np.isfinite(knee[span])
    if finite.any():
        above = span[finite][wrist[span][finite] <= knee[span][finite]]
        if above.size and above[0] > start:
            return start, int(above[0])
    finite_wrist = wrist[span][np.isfinite(wrist[span])]
    if finite_wrist.size:
        target = np.nanmax(wrist[span]) - FALLBACK_TRAVEL_SHARE * (np.nanmax(wrist[span]) - np.nanmin(wrist[span]))
        above = span[np.isfinite(wrist[span]) & (wrist[span] <= target)]
        if above.size and above[0] > start:
            return start, int(above[0])
    return start, start + (end - start) // 2


def pick_frames(start: int, stop: int) -> List[int]:
    count = min(FRAMES_PER_REP, max(MIN_FRAMES, stop - start + 1))
    return sorted({int(round(value)) for value in np.linspace(start, stop, count)})


def reps_of(clip: cl.Clip) -> List[Dict[str, Any]]:
    """Reps from the production analyzer's detection, so the window follows the same rep boundaries."""
    fps, _, height, track = cl.pose_track(clip)
    args = argparse.Namespace(
        input=clip.path,
        mode=clip.mode,
        plate_diameter_cm=cl.PLATE_DIAMETER_CM,
        height_cm=cl.HEIGHT_CM,
        weight_kg=cl.WEIGHT_KG,
        external_load_kg=clip.load_kg,
    )
    measured = cl.av.measure_barbell(args, track, fps, height)
    preset = cl.av.get_mode_preset(clip.mode)
    mass = float(cl.av.build_mass_metrics(cl.WEIGHT_KG, clip.load_kg, float(preset["bodyMassFactor"]), True)["effectiveMassKg"])
    raw = cl.av.detect_reps(measured.y_track, fps, measured.scale, mass, clip.mode, min_displacement=0.05)
    return cl.av.refine_barbell_reps(raw, measured.y_track, measured.timing_y, fps, measured.scale, mass, float(preset["minDisplacement"]))


def export_clip(clip: cl.Clip, label: str, out_root: str, detector: fpv.FaceDetector) -> Dict[str, Any]:
    fps, width, height, track = cl.pose_track(clip)
    side = pf.choose_side(track)
    reps = reps_of(clip)
    plan: Dict[int, List[Dict[str, Any]]] = {}
    for rep in reps:
        stop_frames = pull_window(track, side, int(rep["startFrame"]), int(rep["endFrame"]))
        crop = kf.crop_box(track, int(rep["startFrame"]), int(rep["endFrame"]), width, height)
        for frame in pick_frames(*stop_frames):
            plan.setdefault(frame, []).append({"rep": int(rep["repIndex"]), "crop": crop})
    out_dir = os.path.join(out_root, "frames", clip.name)
    os.makedirs(out_dir, exist_ok=True)
    frames: List[Dict[str, Any]] = []
    skipped: List[int] = []
    cap = cv2.VideoCapture(clip.path)
    index = 0
    last = max(plan) if plan else -1
    while index <= last:
        ok, frame = cap.read()
        if not ok:
            break
        if index in plan and index < track.shape[0]:
            row = track[index]
            crops = [item["crop"] for item in plan[index]]
            if np.isfinite(row[0, 0]) and kf.blur_every_face(frame, row, detector, kf.face_search_region(crops, width, height)):
                for item in plan[index]:
                    x0, y0, x1, y1 = item["crop"]
                    image, _ = kf._shrink(frame[y0:y1, x0:x1])
                    name = f"rep{item['rep']}_f{index:05d}.jpg"
                    cv2.imwrite(os.path.join(out_dir, name), image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                    frames.append({"rep": item["rep"], "frame": index, "file": name})
            else:
                skipped.append(index)
        index += 1
    cap.release()
    return {"clip": clip.name, "label": label, "action": clip.action_zh, "fps": fps, "reps": len(reps), "frames": frames, "skipped": skipped}


def load_clips(path: str) -> List[Tuple[cl.Clip, str]]:
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            mode = row.get("mode") or "deadlift"
            action = {"deadlift": "硬拉", "back_squat": "杠铃深蹲", "bench_press": "卧推"}[mode]
            name = os.path.splitext(os.path.basename(row["file"]))[0]
            rows.append((cl.Clip(name, row["file"], mode, float(row.get("load_kg") or 100), 0, action), row["label"]))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--labels", required=True)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--run", default="smoke")
    args = parser.parse_args()
    out_root = os.path.join(cl.OUT, "back", args.run)
    os.makedirs(out_root, exist_ok=True)
    detector = fpv.FaceDetector()
    manifests = [export_clip(clip, label, out_root, detector) for clip, label in load_clips(args.labels)]
    detector.close()
    requests = []
    for manifest in manifests:
        by_rep: Dict[int, List[Dict[str, Any]]] = {}
        for item in manifest["frames"]:
            by_rep.setdefault(item["rep"], []).append(item)
        for rep, items in by_rep.items():
            for repeat in range(args.repeats):
                requests.append(
                    {
                        "id": f"{manifest['clip']}/rep{rep}/r{repeat}",
                        "images": [os.path.join(out_root, "frames", manifest["clip"], item["file"]) for item in items],
                        "system": SYSTEM,
                        "prompt": PROMPT.format(action=manifest["action"]),
                        "maxTokens": MAX_TOKENS,
                    }
                )
    with open(os.path.join(out_root, "manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifests, handle, ensure_ascii=False, indent=2)
    with open(os.path.join(out_root, "requests.json"), "w", encoding="utf-8") as handle:
        json.dump(requests, handle, ensure_ascii=False, indent=2)
    for manifest in manifests:
        print(manifest["clip"], manifest["label"], "reps", manifest["reps"], "frames", [(item["rep"], item["frame"]) for item in manifest["frames"]], "skipped", manifest["skipped"])
    print("requests", len(requests))


if __name__ == "__main__":
    main()
