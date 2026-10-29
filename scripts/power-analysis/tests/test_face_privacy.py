"""Tests that keyframes de-identify every face in view, not only the tracked lifter.

The detector here is a stand-in that finds the synthetic face by its skin colour and,
like a real face detector, misses a face cut off by the image edge. The MediaPipe
detector itself is only smoke-tested: it cannot recognise a drawn face.

Run: .venv-power-analysis/Scripts/python.exe -m unittest discover -s scripts/power-analysis/tests
"""
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import face_privacy as fpv  # noqa: E402
import keyframes as kf  # noqa: E402
from synthetic_body import standing_track  # noqa: E402
from test_generic_motion import FPS, analyze, squat_track  # noqa: E402

WIDTH, HEIGHT = 720, 1080
SKIN_BGR = (90, 150, 215)
FACE_AXES = (22, 30)
# Bystander beside the squatting lifter, inside the rep's crop and clear of the skeleton.
BYSTANDER = (450, 780)


def draw_face(frame, center, axes=FACE_AXES):
    """A skin-coloured oval with black eyes and mouth, so a blurred face loses its black."""
    cx, cy = center
    cv2.ellipse(frame, center, axes, 0, 0, 360, SKIN_BGR, -1)
    for dx in (-axes[0] // 2, axes[0] // 2):
        cv2.circle(frame, (cx + dx, cy - axes[1] // 4), 4, (0, 0, 0), -1)
    cv2.line(frame, (cx - axes[0] // 3, cy + axes[1] // 2), (cx + axes[0] // 3, cy + axes[1] // 2), (0, 0, 0), 3)


def skin_faces(image):
    """Face-shaped skin blobs that lie wholly inside the image."""
    mask = cv2.inRange(image, tuple(c - 25 for c in SKIN_BGR), tuple(c + 25 for c in SKIN_BGR))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        whole = x > 0 and y > 0 and x + w < image.shape[1] and y + h < image.shape[0]
        if whole and w >= 12 and 1.0 <= h / w <= 1.8:
            boxes.append((x, y, x + w, y + h))
    return boxes


def no_faces(_image):
    return []


def dark_pixels(image):
    return int(np.count_nonzero(np.all(image < 40, axis=2)))


class FindFacesTests(unittest.TestCase):
    def test_tiles_cover_the_axis_and_end_flush(self):
        for length, side in ((1080, 270), (1000, 333), (100, 400)):
            starts = fpv.tile_starts(length, side)
            self.assertEqual(starts[0], 0)
            self.assertEqual(min(starts[-1] + side, length), length)
            for a, b in zip(starts, starts[1:]):
                self.assertLessEqual(b - a, side // 2)

    def test_a_second_face_is_found_where_it_is(self):
        frame = np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8)
        draw_face(frame, BYSTANDER)
        boxes = fpv.find_faces(frame, skin_faces)
        self.assertTrue(boxes)
        expected = (BYSTANDER[0] - FACE_AXES[0], BYSTANDER[1] - FACE_AXES[1], BYSTANDER[0] + FACE_AXES[0], BYSTANDER[1] + FACE_AXES[1])
        for box in boxes:
            for got, want in zip(box, expected):
                self.assertLessEqual(abs(got - want), 3)

    def test_search_stays_inside_the_region(self):
        frame = np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8)
        draw_face(frame, BYSTANDER)
        self.assertEqual(fpv.find_faces(frame, skin_faces, (0, 0, WIDTH, 500)), [])
        self.assertTrue(fpv.find_faces(frame, skin_faces, (300, 600, WIDTH, HEIGHT)))

    def test_a_face_cut_by_the_frame_edge_is_found(self):
        frame = np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8)
        draw_face(frame, (WIDTH - 1, 500))
        self.assertEqual(skin_faces(frame), [])
        boxes = fpv.find_faces(frame, skin_faces)
        self.assertTrue(boxes)
        for x0, _, x1, _ in boxes:
            self.assertGreaterEqual(x0, WIDTH - FACE_AXES[0] - 3)
            self.assertEqual(x1, WIDTH)

    def test_head_box_covers_the_face_and_stays_in_frame(self):
        x0, y0, x1, y1 = fpv.head_box((700, 10, 720, 40), (HEIGHT, WIDTH, 3))
        self.assertEqual((x1, y0), (WIDTH, 0))
        self.assertLessEqual(x0, 700)
        self.assertGreaterEqual(y1, 40)


class BlurEveryFaceTests(unittest.TestCase):
    def frame_with_two_people(self):
        frame = np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8)
        draw_face(frame, (360, 225))
        draw_face(frame, BYSTANDER)
        return frame

    def test_lifter_and_bystander_are_both_pixelated(self):
        frame = self.frame_with_two_people()
        row = standing_track(1)[0]
        self.assertTrue(kf.blur_every_face(frame, row, skin_faces, (0, 0, WIDTH, HEIGHT)))
        self.assertEqual(dark_pixels(frame), 0)

    def test_pose_blur_alone_leaves_the_bystander(self):
        frame = self.frame_with_two_people()
        row = standing_track(1)[0]
        self.assertTrue(kf.blur_every_face(frame, row, no_faces, (0, 0, WIDTH, HEIGHT)))
        x, y = BYSTANDER
        self.assertGreater(dark_pixels(frame[y - 40:y + 40, x - 40:x + 40]), 20)
        self.assertEqual(dark_pixels(frame[:400]), 0)

    def test_failed_detection_skips_the_frame(self):
        def broken(_image):
            raise RuntimeError("detector crashed")

        frame = self.frame_with_two_people()
        self.assertFalse(kf.blur_every_face(frame, standing_track(1)[0], broken, (0, 0, WIDTH, HEIGHT)))


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.track = squat_track(reps=3)
        self.video = os.path.join(self.tmp, "clip.mp4")
        writer = cv2.VideoWriter(self.video, cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
        for _ in range(self.track.shape[0]):
            frame = np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8)
            draw_face(frame, BYSTANDER)
            writer.write(frame)
        writer.release()
        self.motion, self.reps, _ = analyze(self.track)
        self.out = os.path.join(self.tmp, "kf")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def export(self, face_detect):
        return kf.export_keyframes(
            self.video, self.track, self.reps, self.out, FPS, self.motion.phase_labels_zh, "vertical", self.motion.rest,
            face_detect=face_detect,
        )

    def keyframe_images(self, manifest):
        return [cv2.imread(os.path.join(self.out, frame["file"])) for frame in manifest["frames"]]

    def test_bystander_face_is_inside_the_crop(self):
        # Guards the next test: without bystander blurring the face reaches the keyframes.
        manifest = self.export(no_faces)
        self.assertTrue(all(dark_pixels(image) > 20 for image in self.keyframe_images(manifest)))

    def test_keyframes_carry_no_visible_face(self):
        manifest = self.export(skin_faces)
        self.assertIsNotNone(manifest)
        self.assertTrue(manifest["faceBlurred"])
        self.assertEqual(len(manifest["frames"]), 12)
        for image in self.keyframe_images(manifest):
            self.assertEqual(dark_pixels(image), 0)

    def test_no_detector_means_no_keyframes(self):
        with mock.patch.object(fpv, "FaceDetector", side_effect=RuntimeError("no model")):
            self.assertIsNone(self.export(None))
        self.assertFalse(os.path.exists(os.path.join(self.out, kf.MANIFEST_NAME)))

    def test_failed_detection_writes_no_manifest(self):
        def broken(_image):
            raise RuntimeError("detector crashed")

        self.assertIsNone(self.export(broken))
        self.assertFalse(os.path.exists(os.path.join(self.out, kf.MANIFEST_NAME)))


class MediaPipeDetectorTests(unittest.TestCase):
    def test_loads_and_finds_nothing_on_a_blank_frame(self):
        detector = fpv.FaceDetector()
        try:
            self.assertEqual(fpv.find_faces(np.full((HEIGHT, WIDTH, 3), 120, dtype=np.uint8), detector), [])
        finally:
            detector.close()


if __name__ == "__main__":
    unittest.main()
