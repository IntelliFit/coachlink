"""Meters-per-pixel from limb segment lengths, which do not depend on posture.

Head-to-foot pixel height only works when the body is upright and straight. Lying
down (push-ups) or with the legs tucked, it shrinks and every displacement is
inflated. Shoulder-hip, hip-knee and knee-ankle lengths keep their size in any
posture; together they are about 0.78 of standing height (anthropometric
segment table), which matched the side-view deadlift sample to 0.1%.
"""
from typing import Optional

import numpy as np

import pose_features as pf

SEGMENT_SUM_HEIGHT_RATIO = 0.78
SEGMENTS = (("shoulder", "hip"), ("hip", "knee"), ("knee", "ankle"))
# A high percentile undoes foreshortening when a limb points toward the camera.
SEGMENT_PERCENTILE = 90
MIN_SEGMENT_SAMPLES = 10
MIN_SEGMENT_SUM_PX = 120
# Height scale more than this far above the segment scale means the head-to-foot
# span was squashed (lying, tucked legs, feet out of frame).
HEIGHT_SCALE_TRUST_LIMIT = 1.4


def segment_scale_m_per_px(track: np.ndarray, height_cm: float) -> Optional[float]:
    total = 0.0
    for start, end in SEGMENTS:
        lengths = np.concatenate([pf.segment_length(track, side, start, end) for side in ("left", "right")])
        lengths = lengths[np.isfinite(lengths)]
        if lengths.size < MIN_SEGMENT_SAMPLES:
            return None
        total += float(np.percentile(lengths, SEGMENT_PERCENTILE))
    if total < MIN_SEGMENT_SUM_PX:
        return None
    return (height_cm / 100.0) * SEGMENT_SUM_HEIGHT_RATIO / total


def height_scale_is_squashed(height_scale: Optional[float], segment_scale: Optional[float]) -> bool:
    if height_scale is None or segment_scale is None:
        return False
    return height_scale > segment_scale * HEIGHT_SCALE_TRUST_LIMIT
