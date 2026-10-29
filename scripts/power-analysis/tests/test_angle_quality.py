"""Tests for the custom-mode angle quality gate: per-frame foreshortening and per-joint coverage.

Run: .venv-power-analysis/Scripts/python.exe -m unittest discover -s scripts/power-analysis/tests
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import custom_checks as cc  # noqa: E402
import generic_motion as gm  # noqa: E402
import keyframes as kf  # noqa: E402
from synthetic_body import FRONT_POSE, standing_track  # noqa: E402
from test_generic_motion import FPS, analyze, curl_track  # noqa: E402


def shrink_upper_arm(track, frames, share):
    """Draws the left elbow closer to the shoulder, as when the upper arm points at the camera."""
    shoulder = FRONT_POSE["shoulder"][0]
    elbow = FRONT_POSE["elbow"][0]
    result = track.copy()
    start = result[frames, shoulder, :2]
    result[frames, elbow, :2] = start + (result[frames, elbow, :2] - start) * share
    return result


class ForeshorteningTests(unittest.TestCase):
    def test_segment_at_55_percent_is_not_reported(self):
        track = curl_track()
        frames = np.arange(0, track.shape[0], 10)
        shrunk = shrink_upper_arm(track, frames, 0.55)
        series = gm.joint_angle(shrunk, "elbow", "left")
        self.assertTrue(np.all(np.isnan(series[frames])))
        self.assertTrue(np.isfinite(series[frames[1] + 5]))

    def test_hidden_wrist_is_not_used(self):
        track = curl_track()
        wrist = FRONT_POSE["wrist"][0]
        hidden = track.copy()
        hidden[::4, wrist, 2] = 0.6
        series = gm.joint_angle(hidden, "elbow", "left")
        self.assertTrue(np.all(np.isnan(series[::4])))
        hidden[::4, wrist, 2] = gm.ANGLE_VISIBILITY
        self.assertTrue(np.array_equal(np.isnan(gm.joint_angle(hidden, "elbow", "left")), np.isnan(gm.joint_angle(track, "elbow", "left"))))

    def test_foreshortened_torso_hides_trunk_lean(self):
        track = standing_track(60, "side")
        bent = track.copy()
        for index in (11, 12):
            hip = bent[:20, index + 12, :2]
            bent[:20, index, :2] = hip + (bent[:20, index, :2] - hip) * 0.5
        lean = gm.trunk_angle(bent)
        self.assertTrue(np.all(np.isnan(lean[:20])))
        self.assertTrue(np.all(np.isfinite(lean[20:])))

    def test_rep_coverage_counts_only_rep_frames(self):
        series = np.array([np.nan] * 5 + [1.0, np.nan, 1.0, 1.0] + [np.nan] * 5)
        self.assertAlmostEqual(gm.rep_coverage(series, [{"startFrame": 5, "endFrame": 8}]), 0.75)
        self.assertEqual(gm.rep_coverage(series, []), 0.0)


class CoverageGateTests(unittest.TestCase):
    def mostly_foreshortened_curl(self):
        track = curl_track()
        frames = np.flatnonzero(np.arange(track.shape[0]) % 3 != 0)
        return shrink_upper_arm(track, frames, 0.4)

    def test_measurable_joints_are_reported(self):
        motion, _, _ = analyze(curl_track())
        self.assertEqual(motion.main_joint, "elbow")
        self.assertNotIn("elbow", motion.unmeasurable_angles)
        self.assertGreaterEqual(motion.angle_coverage["elbow"], gm.MIN_ANGLE_COVERAGE)

    def test_mostly_foreshortened_joint_is_never_the_main_joint(self):
        motion, reps, _ = analyze(self.mostly_foreshortened_curl())
        self.assertEqual(len(reps), 4)
        self.assertLess(motion.angle_coverage["elbow"], gm.MIN_ANGLE_COVERAGE)
        self.assertNotEqual(motion.main_joint, "elbow")
        self.assertIn("elbow", motion.unmeasurable_angles)

    def test_unmeasurable_angles_are_named_to_the_user(self):
        motion, _, ctx = analyze(self.mostly_foreshortened_curl())
        info = gm.custom_info(motion, "哑铃弯举")
        self.assertIn("elbow", info["unmeasurableAngles"])
        rom = next(item for item in cc.build_custom_assessment(ctx, motion)["checks"] if item["code"] == "custom.rom")
        self.assertIn("肘关节", rom["detailZh"])
        self.assertIn("测不准", rom["detailZh"])

    def test_unmeasurable_joints_get_no_keyframe_labels(self):
        track = self.mostly_foreshortened_curl()
        motion, _, _ = analyze(track)
        series = kf.angle_series(track, motion, FPS)
        for name in motion.unmeasurable_angles:
            self.assertNotIn(name, series)

    def test_fully_measurable_clip_names_nothing(self):
        motion, _, ctx = analyze(curl_track())
        self.assertEqual(motion.unmeasurable_angles, [])
        rom = next(item for item in cc.build_custom_assessment(ctx, motion)["checks"] if item["code"] == "custom.rom")
        self.assertNotIn("测不准", rom["detailZh"])


if __name__ == "__main__":
    unittest.main()
