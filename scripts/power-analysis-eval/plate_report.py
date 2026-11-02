"""Builds the per-clip comparison of the plate evaluation from the saved results.

Errors compare rep by rep with the reference of the base sample, and only when the rep
count is right; a wrong count is reported as such rather than averaged away.

usage: python plate_report.py
Writes vlm-eval/plate/comparison.json and prints the table as Markdown.
"""
import json
import os
import statistics
from typing import Any, Dict, List, Optional

import clips as cl

ARMS = [
    ("seeded", "模型起点 + 现有跟踪"),
    ("seeded_keep", "模型起点 + 不因吸附失败停止"),
    ("seeded_keep_ellipse", "模型起点 + 不停止 + 椭圆特征区"),
    ("seeded_template", "模型起点 + 模板跟踪 + 多框定尺度"),
    ("seeded_template_moving", "再加：只在杠铃片运动时算相关性"),
]


def load(path: str) -> Any:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def errors(row: Dict[str, Any], reference: Dict[str, Any]) -> Optional[Dict[str, float]]:
    travel, velocity = row.get("travelM") or [], row.get("meanVelocityMps") or []
    if not travel or len(travel) != len(reference["travelM"]):
        return None
    pct = lambda got, want: 100.0 * (got - want) / want  # noqa: E731
    return {
        "travelPct": statistics.fmean(abs(pct(a, b)) for a, b in zip(travel, reference["travelM"])),
        "velocityPct": statistics.fmean(abs(pct(a, b)) for a, b in zip(velocity, reference["meanVelocityMps"])),
    }


def fmt_list(values: Optional[List[float]]) -> str:
    return "/".join(f"{value:.2f}" for value in values) if values else "-"


def hough_row(row: Dict[str, Any], reference: Dict[str, Any]) -> Dict[str, Any]:
    error = errors(row, reference) if row["target"] == "barbell_plate" else None
    return {
        "usedPlate": row["target"] == "barbell_plate",
        "reason": row["fallbackReason"],
        "reps": row["repCount"],
        "travelM": row["travelM"],
        "meanVelocityMps": row["meanVelocityMps"],
        "seconds": row["seconds"],
        "error": error,
        "proxyError": errors(row, reference) if row["target"] != "barbell_plate" else None,
    }


def arm_row(rows: List[Dict[str, Any]], reference: Dict[str, Any], expected: int) -> Dict[str, Any]:
    passed = [row for row in rows if row["gate"] == "ok"]
    right = [row for row in passed if row.get("repCount") == expected]
    measured = [errors(row, reference) for row in right]
    measured = [item for item in measured if item is not None]
    calls = sum(row["modelCalls"] for row in rows)
    return {
        "repeats": len(rows),
        "gatePassed": len(passed),
        "repsRight": len(right),
        "travelSamples": [row.get("travelM") for row in passed],
        "velocitySamples": [row.get("meanVelocityMps") for row in passed],
        "radiusSamples": [row.get("plateRadiusPx") for row in passed],
        "seedFrames": [row.get("seedFrame") for row in passed],
        "travelErrorPctMedian": round(statistics.median(item["travelPct"] for item in measured), 1) if measured else None,
        "travelErrorPctMax": round(max(item["travelPct"] for item in measured), 1) if measured else None,
        "velocityErrorPctMedian": round(statistics.median(item["velocityPct"] for item in measured), 1) if measured else None,
        "velocityErrorPctMax": round(max(item["velocityPct"] for item in measured), 1) if measured else None,
        "modelCallsPerRun": round(calls / max(1, len(rows)), 1),
        "modelSecondsPerRun": round(sum(row["modelLatencyMs"] for row in rows) / 1000 / max(1, len(rows)), 1),
        "promptTokensPerRun": round(sum(row["promptTokens"] for row in rows) / max(1, len(rows))),
        "completionTokensPerRun": round(sum(row["completionTokens"] for row in rows) / max(1, len(rows))),
        "followSeconds": round(statistics.fmean(row.get("followSeconds", 0) for row in rows), 1),
        "failures": sorted({row["gate"] for row in rows if row["gate"] != "ok"}),
    }


def plate_flips(answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Share of frames where repeats of the same question land on different objects."""
    from plate_seeded import parse_box

    groups: Dict[str, List[List[float]]] = {}
    empty = 0
    for answer in answers:
        box = parse_box(answer["text"])
        if box is None:
            empty += 1
            continue
        groups.setdefault(answer["id"].rsplit("/", 1)[0], []).append(box)
    flipped = 0
    for boxes in groups.values():
        centers = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) for b in boxes]
        sizes = [max(b[2] - b[0], b[3] - b[1]) for b in boxes]
        spread = max(abs(a[0] - c[0]) + abs(a[1] - c[1]) for a in centers for c in centers)
        if spread > statistics.fmean(sizes):
            flipped += 1
    return {"frames": len(groups), "framesFlipped": flipped, "noBoxReplies": empty, "replies": len(answers)}


def main() -> None:
    references = {row["clip"]: row for row in load(os.path.join(cl.OUT, "reference", "reference.json"))}
    hough = {row["clip"]: row for row in load(os.path.join(cl.OUT, "hough", "results.json"))}
    arms = {key: load(os.path.join(cl.OUT, "plate", key, "results.json")) for key, _ in ARMS}
    answers = load(os.path.join(cl.OUT, "plate", "answers.json"))
    table = []
    for clip in cl.barbell_clips():
        base = clip.name.split("__")[0]
        reference = references[base]
        entry = {
            "clip": clip.name,
            "synthetic": clip.name.endswith(cl.SYNTHETIC_SUFFIXES),
            "expectedReps": clip.expected_reps,
            "reference": {"travelM": reference["travelM"], "meanVelocityMps": reference["meanVelocityMps"]},
            "hough": hough_row(hough[clip.name], reference),
            "arms": {key: arm_row([row for row in arms[key] if row["clip"] == clip.name], reference, clip.expected_reps) for key, _ in ARMS},
        }
        table.append(entry)
    latencies = [answer["latencyMs"] for answer in answers]
    summary = {
        "clips": table,
        "flips": plate_flips(answers),
        "latencyMs": {
            "median": round(statistics.median(latencies)),
            "p90": round(statistics.quantiles(latencies, n=10)[-1]),
            "max": max(latencies),
        },
        "tokensPerCall": {
            "prompt": round(statistics.median(answer["promptTokens"] or 0 for answer in answers)),
            "completion": round(statistics.median(answer["completionTokens"] or 0 for answer in answers)),
        },
    }
    with open(os.path.join(cl.OUT, "plate", "comparison.json"), "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)

    print("| 片段 | 参考 行程/速度 | Hough 结果 | Hough 行程/速度 | " + " | ".join(label for _, label in ARMS) + " |")
    print("|" + "---|" * (4 + len(ARMS)))
    for entry in table:
        h = entry["hough"]
        h_text = f"{'用上' if h['usedPlate'] else '退回身体'} {h['reps']}/{entry['expectedReps']} 次"
        h_error = h["error"] or h["proxyError"]
        h_nums = f"{fmt_list(h['travelM'])} m · {fmt_list(h['meanVelocityMps'])} m/s"
        if h_error:
            h_nums += f"（误差 {h_error['travelPct']:.1f}% / {h_error['velocityPct']:.1f}%）"
        cells = []
        for key, _ in ARMS:
            arm = entry["arms"][key]
            error = "-" if arm["travelErrorPctMedian"] is None else f"行程误差 {arm['travelErrorPctMedian']}%（最大 {arm['travelErrorPctMax']}%），速度误差 {arm['velocityErrorPctMedian']}%（最大 {arm['velocityErrorPctMax']}%）"
            cells.append(f"过门槛 {arm['gatePassed']}/{arm['repeats']}，次数对 {arm['repsRight']}/{arm['repeats']}；{error}")
        ref = entry["reference"]
        print(f"| {entry['clip']} | {fmt_list(ref['travelM'])} m · {fmt_list(ref['meanVelocityMps'])} m/s | {h_text} | {h_nums} | " + " | ".join(cells) + " |")
    print(json.dumps({key: summary[key] for key in ("flips", "latencyMs", "tokensPerCall")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
