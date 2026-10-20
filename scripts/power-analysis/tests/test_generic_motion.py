"""Tests for the custom-mode generic motion primitives, checks and keyframes.

Run: .venv-power-analysis/Scripts/python.exe -m unittest discover -s scripts/power-analysis/tests
"""
import json
import os
import re
import shutil
import sys
import tempfile
import unittest

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import analyze_video as av  # noqa: E402
import custom_checks as cc  # noqa: E402
import generic_motion as gm  # noqa: E402
import keyframes as kf  # noqa: E402
from mode_presets import SUPPORTED_MODES, get_mode_preset, is_generic_mode  # noqa: E402
from movement_rules import RuleContext  # noqa: E402
from synthetic_body import FRONT_POSE, cycles, move_parts, standing_track  # noqa: E402

FPS = 30.0
# Same pattern the TypeScript manifest parser accepts.
KEYFRAME_FILE = re.compile(r"^rep\d{1,3}_(start|phase1|far|phase2)\.jpg$")


def curl_track(reps=4, view="front", sides=("left", "right"), roms_deg=None, fps=FPS):
    """Forearms rotate about a still elbow, from hanging (0 deg) up to ~140 deg flexion."""
    offsets = cycles(fps, reps, 140.0, roms=roms_deg)
    track = standing_track(offsets.size, view)
    forearm = 100.0
    for side in sides:
        elbow_index = FRONT_POSE["elbow"][0 if side == "left" else 1]
        wrist_index = FRONT_POSE["wrist"][0 if side == "left" else 1]
        theta = np.radians(offsets)
        elbow = track[:, elbow_index, :2]
        track[:, wrist_index, 0] = elbow[:, 0] + np.sin(theta) * forearm * 0.3
        track[:, wrist_index, 1] = elbow[:, 1] + np.cos(theta) * forearm
    return track


def squat_track(reps=3, rom=200.0, roms=None, out_s=1.0, back_s=1.0, view="side"):
    offsets = -cycles(FPS, reps, rom, out_s=out_s, back_s=back_s, roms=roms)
    track = standing_track(offsets.size, view)
    track = move_parts(track, ["shoulder", "elbow", "wrist", "hip", "head"], offsets)
    return move_parts(track, ["knee"], offsets, scale=0.4)


def analyze(track, fps=FPS):
    motion = gm.analyze_generic_motion(track, fps, 1080)
    reps = gm.build_generic_reps(motion, fps, 0.0025)
    ctx = RuleContext("custom", track, reps, fps, 0.0025)
    return motion, reps, ctx


class SegmentationTests(unittest.TestCase):
    def test_extremes_alternate(self):
        values = np.sin(np.linspace(0, 6 * np.pi, 300))
        kinds = [kind for _, kind in gm.find_extremes(values, 0.5)]
        # Clip start and end count as turning points too: min, 3 x (max, min), then the last max.
        self.assertEqual(kinds.count("max"), 4)
        self.assertTrue(all(a != b for a, b in zip(kinds, kinds[1:])))

    def test_counts_reps_from_rest_at_bottom(self):
        values = cycles(FPS, 5, 100.0)
        rest, reps = gm.segment_cycles(values, FPS)
        self.assertEqual(rest, "min")
        self.assertEqual(len(reps), 5)

    def test_rest_at_top_when_movement_waits_there(self):
        values = -cycles(FPS, 4, 100.0, rest_s=1.5, hold_s=0.1)
        rest, reps = gm.segment_cycles(values, FPS)
        self.assertEqual(rest, "max")
        self.assertEqual(len(reps), 4)

    def test_big_setup_move_does_not_hide_reps(self):
        # Standing far below the hang, then jumping up before small reps (pull-up setup).
        setup = np.concatenate([np.full(30, -300.0), np.linspace(-300, 0, 15)])
        values = np.concatenate([setup, cycles(FPS, 3, 120.0), np.linspace(0, -300, 15), np.full(30, -300.0)])
        _, reps = gm.segment_cycles(values, FPS)
        self.assertEqual(len(reps), 3)
        for rep in reps:
            self.assertAlmostEqual(rep["excursionPx"], 120.0, delta=8)

    def test_setup_hold_is_not_a_rep(self):
        # Deadlift: stand, bend and set up for 4 s, lift, put the bar down, stand up.
        def ramp(start, end, seconds=0.8):
            return np.linspace(start, end, int(seconds * FPS))

        values = np.concatenate([
            np.zeros(30), ramp(0, -200), np.full(120, -200.0), ramp(-200, 0, 1.2), np.zeros(10),
            ramp(0, -200), np.full(15, -200.0), ramp(-200, 0), np.zeros(30),
        ])
        rest, reps = gm.segment_cycles(values, FPS)
        self.assertEqual(rest, "min")
        self.assertEqual(len(reps), 1)

    def test_long_pause_at_the_top_still_counts_from_the_bottom(self):
        # Muscle-up: support hold at the top is longer than the hang between reps.
        values = cycles(FPS, 4, 150.0, hold_s=1.0, rest_s=0.2)
        rest, reps = gm.segment_cycles(values, FPS)
        self.assertEqual(rest, "min")
        self.assertEqual(len(reps), 4)

    def test_dismount_is_not_part_of_the_last_rep(self):
        values = np.concatenate([cycles(FPS, 3, 120.0, back_s=1.0, rest_s=0.5), np.linspace(0, -300, 60)])
        _, reps = gm.segment_cycles(values, FPS)
        last = reps[-1]
        self.assertLess((last["endFrame"] - last["farEndFrame"]) / FPS, 1.3)

    def test_phase_times_match_truth(self):
        values = cycles(FPS, 3, 100.0, out_s=0.8, back_s=1.6, hold_s=0.5)
        motion = gm.GenericMotion(signal=None, rest="min")
        _, motion.reps = gm.segment_cycles(values, FPS)
        # Phases are timed between leaving one end and reaching the other (8% zones), so the
        # slow eased start and finish of each move are not counted: about 64% of a cosine move.
        for rep in motion.reps:
            out = (rep["farStartFrame"] - rep["startFrame"]) / FPS
            back = (rep["endFrame"] - rep["farEndFrame"]) / FPS
            self.assertAlmostEqual(out, 0.8 * 0.64, delta=0.12)
            self.assertAlmostEqual(back / out, 2.0, delta=0.35)

    def test_too_short_cycles_are_dropped(self):
        values = cycles(FPS, 4, 100.0, out_s=0.07, back_s=0.07, hold_s=0.0, rest_s=0.5)
        _, reps = gm.segment_cycles(values, FPS)
        self.assertEqual(reps, [])

    def test_phase_labels_follow_direction(self):
        self.assertEqual(gm.phase_labels("vertical", "min"), ("上升", "下降"))
        self.assertEqual(gm.phase_labels("vertical", "max"), ("下降", "上升"))
        self.assertEqual(gm.phase_labels("horizontal", "min"), ("去程", "回程"))


class PrimarySignalTests(unittest.TestCase):
    def test_curl_follows_the_wrist(self):
        motion, reps, _ = analyze(curl_track())
        self.assertEqual(motion.signal.part, "wrist")
        self.assertEqual(len(reps), 4)
        self.assertEqual(motion.main_joint, "elbow")

    def test_whole_body_movement_follows_the_trunk(self):
        motion, reps, _ = analyze(squat_track())
        self.assertIn(motion.signal.part, ("shoulder", "hip"))
        self.assertEqual(motion.signal.axis_kind, "vertical")
        self.assertEqual(motion.rest, "max")
        self.assertEqual(len(reps), 3)
        self.assertEqual(motion.phase_labels_zh, ("下降", "上升"))

    def test_rom_uses_the_scale(self):
        _, reps, _ = analyze(squat_track(rom=200.0))
        for rep in reps:
            self.assertAlmostEqual(rep["displacementM"], 200 * 0.0025, delta=0.03)

    def test_reps_carry_no_power(self):
        _, reps, _ = analyze(squat_track())
        self.assertTrue(all(rep["avgPowerW"] == 0 and rep["horsepowerHp"] == 0 for rep in reps))

    def test_still_person_has_no_reps(self):
        motion, reps, _ = analyze(standing_track(200))
        self.assertEqual(reps, [])

    def test_flattened_joint_projection_is_not_reported(self):
        track = curl_track()
        # Wrist drawn onto the shoulder: a 2D angle near 0 that no elbow can make.
        shoulder = track[:, FRONT_POSE["shoulder"][0], :2]
        elbow = track[:, FRONT_POSE["elbow"][0], :2]
        series = gm.joint_angle(track, "elbow", "left")
        self.assertTrue(np.nanmin(series) > 20)
        track[:, FRONT_POSE["wrist"][0], :2] = elbow + (shoulder - elbow) * 0.9
        flattened = gm.joint_angle(track, "elbow", "left")
        self.assertTrue(np.all(np.isnan(flattened) | (flattened < 10)))


class CustomCheckTests(unittest.TestCase):
    def assessment(self, track):
        motion, reps, ctx = analyze(track)
        return cc.build_custom_assessment(ctx, motion)

    def check(self, assessment, code):
        return next(item for item in assessment["checks"] if item["code"] == code)

    def test_statuses_are_limited(self):
        for track in (curl_track(), squat_track(), curl_track(view="side")):
            statuses = {item["status"] for item in self.assessment(track)["checks"]}
            self.assertTrue(statuses <= {"info", "warn", "unavailable"}, statuses)

    def test_power_is_always_unavailable(self):
        self.assertEqual(self.check(self.assessment(squat_track()), "custom.power")["status"], "unavailable")

    def test_symmetry_needs_front_view(self):
        result = self.assessment(squat_track(view="side"))
        self.assertEqual(self.check(result, "custom.symmetry")["status"], "unavailable")

    def test_one_sided_movement_is_not_compared(self):
        result = self.assessment(curl_track(sides=("right",)))
        symmetry = self.check(result, "custom.symmetry")
        self.assertEqual(symmetry["status"], "info")
        self.assertIn("单侧", symmetry["detailZh"])

    def test_uneven_sides_warn(self):
        offsets = cycles(FPS, 4, 160.0)
        track = standing_track(offsets.size, "front")
        track = move_parts(track, ["wrist"], offsets, sides=("left",))
        track = move_parts(track, ["wrist"], offsets * 0.6, sides=("right",))
        symmetry = self.check(self.assessment(track), "custom.symmetry")
        self.assertEqual(symmetry["status"], "warn")
        self.assertIn("右侧", symmetry["detailZh"])

    def test_short_rep_is_flagged(self):
        rom = self.check(self.assessment(squat_track(roms=[200, 200, 100, 200])), "custom.rom")
        self.assertEqual(rom["status"], "warn")
        self.assertEqual(rom["repIndexes"], [3])

    def test_even_reps_are_info(self):
        self.assertEqual(self.check(self.assessment(squat_track(reps=4)), "custom.rom")["status"], "info")

    def test_slowdown_is_flagged(self):
        fast = -cycles(FPS, 3, 200.0, out_s=0.8, back_s=0.8)
        slow = -cycles(FPS, 2, 200.0, out_s=1.8, back_s=1.8, lead_s=0.0)
        offsets = np.concatenate([fast, slow])
        track = standing_track(offsets.size, "side")
        track = move_parts(track, ["shoulder", "elbow", "wrist", "hip", "head"], offsets)
        tempo = self.check(self.assessment(track), "custom.tempo")
        self.assertEqual(tempo["status"], "warn")
        self.assertIn("变慢", tempo["detailZh"])

    def test_no_reps_gives_no_checks(self):
        self.assertEqual(self.assessment(standing_track(200))["checks"], [])


class KeyframeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="coachlink-keyframes-")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_picks_first_middle_last(self):
        reps = [{"repIndex": index} for index in range(1, 8)]
        self.assertEqual([rep["repIndex"] for rep in kf.pick_reps(reps)], [1, 4, 7])

    def test_face_is_pixelated(self):
        frame = np.random.default_rng(1).integers(0, 255, size=(1080, 720, 3), dtype=np.uint8)
        row = standing_track(1)[0]
        before = frame[200:240, 340:380].copy()
        self.assertTrue(kf.blur_face(frame, row))
        after = frame[200:240, 340:380]
        self.assertLess(len(np.unique(after.reshape(-1, 3), axis=0)), len(np.unique(before.reshape(-1, 3), axis=0)) / 10)

    def test_no_face_position_means_no_frame(self):
        row = np.full((33, 3), np.nan)
        self.assertFalse(kf.blur_face(np.zeros((100, 100, 3), dtype=np.uint8), row))

    def test_export_writes_deidentified_manifest(self):
        track = squat_track(reps=3)
        path = os.path.join(self.tmp, "clip.mp4")
        writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), FPS, (720, 1080))
        for _ in range(track.shape[0]):
            writer.write(np.full((1080, 720, 3), 120, dtype=np.uint8))
        writer.release()
        motion, reps, _ = analyze(track)
        out = os.path.join(self.tmp, "kf")
        manifest = kf.export_keyframes(path, track, reps, out, FPS, motion.phase_labels_zh, "vertical", motion.rest)
        self.assertIsNotNone(manifest)
        self.assertTrue(manifest["faceBlurred"])
        self.assertFalse(manifest["audio"])
        self.assertEqual(len(manifest["frames"]), 12)
        for frame in manifest["frames"]:
            self.assertRegex(frame["file"], KEYFRAME_FILE)
            image = cv2.imread(os.path.join(out, frame["file"]))
            self.assertLessEqual(max(image.shape[:2]), kf.MAX_LONG_SIDE)
        with open(os.path.join(out, kf.MANIFEST_NAME), encoding="utf-8") as handle:
            self.assertEqual(json.load(handle)["frames"], manifest["frames"])


class PresetIsolationTests(unittest.TestCase):
    def test_custom_is_generic_and_presets_are_not(self):
        self.assertIn("custom", SUPPORTED_MODES)
        self.assertTrue(is_generic_mode("custom"))
        self.assertFalse(any(is_generic_mode(mode) for mode in SUPPORTED_MODES if mode != "custom"))
        self.assertEqual(get_mode_preset("unknown")["label"], "Pull-up")

    def test_action_name_is_trimmed(self):
        self.assertEqual(av.action_name_arg("  哑铃   弯举 "), "哑铃 弯举")
        self.assertEqual(av.action_name_arg("   "), "其他动作")
        self.assertEqual(len(av.action_name_arg("长" * 40)), 20)


if __name__ == "__main__":
    unittest.main()
