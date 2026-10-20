"""Movement-specific posture checks built on movement_rules helpers."""
from typing import Any, Dict, List

import numpy as np

import pose_features as pf
from movement_rules import (
    RuleContext,
    angle_detail,
    bottom_frame,
    grade_reps,
    grade_value,
    per_rep_angle,
    rep_list_zh,
    top_frame,
    unavailable,
)

NEED_SIDE_VIEW = "需要侧面或斜侧面机位才能判断"
NEED_FRONT_VIEW = "需要正面机位才能比较左右"
NEED_PLATE = "没有追踪到杠铃片，无法判断杠铃位置"


def _majority_side(sides: List[Any]) -> str:
    """"左" or "右" when one side clearly dominates, "" on a tie."""
    left, right = sides.count("左"), sides.count("右")
    if left == right:
        return ""
    return "左" if left > right else "右"


def _rep_window(ctx: RuleContext, rep: Dict[str, Any]) -> range:
    start = min(bottom_frame(ctx, rep), top_frame(ctx, rep))
    end = max(bottom_frame(ctx, rep), top_frame(ctx, rep))
    return range(max(0, start), end + 1)


def check_bottom_extension(ctx: RuleContext) -> Dict[str, Any]:
    items = per_rep_angle(ctx, ctx.angle("elbow"), bottom_frame, lambda v: v >= 150, lambda v: v >= 135)
    return grade_reps(
        ctx,
        f"{ctx.mode}.bottom_extension",
        "底部手臂伸直",
        items,
        angle_detail("肘角", "每次都从手臂伸直的悬垂开始", "起始时手臂没有完全伸直，动作幅度偏小"),
        {"zh": "手臂未伸直", "en": "Arms bent", "part": "elbow"},
    )


def check_lockout(ctx: RuleContext, joint: str, good: float, warn: float, need_side: bool) -> Dict[str, Any]:
    code = f"{ctx.mode}.lockout"
    title = "顶端锁定" if joint == "hip" else "顶端手臂撑直"
    if need_side and not ctx.is_side_view():
        return unavailable(code, title, NEED_SIDE_VIEW)
    series = ctx.side_angle(joint) if need_side else ctx.angle(joint)
    items = per_rep_angle(ctx, series, top_frame, lambda v: v >= good, lambda v: v >= warn)
    prefix = "髋角" if joint == "hip" else "肘角"
    bad = "顶端髋部没有完全伸展" if joint == "hip" else "顶端手臂没有完全撑直"
    tag = {"zh": "未锁定", "en": "No lockout", "part": joint}
    return grade_reps(ctx, code, title, items, angle_detail(prefix, "每次顶端都完成了锁定", bad), tag)


def check_depth_elbow(ctx: RuleContext, good: float, warn: float) -> Dict[str, Any]:
    code = f"{ctx.mode}.depth"
    if not ctx.is_side_view():
        return unavailable(code, "下放深度", NEED_SIDE_VIEW)
    items = per_rep_angle(ctx, ctx.side_angle("elbow"), bottom_frame, lambda v: v <= good, lambda v: v <= warn)
    return grade_reps(
        ctx,
        code,
        "下放深度",
        items,
        angle_detail("最低点肘角", "每次都下放到位", "下放不够深"),
        {"zh": "幅度不足", "en": "Too shallow", "part": "elbow"},
    )


def check_chin_over_bar(ctx: RuleContext) -> Dict[str, Any]:
    code = "pullup.chin_over_bar"
    mouth = pf.nan_mean_pair(pf.points(ctx.track, 9, 0.3), pf.points(ctx.track, 10, 0.3))[:, 1]
    wrist = pf.side_points(ctx.track, "both", "wrist", 0.3)[:, 1]
    gap_m = (mouth - wrist) * ctx.scale
    radius = max(1, int(round(ctx.fps * 0.1)))
    items = []
    for rep in ctx.reps:
        frame = top_frame(ctx, rep)
        window = pf.window_values(gap_m, frame - radius, frame + radius)
        value = float(np.min(window) * 100) if window.size else None
        items.append({"rep": rep["repIndex"], "frame": frame, "value": value,
                      "grade": grade_value(value, lambda v: v <= 0, lambda v: v <= 4)})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "每次顶端嘴部都高过手腕，下巴基本过杠（以手腕位置近似单杠）"
        gap = float(np.median([item["value"] for item in chosen]))
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次顶端嘴部低于手腕约 {gap:.0f} cm，下巴可能没有过杠"

    return grade_reps(ctx, code, "下巴过杠", items, describe, {"zh": "未过杠", "en": "Chin below bar", "part": "nose"}, "cm")


def check_kipping(ctx: RuleContext, cap_warn: bool) -> Dict[str, Any]:
    code = f"{ctx.mode}.kipping"
    if not ctx.is_side_view():
        return unavailable(code, "身体摆动", NEED_SIDE_VIEW)
    knee = ctx.side_angle("knee")
    hip_x = pf.side_points(ctx.track, ctx.side, "hip")[:, 0]
    torso = float(np.nanmedian(pf.torso_length(ctx.track)))
    items = []
    for rep in ctx.reps:
        frames = range(ctx.frames(rep, "startFrame"), ctx.frames(rep, "endFrame") + 1)
        knees = pf.window_values(knee, frames.start, frames.stop - 1)
        hips = pf.window_values(hip_x, frames.start, frames.stop - 1)
        if knees.size < 3 or hips.size < 3 or not np.isfinite(torso) or torso <= 0:
            items.append({"rep": rep["repIndex"], "frame": frames.start, "value": None, "grade": None})
            continue
        knee_range = float(np.ptp(knees))
        travel = float(np.ptp(hips)) / torso
        grade = "good" if knee_range < 35 and travel < 0.35 else "warn" if knee_range < 60 and travel < 0.6 else "issue"
        if cap_warn and grade == "issue":
            grade = "warn"
        items.append({"rep": rep["repIndex"], "frame": frames.start, "value": knee_range, "grade": grade})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "身体稳定，没有明显借助腿部或髋部摆动"
        note = "，如果目标是严格动作可放慢起始" if ctx.mode == "muscleup" else ""
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次有明显腿部或髋部摆动借力{note}"

    return grade_reps(ctx, code, "身体摆动", items, describe, {"zh": "借力摆动", "en": "Kipping", "part": "hip"})


def check_shoulder_symmetry(ctx: RuleContext) -> Dict[str, Any]:
    code = f"{ctx.mode}.symmetry"
    if ctx.view != "front":
        return unavailable(code, "左右对称", NEED_FRONT_VIEW)
    left = pf.points(ctx.track, 11)
    right = pf.points(ctx.track, 12)
    width = np.linalg.norm(left - right, axis=-1)
    tilt = (left[:, 1] - right[:, 1]) / width
    items = []
    for rep in ctx.reps:
        window = _rep_window(ctx, rep)
        values = tilt[window.start:window.stop]
        finite = np.flatnonzero(np.isfinite(values))
        if finite.size < 3:
            items.append({"rep": rep["repIndex"], "frame": window.start, "value": None, "grade": None})
            continue
        worst = int(finite[np.argmax(np.abs(values[finite]))])
        value = float(values[worst])
        items.append({
            "rep": rep["repIndex"],
            "frame": window.start + worst,
            "value": abs(value) * 100,
            "higher": "左" if value < 0 else "右",
            "grade": grade_value(abs(value), lambda v: v < 0.12, lambda v: v < 0.2),
        })

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "左右肩高度基本一致"
        higher = _majority_side([i.get("higher") for i in chosen])
        diff = float(np.median([i["value"] for i in chosen]))
        side_text = f"{higher}肩" if higher else "一侧肩"
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次{side_text}明显更高，高度差约肩宽的 {diff:.0f}%"

    return grade_reps(ctx, code, "左右对称", items, describe, {"zh": "左右不平衡", "en": "Uneven", "part": "shoulder"}, "%")


def check_body_line(ctx: RuleContext) -> Dict[str, Any]:
    code = "pushup.body_line"
    if not ctx.is_side_view():
        return unavailable(code, "身体成直线", NEED_SIDE_VIEW)
    line_angle = ctx.side_angle("body_line")
    shoulder = pf.side_points(ctx.track, ctx.side, "shoulder")
    hip = pf.side_points(ctx.track, ctx.side, "hip")
    ankle = pf.side_points(ctx.track, ctx.side, "ankle")
    items = per_rep_angle(ctx, line_angle, bottom_frame, lambda v: v >= 165, lambda v: v >= 155)
    for item in items:
        frame = item["frame"]
        s, h, a = shoulder[frame], hip[frame], ankle[frame]
        if np.all(np.isfinite([*s, *h, *a])) and abs(a[0] - s[0]) > 1:
            line_y = s[1] + (a[1] - s[1]) * (h[0] - s[0]) / (a[0] - s[0])
            item["sag"] = bool(h[1] > line_y)

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        median = float(np.median([i["value"] for i in chosen]))
        if status == "good":
            return f"肩、髋、踝基本在一条直线上（约 {median:.0f}°）"
        sag = sum(1 for i in chosen if i.get("sag")) >= len(chosen) / 2
        shape = "塌腰（髋部低于肩踝连线）" if sag else "撅臀（髋部高于肩踝连线）"
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次最低点{shape}，身体角度约 {median:.0f}°"

    return grade_reps(ctx, code, "身体成直线", items, describe, {"zh": "身体没成直线", "en": "Hips off line", "part": "hip"})


def check_squat_depth(ctx: RuleContext) -> Dict[str, Any]:
    code = f"{ctx.mode}.depth"
    if not ctx.is_side_view():
        return unavailable(code, "下蹲深度", NEED_SIDE_VIEW)
    items = per_rep_angle(ctx, ctx.thigh(), bottom_frame, lambda v: v <= 0, lambda v: v <= 25)

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        median = float(np.median([i["value"] for i in chosen]))
        if status == "good":
            return "每次最低点大腿都到达或低于水平（按髋关节不高于膝关节估算）"
        reps = rep_list_zh([i["rep"] for i in chosen])
        if status == "warn":
            return f"第 {reps} 次最低点大腿可能略高于水平（画面中约 {median:.0f}°）；机位不正对侧面时会偏大，正侧面拍摄更准"
        return f"第 {reps} 次最低点大腿仍明显高于水平约 {median:.0f}°，深度不足"

    return grade_reps(ctx, code, "下蹲深度", items, describe, {"zh": "深度不足", "en": "Above parallel", "part": "hip"})


def check_trunk_lean(ctx: RuleContext, good: float, warn: float) -> Dict[str, Any]:
    code = f"{ctx.mode}.trunk_lean"
    if not ctx.is_side_view():
        return unavailable(code, "躯干前倾", NEED_SIDE_VIEW)
    items = per_rep_angle(ctx, ctx.lean(), bottom_frame, lambda v: v <= good, lambda v: v <= warn)

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        median = float(np.median([i["value"] for i in chosen]))
        if status == "good":
            return f"最低点躯干前倾约 {median:.0f}°，在常见范围内"
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次最低点躯干前倾约 {median:.0f}°，偏大，下背压力会增加"

    return grade_reps(ctx, code, "躯干前倾", items, describe, {"zh": "前倾过大", "en": "Leaning forward", "part": "shoulder"})


def check_knee_valgus(ctx: RuleContext) -> Dict[str, Any]:
    code = f"{ctx.mode}.knee_valgus"
    if ctx.view != "front":
        return unavailable(code, "膝盖内扣", NEED_FRONT_VIEW.replace("比较左右", "判断膝盖内扣"))
    knees = np.linalg.norm(pf.points(ctx.track, 25) - pf.points(ctx.track, 26), axis=-1)
    ankles = np.linalg.norm(pf.points(ctx.track, 27) - pf.points(ctx.track, 28), axis=-1)
    ratio = knees / ankles
    standing = [pf.value_at(ratio, top_frame(ctx, rep)) for rep in ctx.reps]
    standing = [value for value in standing if value is not None]
    if not standing:
        return unavailable(code, "膝盖内扣", "站立时膝踝关键点不清楚，无法建立基准")
    baseline = float(np.median(standing))
    items = []
    for rep in ctx.reps:
        window = _rep_window(ctx, rep)
        values = ratio[window.start:window.stop]
        finite = np.flatnonzero(np.isfinite(values))
        if finite.size < 3 or baseline <= 0:
            items.append({"rep": rep["repIndex"], "frame": window.start, "value": None, "grade": None})
            continue
        worst = int(finite[np.argmin(values[finite])])
        relative = float(values[worst] / baseline)
        items.append({"rep": rep["repIndex"], "frame": window.start + worst, "value": relative * 100,
                      "grade": grade_value(relative, lambda v: v >= 0.9, lambda v: v >= 0.8)})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "起身过程中膝盖基本保持与脚尖同向，没有明显内扣"
        median = float(np.median([i["value"] for i in chosen]))
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次起身时双膝间距缩小到站立时的 {median:.0f}%，有膝内扣"

    return grade_reps(ctx, code, "膝盖内扣", items, describe, {"zh": "膝内扣", "en": "Knees caving", "part": "knee"}, "%")


def check_heel_rise(ctx: RuleContext) -> Dict[str, Any]:
    """Heel height at the bottom vs standing, relative to shin length.

    Uses the heel point alone: the toe point jumps when the shin or rack covers the foot,
    and in barbell lifts ctx.scale belongs to the plate, not the feet.
    """
    code = f"{ctx.mode}.heel_rise"
    if not ctx.is_side_view():
        return unavailable(code, "脚跟离地", NEED_SIDE_VIEW)
    heel = pf.smooth(pf.side_points(ctx.track, ctx.side, "heel", 0.7)[:, 1], max(1, int(round(ctx.fps * 0.1))))
    shin = float(np.nanmedian(pf.segment_length(ctx.track, ctx.side, "knee", "ankle")))
    items = []
    for rep in ctx.reps:
        standing = pf.nearest_value(heel, top_frame(ctx, rep), int(ctx.fps * 0.2))
        bottom = pf.nearest_value(heel, bottom_frame(ctx, rep), int(ctx.fps * 0.2))
        if standing is None or bottom is None or not np.isfinite(shin) or shin <= 0:
            items.append({"rep": rep["repIndex"], "frame": bottom_frame(ctx, rep), "value": None, "grade": None})
            continue
        rise = (standing - bottom) / shin * 100
        items.append({"rep": rep["repIndex"], "frame": bottom_frame(ctx, rep), "value": rise,
                      "grade": "good" if rise < 6 else "warn"})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "脚跟全程基本贴地"
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次最低点脚跟可能离地，可检查踝关节灵活性"

    return grade_reps(ctx, code, "脚跟离地", items, describe, {"zh": "脚跟抬起", "en": "Heels up", "part": "ankle"}, "%")


def check_hip_shift(ctx: RuleContext) -> Dict[str, Any]:
    code = f"{ctx.mode}.shift"
    if ctx.view != "front":
        return unavailable(code, "重心左右偏移", NEED_FRONT_VIEW)
    left_hip, right_hip = pf.points(ctx.track, 23), pf.points(ctx.track, 24)
    ankles = pf.nan_mean_pair(pf.points(ctx.track, 27), pf.points(ctx.track, 28))
    hip_axis = left_hip - right_hip
    width = np.linalg.norm(hip_axis, axis=-1)
    with np.errstate(invalid="ignore", divide="ignore"):
        offset = np.sum(((left_hip + right_hip) / 2 - ankles) * hip_axis, axis=-1) / (width ** 2)
    items = []
    for rep in ctx.reps:
        frame = bottom_frame(ctx, rep)
        value = pf.nearest_value(offset, frame, int(ctx.fps * 0.1))
        items.append({"rep": rep["repIndex"], "frame": frame,
                      "value": None if value is None else abs(value) * 100,
                      "toward": None if value is None else ("左" if value > 0 else "右"),
                      "grade": grade_value(None if value is None else abs(value), lambda v: v < 0.25, lambda v: v < 0.4)})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "最低点髋部基本居中"
        toward = _majority_side([i.get("toward") for i in chosen])
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次最低点髋部偏向{toward or '一'}侧"

    return grade_reps(ctx, code, "重心左右偏移", items, describe, {"zh": "重心偏移", "en": "Hip shift", "part": "hip"}, "%")
