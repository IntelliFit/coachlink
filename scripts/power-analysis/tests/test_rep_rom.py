"""Tests for the per-rep full/partial grade and for the checks and filter that read it.

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
import plausibility as pl  # noqa: E402
import rep_rom as rr  # noqa: E402
from assessment import build_assessment  # noqa: E402
from movement_rules import RuleContext  # noqa: E402
from synthetic_hang import (  # noqa: E402
    FPS,
    FULL_MUSCLEUP_PEAK,
    FULL_PULLUP_PEAK,
    GRIP_STEP,
    SCALE_M_PER_PX,
    SHORT_PULLUP_PEAK,
    hanging_track,
    rise_profile,
)

MASS_KG = 70.0
HEIGHT_CM = 180.0
FULL = (0.0, FULL_PULLUP_PEAK)
# Stops one elbow-length short of hanging: the rep starts with the arms bent.
BENT_START = (70.0, FULL_PULLUP_PEAK)


def graded(track, mode):
    y = av.moving_average(av.to_optional_list(av.body_anchor_y(track, "shoulder")))
    reps = av.detect_reps(y, FPS, SCALE_M_PER_PX, MASS_KG, mode)
    av.annotate_body_reps(reps, y, FPS, SCALE_M_PER_PX)
    rr.grade_reps_rom(reps, track, FPS, SCALE_M_PER_PX, mode)
    return reps


def check_of(reps, track, mode, code):
    assessment = build_assessment(RuleContext(mode, track, reps, FPS, SCALE_M_PER_PX))
    return next(item for item in assessment["checks"] if item["code"] == code)


class PullUpGradeTest(unittest.TestCase):
    def test_full_set_passes_with_positive_margin(self):
        reps = graded(hanging_track(rise_profile([FULL] * 3)), "pullup")
        self.assertEqual([rep["rom"]["grade"] for rep in reps], ["full"] * 3)
        for rep in reps:
            self.assertGreater(rep["rom"]["clearanceMarginCm"], 0)
            self.assertEqual(rep["rom"]["reasonZh"], "")

    def test_short_top_is_partial_with_negative_margin(self):
        reps = graded(hanging_track(rise_profile([FULL, (0.0, SHORT_PULLUP_PEAK), FULL])), "pullup")
        self.assertEqual([rep["rom"]["grade"] for rep in reps], ["full", "partial", "full"])
        self.assertIn("下巴没有过杠", reps[1]["rom"]["reasonZh"])
        self.assertTrue(reps[1]["rom"]["bottomOk"])
        self.assertFalse(reps[1]["rom"]["topOk"])
        self.assertLess(reps[1]["rom"]["clearanceMarginCm"], 0)

    def test_bent_start_is_partial_at_its_own_bottom(self):
        reps = graded(hanging_track(rise_profile([FULL, FULL, BENT_START, FULL])), "pullup")
        self.assertEqual([rep["rom"]["grade"] for rep in reps], ["full", "full", "partial", "full"])
        self.assertIn("底部手臂没有伸直", reps[2]["rom"]["reasonZh"])
        self.assertTrue(reps[2]["rom"]["topOk"])

    def test_short_at_both_ends_names_both(self):
        reps = graded(hanging_track(rise_profile([FULL, FULL, (40.0, SHORT_PULLUP_PEAK), FULL], up_s=0.6)), "pullup")
        self.assertEqual(reps[2]["rom"]["reasonZh"], "底部手臂没有伸直；下巴没有过杠")

    def test_straight_arm_is_calibrated_on_the_set(self):
        # Arms that never read straighter than about 155 degrees still pass when that is this lifter's best.
        loose = graded(hanging_track(rise_profile([FULL] * 3), hang_dy=214.0), "pullup")
        self.assertEqual([rep["rom"]["grade"] for rep in loose], ["full"] * 3)
        self.assertLess(loose[0]["rom"]["bottomElbowDeg"], 165)

    def test_bottom_reference_uses_the_best_few_reps(self):
        self.assertAlmostEqual(rr.bottom_required_deg([176.0, 170.0, 174.0, 150.0, 172.0, 171.0]), 174.0 - rr.BOTTOM_TOLERANCE_DEG, places=3)
        self.assertEqual(rr.bottom_required_deg([]), rr.BOTTOM_FLOOR_DEG)
        self.assertEqual(rr.bottom_required_deg([None, 140.0]), rr.BOTTOM_FLOOR_DEG)


class UnreadableTest(unittest.TestCase):
    def hide(self, track, indexes, frames):
        hidden = track.copy()
        hidden[np.ix_(frames, indexes, [2])] = 0.1
        return hidden

    def test_unseen_top_counts_as_not_reached_and_says_so(self):
        track = hanging_track(rise_profile([FULL] * 3))
        tops = [rep["topFrame"] for rep in graded(track, "pullup")]
        frames = np.arange(tops[1] - 12, tops[1] + 13)
        reps = graded(self.hide(track, [15, 16], frames), "pullup")
        self.assertEqual(reps[1]["rom"]["grade"], "partial")
        self.assertTrue(reps[1]["rom"]["unreadable"])
        self.assertIsNone(reps[1]["rom"]["clearanceCm"])
        self.assertIn("看不清", reps[1]["rom"]["reasonZh"])
        self.assertEqual(rr.tally_rom(reps)["unreadableReps"], 1)

    def test_check_names_unread_rep_instead_of_guessing(self):
        track = hanging_track(rise_profile([FULL] * 3))
        tops = [rep["topFrame"] for rep in graded(track, "pullup")]
        frames = np.arange(tops[1] - 12, tops[1] + 13)
        hidden = self.hide(track, [15, 16], frames)
        check = check_of(graded(hidden, "pullup"), hidden, "pullup", "pullup.chin_over_bar")
        self.assertEqual(check["status"], "good")
        self.assertIn("第 2 次看不清", check["detailZh"])

    def test_everything_unseen_is_unavailable(self):
        track = hanging_track(rise_profile([FULL] * 3))
        hidden = self.hide(track, [15, 16], np.arange(track.shape[0]))
        reps = graded(hidden, "pullup")
        self.assertEqual({rep["rom"]["grade"] for rep in reps}, {"partial"})
        self.assertEqual(check_of(reps, hidden, "pullup", "pullup.chin_over_bar")["status"], "unavailable")
        self.assertEqual(check_of(reps, hidden, "pullup", "pullup.bottom_extension")["status"], "unavailable")


class EdgeCaseTest(unittest.TestCase):
    def test_no_reps_is_not_an_error(self):
        track = hanging_track(rise_profile([FULL]))
        rr.grade_reps_rom([], track, FPS, SCALE_M_PER_PX, "pullup")
        self.assertEqual(rr.tally_rom([]), {"fullReps": 0, "partialReps": 0, "unreadableReps": 0})

    def test_frames_without_a_person_do_not_break_the_grade(self):
        track = hanging_track(rise_profile([FULL] * 3))
        reps = graded(track, "pullup")
        missing = track.copy()
        missing[reps[1]["topFrame"] - 12:reps[1]["topFrame"] + 13] = np.nan
        rr.grade_reps_rom(reps, missing, FPS, SCALE_M_PER_PX, "pullup")
        self.assertEqual(reps[1]["rom"]["grade"], "partial")
        self.assertTrue(reps[1]["rom"]["unreadable"])
        self.assertEqual(reps[0]["rom"]["grade"], "full")

    def test_hips_out_of_frame_still_grades_from_the_arms(self):
        track = hanging_track(rise_profile([FULL] * 3))
        track[:, [23, 24], 2] = 0.05
        self.assertEqual([rep["rom"]["grade"] for rep in graded(track, "pullup")], ["full"] * 3)


class MergedConclusionsTest(unittest.TestCase):
    """The checks, the partial filter and the grade must never tell two stories."""

    def test_checks_flag_exactly_the_reps_the_grade_fails(self):
        track = hanging_track(rise_profile([FULL, (0.0, SHORT_PULLUP_PEAK), FULL, BENT_START, FULL]))
        reps = graded(track, "pullup")
        short_top = [rep["repIndex"] for rep in reps if not rep["rom"]["topOk"]]
        short_bottom = [rep["repIndex"] for rep in reps if not rep["rom"]["bottomOk"]]
        self.assertTrue(short_top)
        self.assertTrue(short_bottom)
        self.assertEqual(check_of(reps, track, "pullup", "pullup.chin_over_bar")["repIndexes"], short_top)
        self.assertEqual(check_of(reps, track, "pullup", "pullup.bottom_extension")["repIndexes"], short_bottom)

    def test_rep_graded_full_is_never_called_partial_by_the_filter(self):
        rep = lambda start, travel, grade: {
            "repIndex": 0,
            "displacementM": travel,
            "maxVelocityMps": 1.0,
            "ascentTimeS": 0.8,
            "startTimeS": start,
            "startFrame": int(start * 30),
            "endFrame": int((start + 0.8) * 30),
            "rom": {"grade": grade},
        }
        reps = [rep(1, 0.5, "full"), rep(3, 0.52, "full"), rep(5, 0.48, "full"), rep(7, 0.15, "full"), rep(9, 0.15, "partial")]
        kept, excluded = pl.split_reps(reps, "pullup", HEIGHT_CM)
        self.assertEqual(len(kept), 4)
        self.assertEqual([item["reason"] for item in excluded], ["partial_rep"])
        self.assertEqual(excluded[0]["rom"]["grade"], "partial")

    def test_consistency_check_does_not_call_a_full_rep_short(self):
        track = hanging_track(rise_profile([FULL] * 4))
        reps = graded(track, "pullup")
        reps[2]["displacementM"] = 0.5 * float(np.median([rep["displacementM"] for rep in reps]))
        self.assertEqual(check_of(reps, track, "pullup", "pullup.rom_consistency")["status"], "good")
        reps[2]["rom"]["grade"] = "partial"
        self.assertEqual(check_of(reps, track, "pullup", "pullup.rom_consistency")["repIndexes"], [3])


class MuscleUpGradeTest(unittest.TestCase):
    def test_full_muscleup_is_graded_on_support_not_chin(self):
        track = hanging_track(rise_profile([(0.0, FULL_MUSCLEUP_PEAK)] * 3), grip_step=GRIP_STEP)
        reps = graded(track, "muscleup")
        self.assertEqual([rep["rom"]["grade"] for rep in reps], ["full"] * 3)
        self.assertGreater(reps[0]["rom"]["topElbowDeg"], rr.LOCKOUT_DEG)
        self.assertEqual(check_of(reps, track, "muscleup", "muscleup.over_bar")["status"], "good")
        self.assertEqual(check_of(reps, track, "muscleup", "muscleup.lockout")["status"], "good")

    def test_pull_that_stays_under_the_bar_is_partial(self):
        track = hanging_track(rise_profile([(0.0, FULL_MUSCLEUP_PEAK), (0.0, 270.0), (0.0, FULL_MUSCLEUP_PEAK)]), grip_step=GRIP_STEP)
        reps = graded(track, "muscleup")
        self.assertEqual(reps[1]["rom"]["grade"], "partial")
        self.assertIn("没有翻到杠上", reps[1]["rom"]["reasonZh"])
        self.assertEqual(check_of(reps, track, "muscleup", "muscleup.over_bar")["repIndexes"], [2])

    def test_over_the_bar_without_lockout_is_partial(self):
        # Shoulders clear the wrists by more than half a torso but the arms stay bent.
        track = hanging_track(rise_profile([(0.0, FULL_MUSCLEUP_PEAK), (0.0, 370.0), (0.0, FULL_MUSCLEUP_PEAK)]), grip_step=GRIP_STEP)
        reps = graded(track, "muscleup")
        self.assertTrue(reps[1]["rom"]["clearanceOk"])
        self.assertEqual(reps[1]["rom"]["grade"], "partial")
        self.assertIn("顶端手臂没有撑直", reps[1]["rom"]["reasonZh"])


if __name__ == "__main__":
    unittest.main()
