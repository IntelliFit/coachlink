"""Tests for measuring pull-ups and muscle-ups against the hands on the bar.

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
import bar_reference as br  # noqa: E402
import pose_features as pf  # noqa: E402
from synthetic_body import standing_track  # noqa: E402
from synthetic_hang import (  # noqa: E402
    BAR_Y,
    FPS,
    FULL_MUSCLEUP_PEAK,
    FULL_PULLUP_PEAK,
    GRIP_STEP,
    SCALE_M_PER_PX,
    hanging_track,
    rise_profile,
    sway,
    with_camera_motion,
)

MASS_KG = 70.0
PULLUPS = [(0.0, FULL_PULLUP_PEAK)] * 3
MUSCLEUPS = [(0.0, FULL_MUSCLEUP_PEAK)] * 3


def reps_of(y, mode):
    return av.detect_reps(av.moving_average(av.to_optional_list(y)), FPS, SCALE_M_PER_PX, MASS_KG, mode)


def reference_for(track, mode):
    return br.build_bar_reference(track, FPS, mode)


class FixedCameraTest(unittest.TestCase):
    def test_fixed_camera_keeps_every_frame_of_the_anchor(self):
        track = hanging_track(rise_profile(PULLUPS))
        reference = reference_for(track, "pullup")
        self.assertFalse(reference.camera_moved)
        anchor = av.body_anchor_y(track, "shoulder")
        np.testing.assert_array_equal(br.reference_anchor(anchor, reference), anchor)

    def test_hand_reference_off_leaves_the_track_alone_and_still_reports(self):
        track = with_camera_motion(hanging_track(rise_profile(PULLUPS)), sway(rise_profile(PULLUPS).size, 40))
        measured = av.measure_body_anchor(track, "pullup", 1200, 180.0, FPS, hand_reference=False)
        expected = av.moving_average(av.to_optional_list(av.body_anchor_y(track, "shoulder")))
        self.assertEqual(measured.y_track, expected)
        self.assertFalse(measured.measurement["barReference"]["applied"])
        self.assertTrue(measured.measurement["barReference"]["cameraMoved"])
        self.assertEqual(measured.measurement["warningsZh"], [])

    def test_other_modes_have_no_bar_reference(self):
        track = hanging_track(rise_profile(PULLUPS))
        measured = av.measure_body_anchor(track, "dip", 1200, 180.0, FPS, hand_reference=True)
        self.assertNotIn("barReference", measured.measurement)


class MovingCameraTest(unittest.TestCase):
    def test_sway_is_subtracted_and_reported(self):
        rise = rise_profile(PULLUPS)
        steady = hanging_track(rise)
        shaken = with_camera_motion(steady, sway(rise.size, 40))
        reference = reference_for(shaken, "pullup")
        self.assertTrue(reference.camera_moved)
        corrected = br.reference_anchor(av.body_anchor_y(shaken, "shoulder"), reference)
        error = corrected - av.body_anchor_y(steady, "shoulder")
        self.assertLess(np.nanpercentile(np.abs(error - np.nanmedian(error)), 95), 6.0)

    def test_heavy_sway_stops_inventing_reps(self):
        rise = rise_profile(PULLUPS)
        steady = hanging_track(rise)
        shaken = with_camera_motion(steady, sway(rise.size, 90, 0.6))
        reference = reference_for(shaken, "pullup")
        anchor = av.body_anchor_y(shaken, "shoulder")
        self.assertEqual(len(reps_of(br.reference_anchor(anchor, reference), "pullup")), 3)
        truth = reps_of(av.body_anchor_y(steady, "shoulder"), "pullup")
        corrected = reps_of(br.reference_anchor(anchor, reference), "pullup")
        for fixed, moving in zip(truth, corrected):
            self.assertAlmostEqual(moving["displacementM"], fixed["displacementM"], delta=fixed["displacementM"] * 0.08)

    def test_correction_applies_by_default(self):
        rise = rise_profile(PULLUPS)
        steady = hanging_track(rise)
        shaken = with_camera_motion(steady, sway(rise.size, 40))
        measured = av.measure_body_anchor(shaken, "pullup", 1200, 180.0, FPS)
        self.assertTrue(measured.measurement["barReference"]["applied"])
        self.assertTrue(measured.measurement["barReference"]["cameraMoved"])

    def test_default_leaves_a_fixed_camera_track_untouched(self):
        track = hanging_track(rise_profile(PULLUPS))
        measured = av.measure_body_anchor(track, "pullup", 1200, 180.0, FPS)
        self.assertEqual(measured.y_track, av.moving_average(av.to_optional_list(av.body_anchor_y(track, "shoulder"))))
        self.assertEqual(measured.measurement["warningsZh"], [])

    def test_warning_names_the_correction(self):
        rise = rise_profile(PULLUPS)
        shaken = with_camera_motion(hanging_track(rise), sway(rise.size, 40))
        measured = av.measure_body_anchor(shaken, "pullup", 1200, 180.0, FPS, hand_reference=True)
        self.assertTrue(measured.measurement["barReference"]["applied"])
        self.assertTrue(any("晃动" in text for text in measured.measurement["warningsZh"]))


class OffBarTest(unittest.TestCase):
    def dismount(self, track):
        """The last second: hands drop to the hips and the lifter bounces back up, as stepping away."""
        result = track.copy()
        frames = int(FPS)
        for frame in range(track.shape[0] - frames, track.shape[0]):
            result[frame, [15, 16], 1] = result[frame, [23, 24], 1]
        return result, frames

    def test_frames_after_letting_go_are_dropped(self):
        rise = np.concatenate([rise_profile(PULLUPS), np.zeros(int(FPS))])
        track, frames = self.dismount(hanging_track(rise))
        reference = reference_for(track, "pullup")
        self.assertFalse(np.any(reference.on_bar[-frames:]))
        self.assertTrue(np.all(reference.on_bar[: -frames - int(FPS * br.OFF_BAR_PAD_SECONDS) - 1]))

    def test_jumping_while_hands_are_off_the_bar_is_not_a_rep(self):
        rise = np.concatenate([rise_profile(PULLUPS), np.zeros(int(FPS))])
        track, frames = self.dismount(hanging_track(rise))
        bounce = np.zeros(track.shape[0])
        bounce[-frames:] = -300 * np.sin(np.linspace(0, np.pi, frames))
        jumping = with_camera_motion(track, bounce)
        reference = reference_for(jumping, "pullup")
        anchor = av.body_anchor_y(jumping, "shoulder")
        self.assertEqual(len(reps_of(anchor, "pullup")), 4)
        self.assertEqual(len(reps_of(br.reference_anchor(anchor, reference), "pullup")), 3)

    def test_hands_unseen_after_a_dismount_count_as_off_the_bar(self):
        rise = np.concatenate([rise_profile(PULLUPS), np.zeros(int(FPS * 2))])
        track = hanging_track(rise)
        hidden_from = track.shape[0] - int(FPS * 2)
        track[hidden_from:, [15, 16], 2] = 0.1
        reference = reference_for(track, "pullup")
        self.assertFalse(np.any(reference.on_bar[-int(FPS):]))

    def test_a_short_wrist_dropout_stays_on_the_bar(self):
        track = hanging_track(rise_profile(PULLUPS))
        track[40:46, [15, 16], 2] = 0.1
        self.assertTrue(np.all(reference_for(track, "pullup").on_bar))

    def test_no_reference_when_hands_never_reach_overhead(self):
        self.assertIsNone(reference_for(standing_track(60), "pullup"))


class MissingDataTest(unittest.TestCase):
    def test_frames_without_a_person_stay_nan_and_do_not_break_it(self):
        track = hanging_track(rise_profile(PULLUPS))
        track[50:70] = np.nan
        reference = reference_for(track, "pullup")
        corrected = br.reference_anchor(av.body_anchor_y(track, "shoulder"), reference)
        self.assertTrue(np.all(np.isnan(corrected[50:70])))
        self.assertTrue(np.isfinite(corrected[80]))

    def test_hips_out_of_frame_fall_back_to_the_arms_as_a_ruler(self):
        track = hanging_track(rise_profile(PULLUPS))
        full_ruler = br.torso_ruler_px(track)
        track[:, [23, 24], 2] = 0.05
        self.assertAlmostEqual(br.torso_ruler_px(track), full_ruler, delta=full_ruler * 0.25)
        self.assertIsNotNone(reference_for(track, "pullup"))

    def test_no_ruler_at_all_gives_no_reference(self):
        track = hanging_track(rise_profile(PULLUPS))
        track[:, [15, 16, 23, 24], 2] = 0.05
        self.assertIsNone(br.torso_ruler_px(track))
        self.assertIsNone(reference_for(track, "pullup"))

    def test_clip_shorter_than_the_padding_gives_no_reference(self):
        track = hanging_track(rise_profile(PULLUPS))[:2]
        self.assertIsNone(br.build_bar_reference(track, 2.0, "pullup"))

    def test_analyzer_reports_the_grip_rise_as_a_positive_number(self):
        track = hanging_track(rise_profile(MUSCLEUPS), grip_step=GRIP_STEP)
        info = av.measure_body_anchor(track, "muscleup", 1200, 180.0, FPS, hand_reference=False).measurement["barReference"]
        self.assertGreater(info["gripRiseCm"], 0)


class MuscleUpTest(unittest.TestCase):
    def test_grip_step_is_not_read_as_camera_motion(self):
        track = hanging_track(rise_profile(MUSCLEUPS), grip_step=GRIP_STEP)
        reference = reference_for(track, "muscleup")
        self.assertAlmostEqual(reference.grip_step_px, -GRIP_STEP, delta=2)
        self.assertFalse(reference.camera_moved)

    def test_hands_on_top_of_the_bar_stay_on_the_bar(self):
        track = hanging_track(rise_profile(MUSCLEUPS), grip_step=GRIP_STEP)
        self.assertTrue(np.all(reference_for(track, "muscleup").on_bar))

    def test_raw_wrists_would_cut_the_rep_but_the_step_model_does_not(self):
        rise = rise_profile(MUSCLEUPS)
        steady = hanging_track(rise, grip_step=GRIP_STEP)
        anchor = av.body_anchor_y(steady, "shoulder")
        fixed = reps_of(anchor, "muscleup")
        raw_hands = pf.side_points(steady, "both", "wrist", 0.3)[:, 1]
        naive = reps_of(anchor - (raw_hands - BAR_Y), "muscleup")
        self.assertLess(naive[0]["displacementM"], fixed[0]["displacementM"] - GRIP_STEP * SCALE_M_PER_PX * 0.8)

        shaken = with_camera_motion(steady, sway(rise.size, 40))
        reference = reference_for(shaken, "muscleup")
        self.assertTrue(reference.camera_moved)
        corrected = reps_of(br.reference_anchor(av.body_anchor_y(shaken, "shoulder"), reference), "muscleup")
        self.assertEqual(len(corrected), len(fixed))
        for rep, truth in zip(corrected, fixed):
            self.assertAlmostEqual(rep["displacementM"], truth["displacementM"], delta=truth["displacementM"] * 0.08)


if __name__ == "__main__":
    unittest.main()
