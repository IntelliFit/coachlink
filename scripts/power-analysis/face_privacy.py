"""Finds and pixelates every face in a keyframe, not only the tracked lifter's.

The pose track covers one person, so bystanders, spotters and mirror reflections
would keep their faces in the keyframes sent to the vision model. This runs the
MediaPipe full-range face detector over the region that gets exported, in
overlapping tiles at a few sizes, because a bystander across the gym is often too
small for one pass over the whole frame.

Privacy wins over picture quality: false faces (a fist on the bar, a plate logo)
are pixelated too, since filtering them could also drop a real face.
"""
from typing import Callable, List, Optional, Tuple

import cv2
import numpy as np

Box = Tuple[int, int, int, int]
Detect = Callable[[np.ndarray], List[Box]]

FACE_MIN_SCORE = 0.5
# Tile sides as shares of the region's short side; the whole region is searched too.
TILE_SHARES = (0.25, 0.4, 0.7)
MIN_TILE_SIDE = 160
# Mirror border around the searched region, as a share of its short side.
EDGE_PAD_SHARE = 0.08
# The detector box spans brows to chin; grow it to cover hair, ears and a turned head.
FACE_PAD = 0.3
FACE_PAD_UP = 0.6
PIXEL_BLOCKS = 6


class FaceDetector:
    """MediaPipe full-range face detector; raises when MediaPipe cannot load it."""

    def __init__(self, min_score: float = FACE_MIN_SCORE):
        import mediapipe as mp

        self._detector = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=min_score)

    def __call__(self, image: np.ndarray) -> List[Box]:
        height, width = image.shape[:2]
        result = self._detector.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        boxes = []
        for detection in result.detections or []:
            box = detection.location_data.relative_bounding_box
            x0, y0 = int(box.xmin * width), int(box.ymin * height)
            boxes.append((x0, y0, x0 + int(box.width * width), y0 + int(box.height * height)))
        return boxes

    def close(self) -> None:
        self._detector.close()


def tile_starts(length: int, side: int) -> List[int]:
    """Tile origins along one axis, half-overlapping, the last one flush with the end."""
    if side >= length:
        return [0]
    starts = list(range(0, length - side, max(1, side // 2)))
    return starts + [length - side]


def find_faces(frame: np.ndarray, detect: Detect, region: Optional[Box] = None) -> List[Box]:
    """Face boxes (frame coordinates, clipped to the region) found at every tile size.

    The region is mirror-padded first: half a face cut off by the edge becomes a
    whole, symmetric face the detector can find.
    """
    x0, y0, x1, y1 = region if region is not None else (0, 0, frame.shape[1], frame.shape[0])
    if x1 - x0 <= 1 or y1 - y0 <= 1:
        return []
    pad = max(1, int(min(x1 - x0, y1 - y0) * EDGE_PAD_SHARE))
    canvas = cv2.copyMakeBorder(frame[y0:y1, x0:x1], pad, pad, pad, pad, cv2.BORDER_REFLECT_101)
    height, width = canvas.shape[:2]
    sides = sorted({max(MIN_TILE_SIDE, int(min(width, height) * share)) for share in TILE_SHARES})
    boxes: List[Box] = []
    for side in sides + [max(width, height)]:
        for ty in tile_starts(height, side):
            for tx in tile_starts(width, side):
                tile = canvas[ty:ty + side, tx:tx + side]
                for a, b, c, d in detect(tile):
                    box = (
                        max(x0, x0 + tx + a - pad),
                        max(y0, y0 + ty + b - pad),
                        min(x1, x0 + tx + c - pad),
                        min(y1, y0 + ty + d - pad),
                    )
                    if box[2] > box[0] and box[3] > box[1]:
                        boxes.append(box)
    return boxes


def head_box(box: Box, shape: Tuple[int, ...]) -> Optional[Box]:
    """The face box grown to the whole head and clipped to the frame."""
    x0, y0, x1, y1 = box
    size = max(x1 - x0, y1 - y0)
    out = (
        max(0, int(x0 - size * FACE_PAD)),
        max(0, int(y0 - size * FACE_PAD_UP)),
        min(shape[1], int(x1 + size * FACE_PAD)),
        min(shape[0], int(y1 + size * FACE_PAD)),
    )
    return out if out[2] > out[0] and out[3] > out[1] else None


def pixelate(frame: np.ndarray, box: Box) -> None:
    """Replaces the box with a coarse mosaic, in place."""
    x0, y0, x1, y1 = box
    roi = frame[y0:y1, x0:x1]
    small = cv2.resize(roi, (PIXEL_BLOCKS, PIXEL_BLOCKS), interpolation=cv2.INTER_AREA)
    frame[y0:y1, x0:x1] = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)


def blur_all_faces(frame: np.ndarray, detect: Detect, region: Optional[Box] = None) -> int:
    """Pixelates every face found in the region; returns how many boxes were covered."""
    count = 0
    for box in find_faces(frame, detect, region):
        head = head_box(box, frame.shape)
        if head is not None:
            pixelate(frame, head)
            count += 1
    return count
