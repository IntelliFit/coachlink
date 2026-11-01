"""Scores the rounded-back answers against the labels in the manifest.

A rep's verdict averages p_rounded over the repeats that could judge it; a warning fires
at WARN_AT, and a rep with fewer than half its repeats able to judge counts as "cannot
judge". The three numbers that decide this feature are the false alarm rate on straight
backs, the same rate on strongly leaning straight backs (the trap vision-demos warns of),
and the catch rate on rounded backs.

usage: python back_score.py --run <name>
Writes vlm-eval/back/<run>/score.json.
"""
import argparse
import json
import os
import re
import statistics
from typing import Any, Dict, List, Optional

import clips as cl

WARN_AT = 0.7
STRAIGHT_LABELS = ("straight", "straight_lean")


def parse(text: Optional[str]) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        reply = json.loads(match.group(0))
    except ValueError:
        return None
    if not isinstance(reply.get("can_judge"), bool):
        return None
    if reply["can_judge"] and not isinstance(reply.get("p_rounded"), (int, float)):
        return None
    return reply


def rep_verdict(replies: List[Optional[Dict[str, Any]]]) -> Dict[str, Any]:
    judged = [float(reply["p_rounded"]) for reply in replies if reply and reply["can_judge"]]
    usable = sum(1 for reply in replies if reply is not None)
    if len(judged) * 2 < len(replies):
        return {"verdict": "cannot_judge", "pRounded": None, "usableReplies": usable, "judgedReplies": len(judged), "spread": None}
    mean = statistics.fmean(judged)
    return {
        "verdict": "rounded" if mean >= WARN_AT else "not_flagged",
        "pRounded": round(mean, 3),
        "usableReplies": usable,
        "judgedReplies": len(judged),
        "spread": round(max(judged) - min(judged), 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="smoke")
    args = parser.parse_args()
    root = os.path.join(cl.OUT, "back", args.run)
    with open(os.path.join(root, "manifest.json"), encoding="utf-8") as handle:
        manifests = json.load(handle)
    with open(os.path.join(root, "answers.json"), encoding="utf-8") as handle:
        answers = json.load(handle)
    labels = {item["clip"]: item["label"] for item in manifests}
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for answer in answers:
        grouped.setdefault(answer["id"].rsplit("/", 1)[0], []).append(answer)
    rows = []
    for key, items in sorted(grouped.items()):
        clip, rep = key.split("/")
        verdict = rep_verdict([parse(item["text"]) for item in items])
        rows.append(
            {
                "clip": clip,
                "rep": rep,
                "label": labels[clip],
                **verdict,
                "calls": len(items),
                "latencyMsMedian": round(statistics.median(item["latencyMs"] for item in items)),
                "promptTokens": sum(item["promptTokens"] or 0 for item in items),
                "completionTokens": sum(item["completionTokens"] or 0 for item in items),
                "reasons": [(parse(item["text"]) or {}).get("reason") for item in items],
            }
        )

    def rate(selected: List[Dict[str, Any]], verdict: str) -> Dict[str, Any]:
        judged = [row for row in selected if row["verdict"] != "cannot_judge"]
        hits = sum(1 for row in judged if row["verdict"] == verdict)
        return {"reps": len(selected), "judged": len(judged), "hits": hits, "rate": round(hits / len(judged), 3) if judged else None}

    summary = {
        "falseAlarmStraight": rate([row for row in rows if row["label"] in STRAIGHT_LABELS], "rounded"),
        "falseAlarmLean": rate([row for row in rows if row["label"] == "straight_lean"], "rounded"),
        "catchRounded": rate([row for row in rows if row["label"] == "rounded"], "rounded"),
        "unlabelledReps": sum(1 for row in rows if row["label"] == "unlabelled"),
    }
    with open(os.path.join(root, "score.json"), "w", encoding="utf-8") as handle:
        json.dump({"summary": summary, "rows": rows}, handle, ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False))
    for row in rows:
        print(row["clip"], row["rep"], row["label"], row["verdict"], "p", row["pRounded"], "spread", row["spread"], "judged", row["judgedReplies"], "/", row["calls"], "ms", row["latencyMsMedian"], "tokens", row["promptTokens"], row["completionTokens"], row["reasons"])


if __name__ == "__main__":
    main()
