"""Tests for dropping impossible / partial reps and for posture-independent scale.

Run: .venv-power-analysis/Scripts/python.exe -m unittest discover -s scripts/power-analysis/tests
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import analyze_video as av  # noqa: E402
import body_scale as bs  # noqa: E402
import plausibility as pl  # noqa: E402
from mode_presets import SUPPORTED_MODES, is_generic_mode  # noqa: E402
from synthetic_body import standing_track  # noqa: E402

HEIGHT_CM = 180.0
FRAME_HEIGHT = 1000


def rep(start: float, displacement: float, velocity: float) -> dict:
    return {
        "repIndex": 0,
        "displacementM": displacement,
        "maxVelocityMps": velocity,
        "ascentTimeS": 0.8,
        "startTimeS": start,
        "endTimeS": start + 0.8,
        "startFrame": int(start * 30),
        "endFrame": int((start + 0.8) * 30),
    }


def lying(track: np.ndarray) -> np.ndarray:
    """Rotates the body 90 degrees, as in a push-up filmed from the side."""
    rotated = track.copy()
    rotated[:, :, 0], rotated[:, :, 1] = track[:, :, 1], track[:, :, 0]
    return rotated


def tucked(track: np.ndarray) -> np.ndarray:
    """Shins folded back to knee height (common in dips and weighted pull-ups)."""
    result = track.copy()
    for knee, parts in ((25, (27, 29, 31)), (26, (28, 30, 32))):
        for index in parts:
            result[:, index, 0] = track[:, knee, 0] + (track[:, index, 1] - track[:, knee, 1])
            result[:, index, 1] = track[:, knee, 1] + 4
    return result


class LimitsTest(unittest.TestCase):
    def test_every_measured_mode_has_limits(self):
        for mode in SUPPORTED_MODES:
            if is_generic_mode(mode):
                continue
            self.assertIn(mode, pl.LIMITS["modes"], mode)
            self.assertGreater(pl.max_peak_velocity(mode), 0)


class SplitRepsTest(unittest.TestCase):
    def test_tracking_jump_rep_is_dropped_and_reps_renumbered(self):
        reps = [rep(1, 0.52, 1.2), rep(3, 0.50, 1.1), rep(5, 4.85, 43.0), rep(7, 0.49, 1.0)]
        kept, excluded = pl.split_reps(reps, "pullup", HEIGHT_CM)
        self.assertEqual([r["repIndex"] for r in kept], [1, 2, 3])
        self.assertEqual(len(excluded), 1)
        self.assertEqual(excluded[0]["reason"], "displacement_beyond_body")
        self.assertEqual(excluded[0]["startTimeS"], 5)

    def test_velocity_spike_with_normal_travel_is_dropped(self):
        kept, excluded = pl.split_reps([rep(1, 0.5, 1.2), rep(3, 0.55, 9.6)], "pullup", HEIGHT_CM)
        self.assertEqual(len(kept), 1)
        self.assertEqual(excluded[0]["reason"], "velocity_beyond_body")

    def test_fast_but_human_rep_is_kept(self):
        kept, excluded = pl.split_reps([rep(1, 0.6, 2.4), rep(3, 0.62, 2.9)], "pullup", HEIGHT_CM)
        self.assertEqual((len(kept), len(excluded)), (2, 0))

    def test_partial_rep_is_dropped_only_with_enough_reps(self):
        reps = [rep(1, 0.50, 1.0), rep(3, 0.52, 1.0), rep(5, 0.48, 1.0), rep(7, 0.15, 0.5)]
        kept, excluded = pl.split_reps(reps, "pullup", HEIGHT_CM)
        self.assertEqual(len(kept), 3)
        self.assertEqual(excluded[0]["reason"], "partial_rep")
        kept, excluded = pl.split_reps([rep(1, 0.5, 1.0), rep(3, 0.15, 0.5)], "pullup", HEIGHT_CM)
        self.assertEqual((len(kept), len(excluded)), (2, 0))

    def test_muscleup_keeps_its_own_partial_rule(self):
        reps = [rep(1, 1.0, 2.0), rep(3, 1.0, 2.0), rep(5, 1.0, 2.0), rep(7, 0.3, 1.0)]
        kept, _ = pl.split_reps(reps, "muscleup", HEIGHT_CM)
        self.assertEqual(len(kept), 4)

    def test_warnings_name_the_time(self):
        _, excluded = pl.split_reps([rep(1, 0.5, 1.0), rep(12.4, 4.0, 30.0)], "pullup", HEIGHT_CM)
        warnings = pl.exclusion_warnings_zh(excluded)
        self.assertEqual(len(warnings), 1)
        self.assertIn("12.4 秒", warnings[0])


class TimeSeriesTest(unittest.TestCase):
    def test_spike_inside_dropped_rep_is_blanked_and_others_capped(self):
        y = [500.0] * 60
        for i in range(10, 13):
            y[i] = 500.0 - (i - 9) * 400  # huge upward jump inside the dropped rep
        for i in range(40, 42):
            y[i] = 500.0 - (i - 39) * 400  # jump outside any rep: only capped
        excluded = [{"reason": "velocity_beyond_body", "startFrame": 9, "endFrame": 14}]
        points = av.build_time_series(y, [], 30.0, 0.002, 70.0, mode="pullup", excluded=excluded)
        by_time = {round(p["timeS"] * 30): p["velocityMps"] for p in points}
        self.assertEqual(max(by_time[i] for i in range(9, 13)), 0.0)
        self.assertLessEqual(max(p["velocityMps"] for p in points), pl.max_peak_velocity("pullup"))


class BodyScaleTest(unittest.TestCase):
    def setUp(self):
        self.track = standing_track(60)

    def test_upright_body_keeps_height_scale(self):
        scale, source, warnings = av.body_anchor_scale(self.track, "pullup", FRAME_HEIGHT, HEIGHT_CM)
        self.assertEqual(source, "body_height")
        self.assertAlmostEqual(scale, av.height_scale_m_per_px(self.track, FRAME_HEIGHT, HEIGHT_CM), places=9)
        self.assertEqual(warnings, [])

    def test_segment_scale_ignores_posture(self):
        upright = bs.segment_scale_m_per_px(self.track, HEIGHT_CM)
        self.assertAlmostEqual(bs.segment_scale_m_per_px(lying(self.track), HEIGHT_CM), upright, delta=upright * 0.01)

    def test_pushup_lying_uses_limb_segments(self):
        scale, source, _ = av.body_anchor_scale(lying(self.track), "pushup", FRAME_HEIGHT, HEIGHT_CM)
        self.assertEqual(source, "limb_segments")
        self.assertAlmostEqual(scale, bs.segment_scale_m_per_px(self.track, HEIGHT_CM), delta=scale * 0.01)

    def test_tucked_legs_switch_to_segments_with_warning(self):
        body = tucked(self.track)
        squashed = av.height_scale_m_per_px(body, FRAME_HEIGHT, HEIGHT_CM)
        scale, source, warnings = av.body_anchor_scale(body, "dip", FRAME_HEIGHT, HEIGHT_CM)
        self.assertEqual(source, "limb_segments")
        self.assertLess(scale, squashed)
        self.assertEqual(len(warnings), 1)


if __name__ == "__main__":
    unittest.main()
