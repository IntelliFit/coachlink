"""Tests for the measured angles printed on custom-mode keyframes and written to the manifest.

Run: .venv-power-analysis/Scripts/python.exe -m unittest discover -s scripts/power-analysis/tests
"""
import json
import os
import shutil
import sys
import tempfile
import unittest

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import keyframes as kf  # noqa: E402
from synthetic_body import standing_track  # noqa: E402
from test_generic_motion import FPS, analyze, curl_track, squat_track  # noqa: E402


def write_clip(path, frames, size=(720, 1080)):
    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), FPS, size)
    for _ in range(frames):
        writer.write(np.full((size[1], size[0], 3), 120, dtype=np.uint8))
    writer.release()


class AngleSeriesTests(unittest.TestCase):
    def test_series_cover_main_joint_extras_and_trunk(self):
        track = curl_track(reps=3)
        motion, _, _ = analyze(track)
        self.assertEqual(motion.main_joint, "elbow")
        series = kf.angle_series(track, motion, FPS)
        self.assertEqual(list(series)[0], motion.main_joint)
        self.assertTrue(set(kf.EXTRA_JOINTS) <= set(series))
        self.assertIn(kf.TRUNK, series)
        self.assertIs(series[motion.main_joint], motion.joint_series)

    def test_flattened_context_joint_is_withheld(self):
        track = curl_track(reps=3)
        motion, _, _ = analyze(track)
        series = kf.angle_series(track, motion, FPS)
        for joint in kf.EXTRA_JOINTS:
            if joint != motion.main_joint:
                finite = series[joint][np.isfinite(series[joint])]
                self.assertTrue(np.all(finite >= 20.0))

    def test_upright_trunk_reads_near_zero(self):
        track = standing_track(10, "side")
        motion, _, _ = analyze(squat_track(reps=3))
        lean = kf.angle_series(track, motion, FPS)[kf.TRUNK]
        self.assertLess(float(np.nanmax(np.abs(lean))), 5.0)

    def test_frame_angles_skip_missing_joints(self):
        series = {"knee": np.array([90.4, np.nan]), kf.TRUNK: np.array([10.6, 12.0])}
        self.assertEqual(kf.frame_angles(series, 0), {"knee": 90, kf.TRUNK: 11})
        self.assertEqual(kf.frame_angles(series, 1), {kf.TRUNK: 12})
        self.assertEqual(kf.frame_angles(series, 5), {})


class RepCurveTests(unittest.TestCase):
    def test_resamples_to_whole_degrees(self):
        values = np.linspace(170.0, 100.0, 30)
        curve = kf.resample_rep(values, 0, 29)
        self.assertEqual(len(curve), kf.SEQUENCE_POINTS)
        self.assertEqual((curve[0], curve[-1]), (170, 100))
        self.assertTrue(all(isinstance(value, int) for value in curve))

    def test_bridges_short_gaps_and_refuses_sparse_reps(self):
        values = np.linspace(0.0, 70.0, 8)
        values[3] = np.nan
        self.assertEqual(kf.resample_rep(values, 0, 7), [0, 10, 20, 30, 40, 50, 60, 70])
        sparse = np.full(20, np.nan)
        sparse[[0, 19]] = (10.0, 20.0)
        self.assertIsNone(kf.resample_rep(sparse, 0, 19))
        self.assertIsNone(kf.resample_rep(values, 5, 5))

    def test_curves_hold_main_joint_and_trunk_only(self):
        series = {"elbow": np.linspace(160, 90, 40), "knee": np.full(40, 170.0), kf.TRUNK: np.full(40, 8.0)}
        reps = [{"repIndex": 1, "startFrame": 0, "endFrame": 19}, {"repIndex": 2, "startFrame": 20, "endFrame": 39}]
        curves = kf.rep_angle_curves(series, reps, "elbow")
        self.assertEqual([curve["repIndex"] for curve in curves], [1, 2])
        self.assertEqual(set(curves[0]["anglesDeg"]), {"elbow", kf.TRUNK})
        self.assertEqual(kf.rep_angle_curves(series, reps, None)[0]["anglesDeg"], {kf.TRUNK: [8] * kf.SEQUENCE_POINTS})


class LabelDrawingTests(unittest.TestCase):
    def test_labels_are_drawn_beside_the_joint(self):
        row = standing_track(1, "side")[0]
        image = np.full((1080, 720, 3), 120, dtype=np.uint8)
        knee = kf.angle_anchor(row, "knee", "left")
        drawn = kf.draw_angle_labels(image.copy(), row, {"knee": 172}, "left", (0, 0), 1.0, "knee")
        x, y = int(knee[0]), int(knee[1])
        window = (slice(max(0, y - 40), y + 40), slice(max(0, x - 10), x + 160))
        self.assertGreater(int(np.abs(drawn[window].astype(int) - image[window].astype(int)).sum()), 0)
        self.assertTrue(np.array_equal(drawn[:100, :100], image[:100, :100]))

    def test_labels_do_not_overlap(self):
        placed = []
        for _ in range(3):
            x, y = kf.place_label((300, 300), (80, 24), placed, (640, 640))
            box = (x, y, 80, 24)
            self.assertFalse(kf._overlaps(box, placed))
            placed.append(box)

    def test_no_angles_leaves_image_unchanged(self):
        image = np.zeros((50, 50, 3), dtype=np.uint8)
        self.assertIs(kf.draw_angle_labels(image, standing_track(1)[0], {}, "left", (0, 0), 1.0, None), image)


class ManifestAngleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="coachlink-keyframe-angles-")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_manifest_carries_frame_angles_and_rep_curves(self):
        track = curl_track(reps=3)
        path = os.path.join(self.tmp, "clip.mp4")
        write_clip(path, track.shape[0])
        motion, reps, _ = analyze(track)
        out = os.path.join(self.tmp, "kf")
        manifest = kf.export_keyframes(path, track, reps, out, FPS, motion.phase_labels_zh, "vertical", motion.rest, motion)
        self.assertEqual(manifest["version"], kf.MANIFEST_VERSION)
        self.assertEqual(manifest["mainJoint"], motion.main_joint)
        for frame in manifest["frames"]:
            # Mid-phase the synthetic forearm points at the camera, so its angle is withheld there.
            if frame["phase"] in ("start", "far"):
                self.assertIn(motion.main_joint, frame["anglesDeg"])
            self.assertIn(kf.TRUNK, frame["anglesDeg"])
            self.assertTrue(all(isinstance(value, int) and 0 <= value <= 180 for value in frame["anglesDeg"].values()))
        self.assertEqual([curve["repIndex"] for curve in manifest["repAngles"]], [rep["repIndex"] for rep in reps])
        for curve in manifest["repAngles"]:
            self.assertEqual(len(curve["anglesDeg"][motion.main_joint]), kf.SEQUENCE_POINTS)
        with open(os.path.join(out, kf.MANIFEST_NAME), encoding="utf-8") as handle:
            self.assertEqual(json.load(handle), manifest)

    def test_without_motion_the_manifest_has_no_angles(self):
        track = squat_track(reps=3)
        path = os.path.join(self.tmp, "clip.mp4")
        write_clip(path, track.shape[0])
        motion, reps, _ = analyze(track)
        manifest = kf.export_keyframes(path, track, reps, os.path.join(self.tmp, "kf"), FPS, motion.phase_labels_zh, "vertical", motion.rest)
        self.assertTrue(all(frame["anglesDeg"] == {} for frame in manifest["frames"]))
        self.assertEqual(manifest["repAngles"], [])


if __name__ == "__main__":
    unittest.main()
