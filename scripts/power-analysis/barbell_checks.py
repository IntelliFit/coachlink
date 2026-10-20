"""Barbell-specific checks for back squat, bench press and deadlift."""
from typing import Any, Dict, List, Optional

import numpy as np

import pose_features as pf
from movement_checks import NEED_PLATE, NEED_SIDE_VIEW
from movement_rules import (
    RuleContext,
    bottom_frame,
    grade_reps,
    grade_value,
    make_check,
    rep_list_zh,
    top_frame,
    unavailable,
)


def _bar_y(ctx: RuleContext) -> Optional[np.ndarray]:
    return None if ctx.bar_points is None else ctx.bar_points[:, 1]


def _facing_sign(ctx: RuleContext) -> float:
    """+1 if the toes point to +x in the image, -1 if to -x, 0 if unknown."""
    heel = pf.side_points(ctx.track, ctx.side, "heel")[:, 0]
    toe = pf.side_points(ctx.track, ctx.side, "foot")[:, 0]
    difference = toe - heel
    difference = difference[np.isfinite(difference)]
    return float(np.sign(np.median(difference))) if difference.size >= 5 else 0.0


def check_bar_path_drift(ctx: RuleContext, good_m: float, warn_m: float) -> Dict[str, Any]:
    """Horizontal bar travel during the ascent, measured from the bar's own start position.

    The plate is nearer the camera than the feet, so comparing their x positions directly
    would turn an off-centre camera into fake drift.
    """
    code = f"{ctx.mode}.bar_path"
    title = "杠路是否垂直"
    if not ctx.is_side_view():
        return unavailable(code, title, NEED_SIDE_VIEW)
    if ctx.bar_points is None or not ctx.bar_from_plate:
        return unavailable(code, title, NEED_PLATE)
    bar_x = ctx.bar_points[:, 0]
    facing = _facing_sign(ctx)
    items = []
    for rep in ctx.reps:
        start, end = sorted((bottom_frame(ctx, rep), top_frame(ctx, rep)))
        origin = pf.nearest_value(bar_x, start, int(ctx.fps * 0.1))
        values = bar_x[start:end + 1]
        finite = np.flatnonzero(np.isfinite(values))
        if origin is None or finite.size < 3:
            items.append({"rep": rep["repIndex"], "frame": start, "value": None, "grade": None})
            continue
        drift = (values - origin) * ctx.scale
        worst = int(finite[np.argmax(np.abs(drift[finite]))])
        value = abs(float(drift[worst]))
        items.append({"rep": rep["repIndex"], "frame": start + worst, "value": value * 100,
                      "forward": None if facing == 0 else bool(np.sign(drift[worst]) == facing),
                      "grade": grade_value(value, lambda v: v <= good_m, lambda v: v <= warn_m)})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        median = float(np.median([i["value"] for i in chosen]))
        if status == "good":
            return f"上升过程中杠铃水平移动最多约 {median:.0f} cm，杠路基本垂直"
        directions = [i.get("forward") for i in chosen if i.get("forward") is not None]
        direction, tail = "", ""
        if directions and all(directions):
            direction = "向前（脚尖方向）"
            tail = "，离身体变远" if ctx.mode == "deadlift" else ""
        elif directions and not any(directions):
            direction = "向后（脚跟方向）"
        reps = rep_list_zh([i["rep"] for i in chosen])
        return f"第 {reps} 次上升时杠铃{direction}水平移动约 {median:.0f} cm{tail}"

    return grade_reps(ctx, code, title, items, describe, {"zh": "杠路偏移", "en": "Bar drifting", "part": "bar"}, "cm")


def check_bench_pause(ctx: RuleContext) -> Dict[str, Any]:
    code = "bench_press.pause"
    bar_y = _bar_y(ctx)
    if bar_y is None:
        return unavailable(code, "胸前停顿", "没有杠铃轨迹，无法测量停顿")
    pauses = []
    for rep in ctx.reps:
        frame = bottom_frame(ctx, rep)
        bottom = pf.value_at(bar_y, frame)
        if bottom is None:
            continue
        near = np.abs(bar_y - bottom) * ctx.scale <= 0.015
        left = frame
        while left - 1 >= 0 and near[left - 1]:
            left -= 1
        right = frame
        while right + 1 < near.size and near[right + 1] and right + 1 <= ctx.frames(rep, "startFrame") + int(ctx.fps * 0.15):
            right += 1
        pauses.append((rep["repIndex"], (right - left + 1) / ctx.fps))
    if not pauses:
        return unavailable(code, "胸前停顿", "最低点杠铃位置不清楚")
    average = float(np.mean([value for _, value in pauses]))
    for rep in ctx.reps:
        rep["pauseS"] = next((round(value, 2) for index, value in pauses if index == rep["repIndex"]), None)
    if average >= 0.3:
        detail = f"平均胸前停顿约 {average:.2f} 秒，接近比赛式停顿卧推"
    elif average < 0.15:
        detail = f"平均胸前停顿约 {average:.2f} 秒，基本是触胸即起"
    else:
        detail = f"平均胸前停顿约 {average:.2f} 秒，有短暂停顿"
    return make_check(code, "胸前停顿", "info", detail, value=average, unit="s")


def check_bench_hips(ctx: RuleContext) -> Dict[str, Any]:
    code = "bench_press.hips_off"
    if not ctx.is_side_view():
        return unavailable(code, "臀部离凳", NEED_SIDE_VIEW)
    hip_y = pf.smooth(pf.side_points(ctx.track, ctx.side, "hip")[:, 1], max(1, int(round(ctx.fps * 0.1))))
    rest = [pf.value_at(hip_y, top_frame(ctx, rep)) for rep in ctx.reps]
    rest = [value for value in rest if value is not None]
    if not rest:
        return unavailable(code, "臀部离凳", "髋部关键点不清楚")
    baseline = float(np.median(rest))
    items = []
    for rep in ctx.reps:
        start, end = sorted((bottom_frame(ctx, rep), top_frame(ctx, rep)))
        values = hip_y[start:end + 1]
        finite = np.flatnonzero(np.isfinite(values))
        if finite.size < 3:
            items.append({"rep": rep["repIndex"], "frame": start, "value": None, "grade": None})
            continue
        highest = int(finite[np.argmin(values[finite])])
        rise = (baseline - float(values[highest])) * ctx.body_scale * 100
        items.append({"rep": rep["repIndex"], "frame": start + highest, "value": max(0.0, rise),
                      "grade": grade_value(rise, lambda v: v < 2.5, lambda v: v < 4.0)})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        if status == "good":
            return "推起过程中臀部保持贴凳"
        median = float(np.median([i["value"] for i in chosen]))
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次推起时髋部抬高约 {median:.0f} cm，臀部可能离开凳面"

    return grade_reps(ctx, code, "臀部离凳", items, describe, {"zh": "臀部离凳", "en": "Hips up", "part": "hip"}, "cm")


def check_bench_bar_path(ctx: RuleContext) -> Dict[str, Any]:
    code = "bench_press.bar_path"
    if not ctx.is_side_view():
        return unavailable(code, "杠铃轨迹", NEED_SIDE_VIEW)
    if ctx.bar_points is None or not ctx.bar_from_plate:
        return unavailable(code, "杠铃轨迹", NEED_PLATE)
    nose_x = pf.points(ctx.track, 0, 0.3)[:, 0]
    hip_x = pf.side_points(ctx.track, ctx.side, "hip")[:, 0]
    head_sign = np.sign(np.nanmedian(nose_x - hip_x))
    if not np.isfinite(head_sign) or head_sign == 0:
        return unavailable(code, "杠铃轨迹", "看不清头部方向，无法判断杠铃前后移动")
    travels = []
    for rep in ctx.reps:
        start = pf.value_at(ctx.bar_points[:, 0], bottom_frame(ctx, rep))
        end = pf.value_at(ctx.bar_points[:, 0], top_frame(ctx, rep))
        if start is not None and end is not None:
            travel = (end - start) * head_sign * ctx.scale * 100
            travels.append((rep["repIndex"], travel, bottom_frame(ctx, rep)))
            rep["barHorizontalTravelCm"] = round(travel, 1)
    if not travels:
        return unavailable(code, "杠铃轨迹", "杠铃轨迹不完整")
    toward_feet = [item for item in travels if item[1] < -5]
    average = float(np.mean([item[1] for item in travels]))
    if toward_feet:
        for index, _, frame in toward_feet:
            ctx.add_event(frame, code, "杠铃向脚侧漂", "Bar drifting", "warn", "bar")
        return make_check(
            code, "杠铃轨迹", "warn",
            f"第 {rep_list_zh([item[0] for item in toward_feet])} 次推起时杠铃向脚侧漂移，平均水平移动 {average:.0f} cm",
            [item[0] for item in toward_feet], [ctx.time_s(item[2]) for item in toward_feet], average, "cm",
        )
    shape = "，属于常见的 J 形杠路" if average >= 3 else ""
    return make_check(code, "杠铃轨迹", "info", f"推起时杠铃平均向头侧移动约 {average:.0f} cm{shape}", value=average, unit="cm")


def check_deadlift_hips_first(ctx: RuleContext) -> Dict[str, Any]:
    code = "deadlift.hips_first"
    bar_y = _bar_y(ctx)
    if not ctx.is_side_view():
        return unavailable(code, "起杠时臀部先起", NEED_SIDE_VIEW)
    if bar_y is None:
        return unavailable(code, "起杠时臀部先起", "没有杠铃轨迹，无法定位起杠阶段")
    lean = ctx.lean()
    items = []
    for rep in ctx.reps:
        start, top = bottom_frame(ctx, rep), top_frame(ctx, rep)
        start_y, top_y = pf.value_at(bar_y, start), pf.value_at(bar_y, top)
        lean_start = pf.nearest_value(lean, start, int(ctx.fps * 0.1))
        if start_y is None or top_y is None or lean_start is None or top <= start:
            items.append({"rep": rep["repIndex"], "frame": start, "value": None, "grade": None})
            continue
        target = start_y - 0.4 * (start_y - top_y)
        segment = bar_y[start:top + 1]
        reached = np.flatnonzero(np.isfinite(segment) & (segment <= target))
        early = start + int(reached[0]) if reached.size else top
        lean_early = pf.nearest_value(lean, early, int(ctx.fps * 0.1))
        change = None if lean_early is None else lean_early - lean_start
        items.append({"rep": rep["repIndex"], "frame": early, "value": change,
                      "grade": grade_value(change, lambda v: v <= 8, lambda v: v <= 15)})

    def describe(status: str, chosen: List[Dict[str, Any]]) -> str:
        median = float(np.median([i["value"] for i in chosen]))
        if status == "good":
            if median <= 0:
                return "起杠到过膝前躯干没有变得更前倾，髋肩同步上升"
            return f"起杠到过膝前躯干前倾只增加约 {median:.0f}°，髋肩基本同步上升"
        return f"第 {rep_list_zh([i['rep'] for i in chosen])} 次起杠时躯干多前倾了约 {median:.0f}°，臀部先于肩部抬起，腿部推地不足"

    return grade_reps(ctx, code, "起杠时臀部先起", items, describe, {"zh": "臀部先起", "en": "Hips shoot up", "part": "hip"})


def check_deadlift_hitch(ctx: RuleContext) -> Dict[str, Any]:
    code = "deadlift.hitch"
    bar_y = _bar_y(ctx)
    if bar_y is None:
        return unavailable(code, "二次发力", "没有杠铃轨迹，无法判断上升是否中断")
    hitches = []
    evaluated = 0
    for rep in ctx.reps:
        start, top = bottom_frame(ctx, rep), top_frame(ctx, rep)
        segment = bar_y[start:top + 1]
        if segment.size < 4 or not np.all(np.isfinite(segment)):
            continue
        evaluated += 1
        rom = segment[0] - np.min(segment)
        highest_so_far = np.minimum.accumulate(segment)
        risen = (segment[0] - highest_so_far) / max(rom, 1e-6)
        sink_m = (segment - highest_so_far) * ctx.scale
        middle = (risen >= 0.3) & (risen <= 0.9)
        if np.any(middle) and float(np.max(sink_m[middle])) >= 0.015:
            frame = start + int(np.flatnonzero(middle & (sink_m >= 0.015))[0])
            hitches.append((rep["repIndex"], frame))
            ctx.add_event(frame, code, "二次发力", "Hitching", "warn", "bar")
    if evaluated == 0:
        return unavailable(code, "二次发力", "杠铃轨迹在上升阶段不完整，无法判断")
    if not hitches:
        return make_check(code, "二次发力", "good", "上升过程连续，没有中途下沉再发力")
    return make_check(
        code, "二次发力", "warn",
        f"第 {rep_list_zh([item[0] for item in hitches])} 次上升途中杠铃下沉了 1.5 cm 以上再拉起，可能是二次发力",
        [item[0] for item in hitches], [ctx.time_s(item[1]) for item in hitches],
    )


def spine_unavailable(ctx: RuleContext) -> Dict[str, Any]:
    return unavailable(
        f"{ctx.mode}.spine",
        "背部弯曲",
        "人体关键点没有脊柱节点，无法可靠判断弓背，需要教练看视频确认",
    )


def bench_symmetry_unavailable() -> Dict[str, Any]:
    return unavailable(
        "bench_press.symmetry",
        "左右推起是否一致",
        "侧面机位看不到两侧杠铃高低差，需要从床头方向另拍一段",
    )
