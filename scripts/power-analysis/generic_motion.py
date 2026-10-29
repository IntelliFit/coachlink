"""Generic motion primitives for movements without a dedicated preset (custom mode).

Nothing here knows which exercise is being done. The analyzer follows the body
part that moves the most from rep to rep, splits its trajectory into repeated
cycles, and measures each cycle: range of motion, tempo of the two phases, the
hold at the far end and the angle range of the joint that moves the most. All
series stay NaN where landmarks are missing; only short gaps are bridged.
No power is computed: without knowing the movement, neither the lifted mass nor
the working direction is known.
"""
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

import pose_features as pf

GENERIC_VERSION = "1.0.0"
CANDIDATE_PARTS = ("wrist", "elbow", "shoulder", "hip", "knee", "ankle")
TRUNK_PARTS = ("shoulder", "hip", "head")
PART_LABELS_ZH = {
    "wrist": "手腕",
    "elbow": "肘部",
    "shoulder": "肩部",
    "hip": "髋部",
    "knee": "膝部",
    "ankle": "脚踝",
    "head": "头部",
}
SIDE_LABELS_ZH = {"left": "左", "right": "右", "both": "双侧"}
JOINTS: Dict[str, Tuple[str, str, str]] = {
    "elbow": ("shoulder", "elbow", "wrist"),
    "shoulder": ("hip", "shoulder", "elbow"),
    "hip": ("shoulder", "hip", "knee"),
    "knee": ("hip", "knee", "ankle"),
}
JOINT_LABELS_ZH = {"elbow": "肘关节", "shoulder": "肩关节", "hip": "髋关节", "knee": "膝关节"}
TRUNK = "trunk"
ANGLE_LABELS_ZH = {**JOINT_LABELS_ZH, TRUNK: "躯干倾角"}
AXIS_LABELS_ZH = {"vertical": "上下", "horizontal": "左右", "diagonal": "斜向"}

MIN_COVERAGE = 0.5
VISIBILITY = 0.5
VERTICAL_COS = 0.8
# First pass: small swings still count, to learn the typical rep amplitude.
PROBE_SHARE = 0.12
# A turning point must reverse by this share of the typical rep amplitude.
PROMINENCE_OF_TYPICAL = 0.4
# Frames within this share of a rep's excursion count as "still at that end".
END_ZONE_SHARE = 0.08
# Share of the range near each end used to measure where the movement rests.
DWELL_ZONE_SHARE = 0.2
MIN_REP_S = 0.3
MIN_PHASE_S = 0.1
MAX_REP_S = 20.0
MIN_JOINT_RANGE_DEG = 15.0
# A limb drawn shorter than this share of its usual length points more than ~50 degrees out
# of the image plane (or is mis-detected); its 2D angle at that frame is not reported.
MIN_SEGMENT_SHARE = 0.6
# A joint measurable in fewer of the rep frames than this is mostly out of the image plane
# from this camera position: even the frames that pass are unreliable, so it is not reported.
MIN_ANGLE_COVERAGE = 0.6
# Landmarks hidden behind equipment or the body come back with visibility well under this,
# placed by guesswork; an angle built on them is not reported.
ANGLE_VISIBILITY = 0.75
MIN_PLAUSIBLE_DEG = 20.0
BOTH_SIDES_BONUS = 1.1
SINGLE_REP_FACTOR = 0.6
WHOLE_BODY_SHARE = 0.7
# A rep must move at least this share of the torso length (about 5 cm), or it is jitter.
MIN_EXCURSION_BODY = 0.1
MAX_DURATION_RATIO = 2.5


@dataclass
class MotionSignal:
    """One body part's trajectory projected onto its main direction of travel."""

    part: str
    side: str
    points: np.ndarray
    axis: np.ndarray
    axis_kind: str
    values: np.ndarray
    coverage: float
    rest: str = "min"
    cycles: List[Dict[str, Any]] = field(default_factory=list)
    score: float = 0.0

    @property
    def label_zh(self) -> str:
        part = PART_LABELS_ZH.get(self.part, self.part)
        if self.side in ("left", "right"):
            return f"{SIDE_LABELS_ZH[self.side]}{part}"
        return part


@dataclass
class GenericMotion:
    signal: Optional[MotionSignal]
    rest: str
    reps: List[Dict[str, Any]] = field(default_factory=list)
    phase_labels_zh: Tuple[str, str] = ("去程", "回程")
    main_joint: Optional[str] = None
    joint_side: str = "left"
    joint_series: Optional[np.ndarray] = None
    # Share of rep frames with a reliable angle, per joint and for the trunk.
    angle_coverage: Dict[str, float] = field(default_factory=dict)

    def measurable(self, name: str) -> bool:
        return self.angle_coverage.get(name, 0.0) >= MIN_ANGLE_COVERAGE

    @property
    def unmeasurable_angles(self) -> List[str]:
        """Angles this camera position cannot measure reliably, in a fixed order."""
        return [name for name in (*JOINTS, TRUNK) if not self.measurable(name)]


def part_points(track: np.ndarray, part: str, side: str, min_visibility: float = VISIBILITY) -> np.ndarray:
    if part == "head":
        return pf.points(track, pf.NOSE, min_visibility)
    return pf.side_points(track, side, part, min_visibility)


def _clean_points(raw: np.ndarray, fps: float) -> np.ndarray:
    max_gap = max(1, int(round(fps * 0.3)))
    window = max(1, int(round(fps * 0.1)))
    columns = [pf.smooth(pf.interpolate_gaps(raw[:, axis], max_gap), window) for axis in (0, 1)]
    return np.stack(columns, axis=1)


def _principal_axis(points: np.ndarray) -> Optional[np.ndarray]:
    valid = np.all(np.isfinite(points), axis=1)
    if valid.sum() < 5:
        return None
    centered = points[valid] - points[valid].mean(axis=0)
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    axis = vt[0]
    # Image y grows downward: orient vertical-ish axes so positive means up, others so positive means right.
    if abs(axis[1]) >= VERTICAL_COS or abs(axis[0]) < VERTICAL_COS:
        return -axis if axis[1] > 0 else axis
    return -axis if axis[0] < 0 else axis


def axis_kind(axis: np.ndarray) -> str:
    if abs(axis[1]) >= VERTICAL_COS:
        return "vertical"
    if abs(axis[0]) >= VERTICAL_COS:
        return "horizontal"
    return "diagonal"


def project(points: np.ndarray, axis: np.ndarray, origin: np.ndarray) -> np.ndarray:
    return (points - origin) @ axis


def robust_range(values: np.ndarray) -> float:
    finite = values[np.isfinite(values)]
    if finite.size < 5:
        return 0.0
    return float(np.percentile(finite, 95) - np.percentile(finite, 5))


def find_extremes(values: np.ndarray, threshold: float) -> List[Tuple[int, str]]:
    """Alternating turning points (frame, "max"/"min") that reverse by at least threshold."""
    extremes: List[Tuple[int, str]] = []
    valid = np.flatnonzero(np.isfinite(values))
    if valid.size == 0:
        return extremes
    low = high = int(valid[0])
    direction: Optional[str] = None
    for index in valid[1:]:
        value = values[index]
        if direction is None:
            if value < values[low]:
                low = index
            if value > values[high]:
                high = index
            if value - values[low] > threshold:
                extremes.append((low, "min"))
                direction, high = "up", index
            elif values[high] - value > threshold:
                extremes.append((high, "max"))
                direction, low = "down", index
        elif direction == "up":
            if value > values[high]:
                high = index
            elif values[high] - value > threshold:
                extremes.append((high, "max"))
                direction, low = "down", index
        else:
            if value < values[low]:
                low = index
            elif value - values[low] > threshold:
                extremes.append((low, "min"))
                direction, high = "up", index
    if direction == "up":
        extremes.append((high, "max"))
    elif direction == "down":
        extremes.append((low, "min"))
    return extremes


def rep_threshold(values: np.ndarray) -> float:
    """Reversal size that separates reps from jitter, learned from the clip's own swings.

    A one-off setup move (walking in, jumping to the bar) can dwarf the reps, so the
    threshold follows the typical swing rather than the clip's total range.
    """
    spread = robust_range(values)
    if spread <= 0:
        return 0.0
    probe = PROBE_SHARE * spread
    extremes = find_extremes(values, probe)
    swings = [abs(values[b] - values[a]) for (a, _), (b, _) in zip(extremes, extremes[1:])]
    if len(swings) < 2:
        return PROMINENCE_OF_TYPICAL * spread
    if len(swings) >= 4:
        # The first and last swings are getting into and out of position.
        swings = swings[1:-1]
    typical = float(np.percentile(swings, 75))
    return max(probe, PROMINENCE_OF_TYPICAL * typical)


def _dwell_frames(values: np.ndarray, frame: int, tolerance: float) -> int:
    """Frames around a turning point that stay within tolerance of it."""
    target = values[frame]
    before = _edge_of_zone(values, frame, target, tolerance, -1, 0)
    after = _edge_of_zone(values, frame, target, tolerance, 1, values.size - 1)
    return after - before + 1


def rest_kind(values: np.ndarray, extremes: List[Tuple[int, str]], fps: float) -> str:
    """The end the movement waits at between reps: the kind of turning point it lingers at.

    The first and last turning points are left out: before and after the set people walk in,
    set up or step off, which says nothing about where the reps rest.
    """
    finite = np.flatnonzero(np.isfinite(values))
    if finite.size == 0:
        return "min"
    inner = extremes[1:-1]
    if len(inner) >= 2:
        swings = [abs(values[b] - values[a]) for (a, _), (b, _) in zip(extremes, extremes[1:])]
        tolerance = END_ZONE_SHARE * 2 * float(np.median(swings))
        dwell = {kind: [_dwell_frames(values, frame, tolerance) for frame, k in inner if k == kind] for kind in ("min", "max")}
        if dwell["min"] and dwell["max"]:
            low, high = float(np.mean(dwell["min"])), float(np.mean(dwell["max"]))
            if abs(high - low) >= max(2.0, 0.15 * max(high, low)):
                return "max" if high > low else "min"
    # Too few turns to judge dwell: the clip's opening sits at the rest end.
    opening = values[finite[: max(3, int(round(fps * 0.5)))]]
    start = float(np.median(opening))
    low, high = np.percentile(values[finite], 5), np.percentile(values[finite], 95)
    return "max" if abs(start - high) < abs(start - low) else "min"


def _edge_of_zone(values: np.ndarray, anchor: int, target: float, tolerance: float, step: int, limit: int) -> int:
    """Walks from anchor while the value stays within tolerance of target."""
    index = anchor
    while 0 <= index + step < values.size and (index + step - limit) * step <= 0:
        value = values[index + step]
        if not math.isfinite(float(value)) or abs(value - target) > tolerance:
            break
        index += step
    return index


def _at_rest(chunk: np.ndarray, level: float, tolerance: float, toward: float) -> np.ndarray:
    """At or beyond the rest level, away from the far end (toward = +1 when the far end is higher)."""
    with np.errstate(invalid="ignore"):
        return np.isfinite(chunk) & ((chunk - level) * toward <= tolerance)


def _last_near(values: np.ndarray, start: int, end: int, level: float, tolerance: float, toward: float) -> int:
    """Last frame in [start, end) still at rest."""
    near = np.flatnonzero(_at_rest(values[start:end], level, tolerance, toward))
    return start + int(near[-1]) if near.size else start


def _first_near(values: np.ndarray, start: int, end: int, level: float, tolerance: float, toward: float) -> int:
    """First frame in [start, end] back at rest."""
    near = np.flatnonzero(_at_rest(values[start:end + 1], level, tolerance, toward))
    return start + int(near[0]) if near.size else end


def _consistent(cycles: List[Dict[str, Any]]) -> bool:
    """Reps of one set take similar time; one rep several times longer is setup, not a rep."""
    durations = [cycle["endFrame"] - cycle["startFrame"] for cycle in cycles]
    return len(durations) <= 1 or max(durations) <= MAX_DURATION_RATIO * max(1, min(durations))


def segment_cycles(
    values: np.ndarray, fps: float, rest: Optional[str] = None, min_excursion: float = 0.0
) -> Tuple[str, List[Dict[str, Any]]]:
    """Rest -> far end -> rest cycles with the frames where the motion leaves and reaches each end.

    Without a given rest end both readings are tried. A set starts and ends at rest, so the
    right reading has one rep more than the other; a reading whose rep times disagree wildly
    is folding setup into a rep and loses. Ties fall back to where the movement lingers.
    """
    threshold = max(rep_threshold(values), min_excursion)
    if threshold <= 0:
        return rest or "min", []
    extremes = find_extremes(values, threshold)
    if rest is not None:
        return rest, _cycles_from(values, fps, extremes, rest, min_excursion)
    readings = {kind: _cycles_from(values, fps, extremes, kind, min_excursion) for kind in ("min", "max")}
    ranked = sorted(readings, key=lambda kind: (_consistent(readings[kind]), len(readings[kind])), reverse=True)
    first, second = ranked
    if (_consistent(readings[first]), len(readings[first])) == (_consistent(readings[second]), len(readings[second])):
        first = rest_kind(values, extremes, fps)
    return first, readings[first]


def _cycles_from(
    values: np.ndarray, fps: float, extremes: List[Tuple[int, str]], rest: str, min_excursion: float
) -> List[Dict[str, Any]]:
    far = "min" if rest == "max" else "max"
    # The set's usual rest level, judged inside the set (the clip's first and last turns are setup).
    inner = extremes[1:-1] if len(extremes) > 3 else extremes
    rest_values = [values[frame] for frame, kind in inner if kind == rest]
    typical_rest = float(np.median(rest_values)) if rest_values else 0.0
    cycles: List[Dict[str, Any]] = []
    for (a, kind_a), (b, kind_b), (c, kind_c) in zip(extremes, extremes[1:], extremes[2:]):
        if (kind_a, kind_b, kind_c) != (rest, far, rest):
            continue
        # Measure from whichever neighbour sits at the set's usual rest level, so getting onto
        # the bar before the first rep or stepping off after the last one is not counted.
        level = values[a] if abs(values[a] - typical_rest) <= abs(values[c] - typical_rest) else values[c]
        excursion = abs(values[b] - level)
        tolerance = END_ZONE_SHARE * max(excursion, 1e-6)
        toward = 1.0 if rest == "min" else -1.0
        leave = _last_near(values, a, b, level, tolerance, toward)
        arrive_far = _edge_of_zone(values, b, values[b], tolerance, -1, leave)
        leave_far = _edge_of_zone(values, b, values[b], tolerance, 1, c)
        arrive = _first_near(values, leave_far, c, level, tolerance, toward)
        duration = (arrive - leave) / fps
        too_quick = min(arrive_far - leave, arrive - leave_far) < MIN_PHASE_S * fps
        if not MIN_REP_S <= duration <= MAX_REP_S or excursion < min_excursion or too_quick:
            continue
        cycles.append(
            {
                "startFrame": int(leave),
                "farStartFrame": int(arrive_far),
                "peakFrame": int(b),
                "farEndFrame": int(leave_far),
                "endFrame": int(arrive),
                "excursionPx": float(excursion),
                "returnPx": float(abs(values[b] - values[c])),
            }
        )
    return cycles


def candidate_signal(track: np.ndarray, part: str, side: str, fps: float, body_px: float) -> Optional[MotionSignal]:
    raw = part_points(track, part, side)
    coverage = float(np.mean(np.all(np.isfinite(raw), axis=1))) if raw.size else 0.0
    if coverage < MIN_COVERAGE:
        return None
    points = _clean_points(raw, fps)
    axis = _principal_axis(points)
    if axis is None:
        return None
    values = project(points, axis, np.nanmean(points, axis=0))
    if robust_range(values) <= 0:
        return None
    rest, cycles = segment_cycles(values, fps, min_excursion=MIN_EXCURSION_BODY * body_px)
    return MotionSignal(part, side, points, axis, axis_kind(axis), values, coverage, rest, cycles)


def periodic_score(signal: MotionSignal, body_px: float) -> float:
    """Typical rep excursion in body lengths: a part that only moves once (setup) scores low."""
    if not signal.cycles:
        return 0.0
    excursion = float(np.median([cycle["excursionPx"] for cycle in signal.cycles]))
    factor = 1.0 if len(signal.cycles) >= 2 else SINGLE_REP_FACTOR
    bonus = BOTH_SIDES_BONUS if signal.side == "both" else 1.0
    return excursion / max(body_px, 1.0) * signal.coverage * factor * bonus


def body_size_px(track: np.ndarray, frame_height: int) -> float:
    lengths = pf.torso_length(track)
    lengths = lengths[np.isfinite(lengths) & (lengths > 10)]
    return float(np.median(lengths)) if lengths.size else frame_height * 0.25


def choose_primary_signal(track: np.ndarray, fps: float, frame_height: int) -> Optional[MotionSignal]:
    """The part with the largest repeated excursion; the trunk wins when it moves nearly as much."""
    body_px = body_size_px(track, frame_height)
    candidates: List[MotionSignal] = []
    for part, sides in [(part, ("left", "right", "both")) for part in CANDIDATE_PARTS] + [("head", ("both",))]:
        for side in sides:
            signal = candidate_signal(track, part, side, fps, body_px)
            if signal is not None:
                signal.score = periodic_score(signal, body_px)
                candidates.append(signal)
    candidates = [item for item in candidates if item.score > 0]
    if not candidates:
        return None
    best = max(candidates, key=lambda item: item.score)
    # Whole-body movement: follow the trunk, whose path is not inflated by limb swing.
    trunk = [item for item in candidates if item.part in ("shoulder", "hip")]
    best_trunk = max(trunk, key=lambda item: item.score) if trunk else None
    if best_trunk is not None and best_trunk.score >= WHOLE_BODY_SHARE * best.score:
        return best_trunk
    return best


def phase_labels(kind: str, rest: str) -> Tuple[str, str]:
    if kind != "vertical":
        return ("去程", "回程")
    return ("上升", "下降") if rest == "min" else ("下降", "上升")


def _drop_short(values: np.ndarray, length: np.ndarray) -> Optional[np.ndarray]:
    """NaN where the segment is drawn under MIN_SEGMENT_SHARE of its usual (90th percentile) length."""
    finite = length[np.isfinite(length)]
    if finite.size < 5:
        return None
    with np.errstate(invalid="ignore"):
        return np.where(length >= MIN_SEGMENT_SHARE * np.percentile(finite, 90), values, np.nan)


def joint_angle(track: np.ndarray, joint: str, side: str) -> np.ndarray:
    """2D joint angle, NaN where a landmark is hidden (low visibility) or a limb segment is
    foreshortened (pointing at the camera) or mis-detected: drawn well under its usual length."""
    first, middle, last = (pf.side_points(track, side, name, ANGLE_VISIBILITY) for name in JOINTS[joint])
    angle = pf.angle_at(first, middle, last)
    for a, b in ((first, middle), (middle, last)):
        kept = _drop_short(angle, np.linalg.norm(a - b, axis=-1))
        if kept is None:
            return np.full(angle.shape, np.nan)
        angle = kept
    return angle


def trunk_angle(track: np.ndarray) -> np.ndarray:
    """Trunk lean from vertical (both sides averaged), NaN where the torso is foreshortened:
    bending toward or away from the camera hides the lean a 2D view can show."""
    lean = pf.trunk_lean(track, "both")
    kept = _drop_short(lean, pf.torso_length(track))
    return np.full(lean.shape, np.nan) if kept is None else kept


def rep_coverage(series: np.ndarray, cycles: List[Dict[str, Any]]) -> float:
    """Share of the frames inside reps that have a value."""
    chunks = [series[max(0, int(rep["startFrame"])):int(rep["endFrame"]) + 1] for rep in cycles]
    frames = np.concatenate(chunks) if chunks else np.array([])
    return float(np.mean(np.isfinite(frames))) if frames.size else 0.0


def angle_coverage(track: np.ndarray, cycles: List[Dict[str, Any]], side: str) -> Dict[str, float]:
    coverage = {joint: rep_coverage(joint_angle(track, joint, side), cycles) for joint in JOINTS}
    coverage[TRUNK] = rep_coverage(trunk_angle(track), cycles)
    return {name: round(value, 3) for name, value in coverage.items()}


def rep_range(series: np.ndarray, rep: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    """5th-95th percentile inside the rep, so one bad landmark frame cannot set the range."""
    chunk = pf.window_values(series, int(rep["startFrame"]), int(rep["endFrame"]))
    if chunk.size < 5:
        return None
    return float(np.percentile(chunk, 5)), float(np.percentile(chunk, 95))


def choose_main_joint(
    track: np.ndarray, cycles: List[Dict[str, Any]], fps: float, coverage: Optional[Dict[str, float]] = None
) -> Tuple[Optional[str], str, Optional[np.ndarray]]:
    """Joint with the largest median angle range across reps, on the side facing the camera.

    Joints this camera position cannot measure reliably (low coverage) are never chosen.
    """
    side = pf.choose_side(track)
    window = max(1, int(round(fps * 0.08)))
    best: Tuple[float, Optional[str], Optional[np.ndarray]] = (0.0, None, None)
    for joint in JOINTS:
        if coverage is not None and coverage.get(joint, 0.0) < MIN_ANGLE_COVERAGE:
            continue
        series = pf.smooth(joint_angle(track, joint, side), window)
        ranges = [item for item in (rep_range(series, rep) for rep in cycles) if item is not None]
        if not ranges or len(ranges) * 2 < len(cycles):
            continue
        # A typical minimum this small is a flattened 2D projection, not a real joint angle.
        if float(np.median([low for low, _ in ranges])) < MIN_PLAUSIBLE_DEG:
            continue
        span = float(np.median([high - low for low, high in ranges]))
        if span > best[0]:
            best = (span, joint, series)
    if best[0] < MIN_JOINT_RANGE_DEG:
        return None, side, None
    return best[1], side, best[2]


def analyze_generic_motion(track: np.ndarray, fps: float, frame_height: int) -> GenericMotion:
    signal = choose_primary_signal(track, fps, frame_height)
    if signal is None:
        return GenericMotion(signal=None, rest="min")
    coverage = angle_coverage(track, signal.cycles, pf.choose_side(track))
    joint, joint_side, joint_series = choose_main_joint(track, signal.cycles, fps, coverage)
    return GenericMotion(
        signal=signal,
        rest=signal.rest,
        reps=signal.cycles,
        phase_labels_zh=phase_labels(signal.axis_kind, signal.rest),
        main_joint=joint,
        joint_side=joint_side,
        joint_series=joint_series,
        angle_coverage=coverage,
    )


def _round(value: float, digits: int = 3) -> float:
    return round(float(value), digits) if math.isfinite(float(value)) else 0.0


def build_generic_reps(motion: GenericMotion, fps: float, scale: float) -> List[Dict[str, Any]]:
    """Per-rep metrics in the shared rep shape; power fields stay 0 for custom movements."""
    signal = motion.signal
    if signal is None:
        return []
    speed = np.gradient(np.nan_to_num(signal.values)) * fps * scale
    up_first = signal.axis_kind == "vertical" and motion.rest == "min"
    reps: List[Dict[str, Any]] = []
    for index, cycle in enumerate(motion.reps, start=1):
        start, end = cycle["startFrame"], cycle["endFrame"]
        phase1 = (cycle["farStartFrame"] - start) / fps
        phase2 = (end - cycle["farEndFrame"]) / fps
        hold = (cycle["farEndFrame"] - cycle["farStartFrame"]) / fps
        window = np.abs(speed[start:end + 1])
        rep: Dict[str, Any] = {
            "repIndex": index,
            "displacementM": _round(cycle["excursionPx"] * scale),
            # Vertical movements report the rising phase; others the first phase.
            "ascentTimeS": _round(phase1 if up_first or signal.axis_kind != "vertical" else phase2),
            "avgPowerW": 0.0,
            "horsepowerHp": 0.0,
            "maxVelocityMps": _round(float(window.max()) if window.size else 0.0),
            "phase1TimeS": _round(phase1, 2),
            "phase2TimeS": _round(phase2, 2),
            "holdTimeS": _round(hold, 2),
            "startFrame": int(start),
            "endFrame": int(end),
            "peakFrame": int(cycle["peakFrame"]),
            "farStartFrame": int(cycle["farStartFrame"]),
            "farEndFrame": int(cycle["farEndFrame"]),
            "startTimeS": _round(start / fps, 2),
            "endTimeS": _round(end / fps, 2),
        }
        top, bottom = (cycle["peakFrame"], start) if motion.rest == "min" else (start, cycle["peakFrame"])
        rep["topFrame"], rep["bottomFrame"] = int(top), int(bottom)
        if motion.joint_series is not None:
            joint_range = rep_range(motion.joint_series, cycle)
            if joint_range:
                rep["jointMinDeg"], rep["jointMaxDeg"] = _round(joint_range[0], 1), _round(joint_range[1], 1)
        reps.append(rep)
    return reps


def custom_info(motion: GenericMotion, action_name: str) -> Dict[str, Any]:
    signal = motion.signal
    return {
        "version": GENERIC_VERSION,
        "actionNameZh": action_name,
        "primaryPart": signal.part if signal else "",
        "primaryPartZh": signal.label_zh if signal else "",
        "primarySide": signal.side if signal else "",
        "axis": signal.axis_kind if signal else "diagonal",
        "phaseLabelsZh": list(motion.phase_labels_zh),
        "mainJoint": motion.main_joint,
        "mainJointZh": JOINT_LABELS_ZH.get(motion.main_joint or "") if motion.main_joint else None,
        "unmeasurableAngles": motion.unmeasurable_angles if signal else [],
    }
