"""Reference numbers for the plate evaluation; rep counts come from the file names.

Bench and squat use the Hough track on the 1080p original, which snaps to the plate on
over 90% of frames. The deadlift has no Hough track, so it uses a hand-started template
match on the plate hub with a hand-measured vertical diameter of 262 px; the match agrees
with hand readings at frames 250, 270, 290 and 313 to within 5 px.

usage: python plate_reference.py   (needs vlm-eval/reference/dl_left_ref.npy)
"""
import json
import os

import numpy as np

import clips as cl
import plate_tracker as pt
from pose_features import smooth

DEADLIFT_RADIUS_PX = 131.0


def deadlift_reference() -> dict:
    clip = next(item for item in cl.barbell_clips(False) if item.name == "deadlift_170kg_1rep")
    fps, _, _, track = cl.pose_track(clip)
    points = np.load(os.path.join(cl.OUT, "reference", "dl_left_ref.npy"))[: track.shape[0], :2]
    window = max(1, int(round(fps * 0.1)) | 1)
    centers = np.stack([smooth(points[:, axis], window) for axis in (0, 1)], axis=1)
    plate = pt.PlateTrack(
        centers=centers,
        raw_centers=points,
        radius_px=DEADLIFT_RADIUS_PX,
        lock_frame=0,
        coverage=1.0,
        scale_m_per_px=(cl.PLATE_DIAMETER_CM / 100.0) / (2 * DEADLIFT_RADIUS_PX),
        radius_spread=0.0,
        body_correlation=1.0,
        confidence="high",
    )
    return {"clip": clip.name, "method": "hand_template", **cl.public_result(cl.measure(clip, lambda *a, **k: (plate, "ok")))}


def main() -> None:
    with open(os.path.join(cl.OUT, "hough", "results.json"), encoding="utf-8") as handle:
        hough = {row["clip"]: row for row in json.load(handle)}
    rows = [
        {"clip": name, "method": "hough_on_original", **{k: hough[name][k] for k in ("plateRadiusPx", "repCount", "travelM", "meanVelocityMps")}}
        for name in ("benchpress_110kg_4reps", "squat_140kg_2reps")
    ]
    rows.append(deadlift_reference())
    with open(os.path.join(cl.OUT, "reference", "reference.json"), "w", encoding="utf-8") as handle:
        json.dump(rows, handle, ensure_ascii=False, indent=2)
    for row in rows:
        print(row["clip"], row["method"], "r", row["plateRadiusPx"], "reps", row["repCount"], "travel", row["travelM"], "v", row["meanVelocityMps"])


if __name__ == "__main__":
    main()
