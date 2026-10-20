"""Tests for the motion analyzer using synthetic plates and skeletons.

Run: .venv-power-analysis/Scripts/python.exe -m unittest discover -s scripts/power-analysis/tests
"""
import argparse
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import analyze_video as av  # noqa: E402
import barbell_checks as bc  # noqa: E402
from barbell_reps import refine_barbell_reps  # noqa: E402
import movement_checks as mc  # noqa: E402
import pose_features as pf  # noqa: E402
from movement_rules import RuleContext  # noqa: E402
from plate_tracker import track_plate  # noqa: E402
from render_overlay import TAG_HEIGHT, place_tag  # noqa: E402
from synthetic_pose import BACK_SQUAT, DEADLIFT, skeleton_track  # noqa: E402
from synthetic_video import rep_trajectory, write_plate_video  # noqa: E402

FPS = 30.0
PLATE_RADIUS_PX = 70.0
SCALE = 0.45 / (2 * PLATE_RADIUS_PX)


def barbell_reps(mode, ys, scale=SCALE, fps=FPS, noise=0.0, seed=0):
    timing = ys + np.random.default_rng(seed).normal(0, noise, ys.size) if noise else ys.astype(float)
    y_track = av.to_optional_list(pf.smooth(timing, max(1, int(round(fps * 0.12)))))
    raw = av.detect_reps(y_track, fps, scale, 100.0, mode, min_displacement=0.05)
    return refine_barbell_reps(raw, y_track, timing, fps, scale, 100.0, av.get_mode_preset(mode)["minDisplacement"])


class PoseFeatureTests(unittest.TestCase):
    def test_angle_at_right_angle(self):
        angle = pf.angle_at(np.array([[0.0, 0.0]]), np.array([[0.0, 10.0]]), np.array([[10.0, 10.0]]))
        self.assertAlmostEqual(float(angle[0]), 90.0, places=4)

    def test_view_detection(self):
        ys = rep_trajectory(FPS, 1, 610, 212, 1.4)
        side = skeleton_track(ys, DEADLIFT)
        self.assertEqual(pf.detect_view(side), "side")
        front = side.copy()
        front[:, 12, 0] = front[:, 11, 0] + 160
        front[:, 24, 0] = front[:, 23, 0] + 120
        self.assertEqual(pf.detect_view(front), "front")

    def test_missing_landmarks_stay_nan(self):
        track = pf.empty_track(3)
        self.assertTrue(np.all(np.isnan(pf.joint_angle(track, "knee", "left"))))


class BarbellRepTests(unittest.TestCase):
    def test_sticking_point_is_one_rep(self):
        rise = np.linspace(610, 500, 20)
        stall = np.full(14, 500.0)
        finish = np.linspace(500, 400, 18)
        ys = np.concatenate([np.full(30, 610.0), rise, stall, finish, np.full(30, 400.0), np.linspace(400, 610, 30), np.full(20, 610.0)])
        reps = barbell_reps("back_squat", ys)
        self.assertEqual(len(reps), 1)
        self.assertAlmostEqual(reps[0]["displacementM"], 210 * SCALE, delta=0.02)

    def test_mean_velocity_matches_truth(self):
        ys = rep_trajectory(FPS, 3, 610, 212, 1.4)
        reps = barbell_reps("deadlift", ys)
        self.assertEqual(len(reps), 3)
        truth = 212 * SCALE / 1.4
        for rep in reps:
            self.assertAlmostEqual(rep["meanVelocityMps"], truth, delta=truth * 0.08)

    def test_mean_velocity_holds_for_fast_and_slow_reps(self):
        # Tracker-like jitter of 0.8 px; the mean error over three seeds must stay within 6 %.
        for fps in (30.0, 60.0):
            for ascent in (0.4, 0.6, 0.8, 1.4):
                ys = rep_trajectory(fps, 3, 610, 130, ascent, pause_s=0.5)
                truth = 130 * SCALE / ((max(2, int(round(ascent * fps))) - 1) / fps)
                errors = []
                for seed in range(3):
                    reps = barbell_reps("bench_press", ys, fps=fps, noise=0.8, seed=seed)
                    self.assertEqual(len(reps), 3, f"{fps} fps {ascent} s")
                    errors += [(rep["meanVelocityMps"] - truth) / truth for rep in reps]
                self.assertLess(abs(float(np.mean(errors))), 0.06, f"{fps} fps {ascent} s: {np.mean(errors):+.3f}")

    def test_hitch_is_flagged(self):
        up1 = np.linspace(610, 520, 18)
        sink = np.linspace(520, 528, 5)
        up2 = np.linspace(528, 400, 22)
        ys = np.concatenate([np.full(30, 610.0), up1, sink, up2, np.full(20, 400.0), np.linspace(400, 610, 30), np.full(20, 610.0)])
        track = skeleton_track(ys, DEADLIFT)
        reps = barbell_reps("deadlift", ys)
        bar = np.stack([np.full_like(ys, 640.0), ys], axis=1)
        ctx = RuleContext("deadlift", track, reps, FPS, SCALE, bar_points=bar, bar_from_plate=True)
        self.assertEqual(bc.check_deadlift_hitch(ctx)["status"], "warn")

    def test_hitch_without_bar_samples_is_unavailable(self):
        ys = rep_trajectory(FPS, 2, 610, 212, 1.4)
        reps = barbell_reps("deadlift", ys)
        bar = np.stack([np.full_like(ys, 640.0), np.full_like(ys, np.nan)], axis=1)
        ctx = RuleContext("deadlift", skeleton_track(ys, DEADLIFT), reps, FPS, SCALE, bar_points=bar, bar_from_plate=True)
        self.assertEqual(bc.check_deadlift_hitch(ctx)["status"], "unavailable")

    def test_bar_drift_ignores_constant_offset_from_feet(self):
        ys = rep_trajectory(FPS, 2, 610, 212, 1.4)
        reps = barbell_reps("deadlift", ys)
        bar = np.stack([np.full_like(ys, 700.0), ys], axis=1)  # 60 px from mid-foot, perfectly vertical
        ctx = RuleContext("deadlift", skeleton_track(ys, DEADLIFT), reps, FPS, SCALE, bar_points=bar, bar_from_plate=True)
        self.assertEqual(bc.check_bar_path_drift(ctx, 0.05, 0.10)["status"], "good")


class OverlayTests(unittest.TestCase):
    def test_tag_placement_terminates_near_frame_bottom(self):
        placed = [(100, 640, 200, TAG_HEIGHT)]
        y = place_tag(120, 650, 200, placed, 720)
        self.assertGreaterEqual(y, 0)
        self.assertLessEqual(y + TAG_HEIGHT, 720)
        self.assertFalse(y < 640 + TAG_HEIGHT and 640 < y + TAG_HEIGHT)


class PostureRuleTests(unittest.TestCase):
    def squat_context(self, bottom_hip):
        poses = {"bottom": dict(BACK_SQUAT["bottom"], hip=bottom_hip), "top": BACK_SQUAT["top"]}
        ys = rep_trajectory(FPS, 2, 400, 171, 1.2)
        track = skeleton_track(ys, poses)
        bar = np.stack([np.full_like(ys, 600.0), ys], axis=1)
        return RuleContext("back_squat", track, barbell_reps("back_squat", ys), FPS, SCALE, bar_points=bar, bar_from_plate=True)

    def test_squat_depth_good_when_hip_below_knee(self):
        self.assertEqual(mc.check_squat_depth(self.squat_context((540, 550)))["status"], "good")

    def test_squat_depth_near_parallel_is_only_a_warning(self):
        self.assertEqual(mc.check_squat_depth(self.squat_context((540, 480)))["status"], "warn")

    def test_squat_depth_flags_high_bottom(self):
        check = mc.check_squat_depth(self.squat_context((540, 440)))
        self.assertEqual(check["status"], "issue")
        self.assertEqual(check["repIndexes"], [1, 2])
        self.assertEqual(len(check["timesS"]), 2)

    def test_front_view_marks_depth_unavailable(self):
        ctx = self.squat_context((540, 550))
        ctx.view = "front"
        self.assertEqual(mc.check_squat_depth(ctx)["status"], "unavailable")

    def test_spine_is_never_guessed(self):
        ctx = self.squat_context((540, 550))
        self.assertEqual(bc.spine_unavailable(ctx)["status"], "unavailable")


class PlateTrackingTests(unittest.TestCase):
    def setUp(self):
        self.workdir = tempfile.mkdtemp(prefix="motion-analysis-")

    def tearDown(self):
        shutil.rmtree(self.workdir, ignore_errors=True)

    def deadlift_video(self):
        ys = rep_trajectory(FPS, 3, 610, 212, 1.4)
        path = os.path.join(self.workdir, "deadlift.mp4")
        write_plate_video(path, ys, 640.0, PLATE_RADIUS_PX, fps=FPS)
        return ys, path

    def test_tracker_follows_plate_and_scale(self):
        ys, path = self.deadlift_video()
        expected = np.stack([np.full_like(ys, 650.0), ys + 10], axis=1)
        plate, reason = track_plate(path, expected, FPS, 45.0)
        self.assertEqual(reason, "ok")
        self.assertGreater(plate.coverage, 0.9)
        self.assertAlmostEqual(plate.radius_px, PLATE_RADIUS_PX, delta=PLATE_RADIUS_PX * 0.03)
        self.assertLess(float(np.nanmean(np.abs(plate.centers[:, 1] - ys))), 2.0)

    def test_tracker_uses_landmark_frame_count(self):
        ys, path = self.deadlift_video()
        expected = np.stack([np.full_like(ys, 650.0), ys + 10], axis=1)[:-2]  # container reports 2 more frames
        plate, reason = track_plate(path, expected, FPS, 45.0)
        self.assertEqual(reason, "ok")
        self.assertEqual(plate.centers.shape[0], expected.shape[0])
        self.assertEqual(plate.raw_centers.shape[0], expected.shape[0])

    def test_tracker_rejects_circle_far_from_lifter(self):
        ys, path = self.deadlift_video()
        expected = np.stack([np.full_like(ys, 100.0), np.full_like(ys, 100.0)], axis=1)
        plate, reason = track_plate(path, expected, FPS, 45.0)
        self.assertIsNone(plate)
        self.assertIn(reason, ("plate_not_found", "plate_not_following_lifter"))

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg is required")
    def test_deadlift_end_to_end(self):
        ys, path = self.deadlift_video()
        track = skeleton_track(ys, DEADLIFT)
        original = av.collect_landmarks
        av.collect_landmarks = lambda _path: (FPS, 1280, 720, track)
        try:
            args = argparse.Namespace(
                input=path,
                output=os.path.join(self.workdir, "out.mp4"),
                metrics=os.path.join(self.workdir, "metrics.json"),
                mode="deadlift",
                height_cm=175.0,
                weight_kg=80.0,
                external_load_kg=140.0,
                plate_diameter_cm=45.0,
                language="zh",
                quality="compressed",
            )
            metrics = av.run(args)
        finally:
            av.collect_landmarks = original
        self.assertEqual(metrics["repCount"], 3)
        self.assertEqual(metrics["measurement"]["target"], "barbell_plate")
        self.assertEqual(metrics["mass"]["effectiveMassKg"], 140.0)
        self.assertNotIn("rating", metrics)
        codes = {check["code"] for check in metrics["assessment"]["checks"]}
        self.assertIn("deadlift.lockout", codes)
        self.assertIn("deadlift.spine", codes)
        self.assertTrue(os.path.getsize(args.output) > 0)


if __name__ == "__main__":
    unittest.main()
